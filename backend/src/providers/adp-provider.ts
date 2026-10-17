import { randomUUID } from 'node:crypto';
import type { AgentStage } from '../agents/schemas.js';
import { responseContract } from '../agents/response-contract.js';
import type { ModelProvider, ModelProviderRequest, ProviderOutput } from './model-provider.js';

// Tencent's v2 HTTP SSE contract:
// https://www.tencentcloud.com/document/product/1254/81449
export const DEFAULT_ADP_CHAT_URL = 'https://wss.lke.tencentcloud.com/adp/v2/chat';
const MAX_CALLS = 5;
const MAX_INPUT_BYTES = 256 * 1024;
const MAX_RUN_INPUT_BYTES = 1024 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_ANSWER_BYTES = 120 * 1024;

export interface AdpProviderOptions {
  riderAppKey: string;
  driverAppKey: string;
  judgeAppKey: string;
  chatUrl?: string;
  callTimeoutMs?: number;
  runTimeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

type ErrorCode = 'ADP_CONFIG_INVALID' | 'ADP_INPUT_INVALID' | 'ADP_INPUT_LIMIT'
  | 'ADP_CALL_LIMIT' | 'ADP_RUN_ABORTED' | 'ADP_TIMEOUT' | 'ADP_HTTP_ERROR'
  | 'ADP_UPSTREAM_ERROR' | 'ADP_STREAM_INVALID' | 'ADP_STREAM_INCOMPLETE'
  | 'ADP_RESPONSE_LIMIT' | 'ADP_ANSWER_INVALID' | 'ADP_TRANSPORT_ERROR';

/** Never carries upstream text, request bodies, AppKeys, or nested error causes. */
export class AdpProviderError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = 'AdpProviderError';
  }
}

function fail(code: ErrorCode): never { throw new AdpProviderError(code); }
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function timeout(value: number | undefined, fallback: number): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result <= 0 || result > 1_800_000) fail('ADP_CONFIG_INVALID');
  return result;
}

function priorStage(output: ProviderOutput): AgentStage {
  if ('outcome' in output) return 'judge';
  if (output.role === 'rider_advocate') return 'position' in output ? 'rider_brief' : 'rider_rebuttal';
  return 'position' in output ? 'driver_brief' : 'driver_rebuttal';
}

function parseAnswer(answer: string): unknown {
  if (Buffer.byteLength(answer, 'utf8') > MAX_ANSWER_BYTES) fail('ADP_RESPONSE_LIMIT');
  let text = answer.trim();
  // Only a complete enclosing JSON fence is tolerated. Never extract a JSON
  // fragment from prose or reasoning, which could select an unintended answer.
  const fence = /^```json\s*\r?\n([\s\S]*?)\r?\n```$/i.exec(text);
  if (fence) text = fence[1].trim();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { fail('ADP_ANSWER_INVALID'); }
  if (!record(parsed)) fail('ADP_ANSWER_INVALID');
  return parsed;
}

/** Parse complete SSE frames; final response snapshots are authoritative. */
class AdpSseParser {
  private buffer = '';
  private event = '';
  private data: string[] = [];
  private answer: unknown;
  private completed = false;
  done = false;

  constructor(private readonly conversationId: string, private readonly requestId: string) {}

