import { setTimeout as delay } from 'node:timers/promises';
import { getDb } from './db/connection.js';
import { findWorkspaceCase } from './workspace.js';
import type { ReviewRunner } from './routes/runs.js';

/** Retry technical failures twice; successful human-review decisions are final. */
export function createAutomaticReviews(runner: ReviewRunner, options: { retryDelaysMs?: [number, number] } = {}) {
  const retryDelays = options.retryDelaysMs ?? [2000, 5000];
  const pending: string[] = [];
  const scheduled = new Set<string>();
  let worker: Promise<void> | undefined, closing = false;
  function fail(id: string, reason: string) {
    getDb().prepare("UPDATE workspace_cases SET status='review_failed', reason=? WHERE case_id=? AND status IN ('queued','retrying','running','human_review') AND result IS NULL").run(reason,id);
  }
  async function drain() {
    while(pending.length && !closing) {
      const id=pending.shift()!;
      try {
        // Share the provider's existing concurrency and call-budget limits.
        while(runner.isBusy() && !closing) await delay(100);
        if(closing) { fail(id,'The service stopped before review started. Support can retry.'); break; }
        const c=findWorkspaceCase(id);
        if(!c || c.status!=='queued' || !c.supported || !c.driver_account) continue;
        for(let attempt=c.automatic_attempts+1; attempt<=3; attempt++) {
          getDb().prepare('UPDATE workspace_cases SET automatic_attempts=? WHERE case_id=?').run(attempt,id);
          const response=await runner.run(id,'live');
          if(response.statusCode<400)break;
          if(response.statusCode>=500 && attempt<3 && !closing) {
            getDb().prepare("UPDATE workspace_cases SET status='retrying', reason=? WHERE case_id=? AND result IS NULL").run(`Technical issue on attempt ${attempt} of 3. Retrying automatically in ${retryDelays[attempt-1]/1000} seconds.`,id);
            await delay(retryDelays[attempt-1]);
            while(runner.isBusy() && !closing)await delay(100);
            if(closing){fail(id,'The service stopped before the retry. Support can retry.');break;}
            continue;
          }
          const reason=response.statusCode===400?'Automatic AI review is unavailable. Check the provider configuration, then retry.':response.statusCode===429?'Automatic AI review could not start because the service usage limit was reached. Contact the service operator.':'Automatic AI review could not start. Support can check the service and retry.';
          fail(id,attempt===3 && response.statusCode>=500?'Automatic retry limit reached after 3 attempts. Click Retry AI review to try again.':reason);
          break;
        }
      } catch {
        fail(id,'Automatic AI review encountered a technical issue. Support can check the service and retry.');
      } finally {scheduled.delete(id);}
    }
  }
  function startWorker() {
    worker=Promise.resolve().then(drain).finally(()=>{
      worker=undefined;
      if(pending.length && !closing)startWorker();
    });
  }
  return {
    enqueue(id: string) {
      if(closing || scheduled.has(id))return;
      const c=findWorkspaceCase(id);
      if(!c || c.status!=='queued')return;
      scheduled.add(id);pending.push(id);
      if(!worker)startWorker();
    },
    async idle() { await worker; },
    async close() {
      closing=true;
      for(const id of pending)fail(id,'The service stopped before review started. Support can retry.');
      pending.length=0;
      await worker;
    },
  };
}