  feed(chunk: string, eof = false): void {
    this.buffer += chunk;
    while (!this.done) {
      const index = this.buffer.search(/[\r\n]/);
      if (index < 0) break;
      if (this.buffer[index] === '\r' && index === this.buffer.length - 1 && !eof) break;
      const delimiter = this.buffer[index] === '\r' && this.buffer[index + 1] === '\n' ? 2 : 1;
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + delimiter);
      if (line === '') { this.dispatch(); continue; }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      let value = colon < 0 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') this.event = value;
      if (field === 'data') this.data.push(value);
    }
  }

  result(): unknown {
    if (!this.done || !this.completed) fail('ADP_STREAM_INCOMPLETE');
    return this.answer;
  }

  private dispatch(): void {
    const event = this.event.replace(/^"(.*)"$/, '$1');
    const data = this.data.join('\n');
    this.event = '';
    this.data = [];
    if (!data) return;
    if (event === 'done' && data === '[DONE]') {
      if (!this.completed) fail('ADP_STREAM_INCOMPLETE');
      this.done = true;
      return;
    }
    let payload: unknown;
    try { payload = JSON.parse(data); } catch { fail('ADP_STREAM_INVALID'); }
    if (!record(payload) || typeof payload.Type !== 'string') fail('ADP_STREAM_INVALID');
    if (event && event !== payload.Type) fail('ADP_STREAM_INVALID');
    const type = payload.Type;
    if (type === 'error' || payload.Error) fail('ADP_UPSTREAM_ERROR');
    const response = payload.Response;
    const ack = payload.RequestAck;
    if (record(ack) && ack.Status !== 'success') fail('ADP_UPSTREAM_ERROR');
    if (record(response) && response.Status !== 'success' && response.Status !== 'processing') {
      fail('ADP_UPSTREAM_ERROR');
    }
    if (type !== 'response.completed') return;
    if (this.completed || !record(response) || response.Role !== 'assistant'
      || response.Status !== 'success' || !Array.isArray(response.Messages)) fail('ADP_STREAM_INVALID');
    if (response.ConversationId !== this.conversationId) fail('ADP_STREAM_INVALID');
    if (record(response.ExtraInfo) && response.ExtraInfo.RequestId !== undefined
      && response.ExtraInfo.RequestId !== this.requestId) fail('ADP_STREAM_INVALID');
    const replies = response.Messages.filter((message) => record(message) && message.Type === 'reply');
    // Multi-intent is disabled. Ambiguous/multiple answers are not adjudications.
    if (replies.length !== 1) fail('ADP_ANSWER_INVALID');
    const reply = replies[0] as Record<string, unknown>;
    if (reply.Status !== 'success' || !Array.isArray(reply.Contents) || !reply.Contents.length) {
      fail('ADP_ANSWER_INVALID');
    }
    const contents = reply.Contents;
    if (contents.some((content) => !record(content) || content.Type !== 'text' || typeof content.Text !== 'string')) {
      fail('ADP_ANSWER_INVALID');
    }
    const answer = contents.map((content) => (content as Record<string, unknown>).Text).join('');
    this.answer = parseAnswer(answer);
    this.completed = true;
  }
}

/** One instance per five-stage review. No API retries or shared chat history. */
export class AdpModelProvider implements ModelProvider {
  readonly id = 'tencent-adp-v2';
  readonly mode = 'live' as const;
  #appKeys: { rider: string; driver: string; judge: string };
  private readonly fetcher: typeof globalThis.fetch;
  private readonly chatUrl: string;
  private readonly callTimeoutMs: number;
  private readonly runTimeoutMs: number;
  private readonly controllers = new Set<AbortController>();
  private calls = 0;
  private inputBytes = 0;
  private deadline: number | undefined;
  private caseId: string | undefined;
  private stopped = false;

  constructor(options: AdpProviderOptions) {
    for (const key of [options.riderAppKey, options.driverAppKey, options.judgeAppKey]) {
      if (typeof key !== 'string' || !key.trim() || key.length > 4096 || /\s/.test(key)) fail('ADP_CONFIG_INVALID');
    }
    let url: URL;
    try { url = new URL(options.chatUrl ?? DEFAULT_ADP_CHAT_URL); } catch { fail('ADP_CONFIG_INVALID'); }
    // Never follow redirects or send credentials to arbitrary hosts.
    if (url.origin !== 'https://wss.lke.tencentcloud.com' || url.pathname !== '/adp/v2/chat'
      || url.username || url.password || url.search || url.hash) fail('ADP_CONFIG_INVALID');
    this.#appKeys = { rider: options.riderAppKey, driver: options.driverAppKey, judge: options.judgeAppKey };
    this.chatUrl = url.href;
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.callTimeoutMs = timeout(options.callTimeoutMs, 60_000);
    this.runTimeoutMs = timeout(options.runTimeoutMs, 240_000);
  }

  /** Also call this if coordinator schema/citation validation fails. */
  abort(): void {
    this.stopped = true;
    for (const controller of this.controllers) controller.abort();
  }

  async generate(request: ModelProviderRequest): Promise<unknown> {
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let removeAbortListener = () => {};
    let timedOut = false;
    try {
      if (this.stopped) fail('ADP_RUN_ABORTED');
      if (++this.calls > MAX_CALLS) fail('ADP_CALL_LIMIT');
      this.deadline ??= Date.now() + this.runTimeoutMs;
      const remaining = this.deadline - Date.now();
      if (remaining <= 0) fail('ADP_TIMEOUT');
      if (!request.evidence.caseId || !request.evidence.evidence.length || !request.evidence.policyRules.length
        || !request.systemPrompt.trim()) fail('ADP_INPUT_INVALID');
      this.caseId ??= request.evidence.caseId;
      if (request.evidence.caseId !== this.caseId) fail('ADP_INPUT_INVALID');
      const appKey = this.keyForStage(request.stage);
      const conversationId = randomUUID();
      const requestId = randomUUID();
      const body = JSON.stringify({
        RequestId: requestId,
        ConversationId: conversationId,
        VisitorId: conversationId,
        AppKey: appKey,
        SystemRole: request.systemPrompt,
        Contents: [{ Type: 'text', Text: JSON.stringify({
          stage: request.stage,
          responseContract: responseContract(request.stage, request.evidence),
          ...request.evidence,
          priorOutputs: request.priorOutputs.map((output) => ({ stage: priorStage(output), output })),
        }) }],
        Incremental: true,
        Stream: 'enable',
        SearchNetwork: 'disable',
        WorkflowStatus: 'disable',
        EnableMultiIntent: false,
      });
      const bytes = Buffer.byteLength(body, 'utf8');
      if (bytes > MAX_INPUT_BYTES || this.inputBytes + bytes > MAX_RUN_INPUT_BYTES) fail('ADP_INPUT_LIMIT');
      this.inputBytes += bytes;
      controller = new AbortController();
      this.controllers.add(controller);
      const signal = controller.signal;
      const interrupted = new Promise<never>((_, reject) => {
        const onAbort = () => reject(new AdpProviderError(timedOut ? 'ADP_TIMEOUT' : 'ADP_RUN_ABORTED'));
        signal.addEventListener('abort', onAbort, { once: true });
        removeAbortListener = () => signal.removeEventListener('abort', onAbort);
      });
      timer = setTimeout(() => { timedOut = true; controller!.abort(); }, Math.min(this.callTimeoutMs, remaining));
      return await Promise.race([
        this.perform(body, conversationId, requestId, signal),
        interrupted,
      ]);
    } catch (error) {
      this.abort();
      if (timedOut) fail('ADP_TIMEOUT');
      if (error instanceof AdpProviderError) throw error;
      fail('ADP_TRANSPORT_ERROR');
    } finally {
      if (timer) clearTimeout(timer);
      removeAbortListener();
      if (controller) this.controllers.delete(controller);
    }
  }

  private keyForStage(stage: AgentStage): string {
    switch (stage) {
      case 'rider_brief': case 'rider_rebuttal': return this.#appKeys.rider;
      case 'driver_brief': case 'driver_rebuttal': return this.#appKeys.driver;
      case 'judge': return this.#appKeys.judge;
      default: return fail('ADP_INPUT_INVALID');
    }
  }

  private async perform(body: string, conversationId: string, requestId: string, signal: AbortSignal): Promise<unknown> {
    const response = await this.fetcher(this.chatUrl, {
      method: 'POST', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body,
    });
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      fail('ADP_HTTP_ERROR');
    }
    if (!response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream') || !response.body) {
      void response.body?.cancel().catch(() => {});
      fail('ADP_STREAM_INVALID');
    }
    const reader = response.body.getReader();
    const cancel = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener('abort', cancel, { once: true });
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const parser = new AdpSseParser(conversationId, requestId);
    let bytes = 0;
    try {
      if (signal.aborted) fail('ADP_RUN_ABORTED');
      while (!parser.done) {
        const chunk = await reader.read();
        if (signal.aborted) fail('ADP_RUN_ABORTED');
        if (chunk.done) { parser.feed(decoder.decode(), true); break; }
        bytes += chunk.value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) fail('ADP_RESPONSE_LIMIT');
        parser.feed(decoder.decode(chunk.value, { stream: true }));
      }
      return parser.result();
    } finally {
      signal.removeEventListener('abort', cancel);
      cancel();
    }
  }
}
