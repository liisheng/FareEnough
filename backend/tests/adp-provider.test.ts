import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdpModelProvider, DEFAULT_ADP_CHAT_URL } from '../src/providers/adp-provider.js';
import type { AdpProviderOptions } from '../src/providers/adp-provider.js';
import type { ModelProviderRequest, ProviderOutput } from '../src/providers/model-provider.js';

const keys = { riderAppKey: 'synthetic-rider-key', driverAppKey: 'synthetic-driver-key', judgeAppKey: 'synthetic-judge-key' };
const answer = { outcome: 'human_review', proposedAdjustmentCents: 0, explanation: 'Location unverified — review required.' };
const encoder = new TextEncoder();

function request(stage: ModelProviderRequest['stage'] = 'judge'): ModelProviderRequest {
  return {
    stage,
    conversationId: 'internal-run:stage',
    systemPrompt: 'Evaluate supplied evidence only.',
    evidence: {
      caseId: 'TEST-001',
      evidence: [{ id: 'E1', kind: 'derived_fact', data: { verifiedAdjustmentCents: 500 } }],
      policyRules: [{ id: 'P1', text: 'Unverified pickup location requires review.', value: 'human_review' }],
      policyProfile: { id: 'test-profile' } as ModelProviderRequest['evidence']['policyProfile'],
    },
    priorOutputs: [],
  };
}

function event(type: string, fields: Record<string, unknown> = {}): string {
  return `event: ${type}\ndata: ${JSON.stringify({ Type: type, ...fields })}\n\n`;
}

function completed(body: Record<string, any>, text = JSON.stringify(answer), changes: Record<string, unknown> = {}): string {
  return event('response.completed', { Response: {
    Role: 'assistant', Status: 'success', ConversationId: body.ConversationId,
    ExtraInfo: { RequestId: body.RequestId },
    Messages: [
      { Type: 'thought', Status: 'success', Contents: [{ Type: 'text', Text: '{"outcome":"wrong-thought"}' }] },
      { Type: 'tool_call', Status: 'success', Contents: [{ Type: 'text', Text: '{"outcome":"wrong-tool"}' }] },
      { Type: 'reply', Status: 'success', Contents: [{ Type: 'text', Text: text }] },
    ],
    ...changes,
  } });
}

const done = 'event: done\ndata: [DONE]\n\n';

function sse(text: string, splitEvery = 0): Response {
  const bytes = encoder.encode(text);
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      if (!splitEvery) controller.enqueue(bytes);
      else for (let offset = 0; offset < bytes.length; offset += splitEvery) controller.enqueue(bytes.slice(offset, offset + splitEvery));
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
}

function providerWith(
  respond: (body: Record<string, any>, init: RequestInit) => Response | Promise<Response>,
  options: Partial<AdpProviderOptions> = {},
) {
  const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => respond(JSON.parse(init!.body as string), init!));
  const provider = new AdpModelProvider({ ...keys, fetch: fetcher as typeof fetch, ...options });
  return { provider, fetcher };
}

afterEach(() => vi.useRealTimers());

describe('ADP v2 provider', () => {
  it('reads only the final assistant reply across byte/UTF-8/CRLF splits, ignoring thoughts and prior deltas', async () => {
    const { provider } = providerWith((body) => sse((
      ': keepalive\n\n'
      + event('request_ack', { RequestAck: { Status: 'success', Messages: [{ Type: 'question', Contents: [{ Type: 'text', Text: '{"wrong":"echo"}' }] }] } })
      + event('message.added', { Message: { Type: 'thought', MessageId: 'thought-1' } })
      + event('text.delta', { MessageId: 'thought-1', Text: '{"wrong":"reasoning"}' })
      + event('text.delta', { MessageId: 'reply-1', Text: '{"wrong":"outdated draft"}' })
      + event('text.replace', { MessageId: 'reply-1', Text: '{"wrong":"replacement draft"}' })
      + completed(body) + done
    ).replaceAll('\n', '\r\n'), 1));
    expect(await provider.generate(request())).toEqual(answer);
  });

  it('supports SSE multiline data and heartbeat frames', async () => {
    const { provider } = providerWith((body) => sse(completed(body).replace('data: {"Type":', 'data: {\ndata: "Type":') + ': ping\n\n' + done, 17));
    expect(await provider.generate(request())).toEqual(answer);
  });

  it('routes all five stages to their key and sends isolated complete case contexts with labeled prior outputs', async () => {
    const { provider, fetcher } = providerWith((body) => sse(completed(body) + done));
    const brief = { role: 'rider_advocate', position: 'Review required.', claims: [{ text: 'Record missing.', evidenceIds: ['E1'], policyRuleIds: ['P1'] }], adverseEvidence: [], concessions: [], unansweredQuestions: [] } as ProviderOutput;
    const driverBrief = { ...brief, role: 'driver_advocate', concessions: ['Driver location is unverified.'] } as ProviderOutput;
    const stages = ['rider_brief', 'driver_brief', 'rider_rebuttal', 'driver_rebuttal', 'judge'] as const;
    for (const stage of stages) {
      const input = request(stage);
      if (stage === 'rider_rebuttal' || stage === 'judge') input.priorOutputs = [brief, driverBrief];
      if (stage === 'driver_rebuttal') input.priorOutputs = [driverBrief, brief];
      await provider.generate(input);
    }
    const bodies = fetcher.mock.calls.map((call) => JSON.parse(call[1]!.body as string));
    expect(bodies.map((body) => body.AppKey)).toEqual([keys.riderAppKey, keys.driverAppKey, keys.riderAppKey, keys.driverAppKey, keys.judgeAppKey]);
    expect(new Set(bodies.map((body) => body.ConversationId)).size).toBe(5);
    expect(new Set(bodies.map((body) => body.RequestId)).size).toBe(5);
    for (const [index, body] of bodies.entries()) {
      expect(body.ConversationId).toMatch(/^[a-zA-Z0-9_-]{32,64}$/);
      expect(body.ConversationId).not.toBe(request().conversationId);
      expect(body.VisitorId).toBe(body.ConversationId);
      expect(body.SystemRole).toBe(request().systemPrompt);
      expect(body).toMatchObject({ Stream: 'enable', SearchNetwork: 'disable', WorkflowStatus: 'disable', EnableMultiIntent: false });
      expect(body).not.toHaveProperty('History');
      const payload = JSON.parse(body.Contents[0].Text);
      expect(payload.evidence).toEqual(request().evidence.evidence);
      expect(payload.policyRules).toEqual(request().evidence.policyRules);
      expect(payload.policyProfile).toEqual(request().evidence.policyProfile);
      expect(payload.stage).toBe(stages[index]);
      const riderContext = { stage: 'rider_brief', output: brief };
      const driverContext = { stage: 'driver_brief', output: driverBrief };
      expect(payload.priorOutputs).toEqual(index < 2 ? [] : index === 3
        ? [driverContext, riderContext] : [riderContext, driverContext]);
      expect(fetcher.mock.calls[index][0]).toBe(DEFAULT_ADP_CHAT_URL);
      expect(fetcher.mock.calls[index][1]!.redirect).toBe('error');
    }
    expect(JSON.stringify(provider)).not.toContain('synthetic-rider-key');
  });

  it('accepts one enclosing JSON fence without extracting fragments from prose', async () => {
    const { provider } = providerWith((body) => sse(completed(body, '```json\n' + JSON.stringify(answer) + '\n```') + done));
    expect(await provider.generate(request())).toEqual(answer);
  });

  it.each([
    'Here is the result: {"outcome":"human_review"}',
    '```json\n{}\n```\nAdditional explanation.',
    '{}\n{}',
    '[]',
    'null',
    '"please provide evidence"',
    '```json\n{"cutOff":',
  ])('rejects non-object, incomplete, or prose-wrapped model output: %s', async (text) => {
    const { provider } = providerWith((body) => sse(completed(body, text) + done));
    await expect(provider.generate(request())).rejects.toMatchObject({ code: 'ADP_ANSWER_INVALID' });
  });

  it.each(['missing-completion', 'missing-done', 'unfinished-frame'])('rejects truncated SSE: %s', async (type) => {
    const { provider } = providerWith((body) => sse(type === 'missing-completion' ? done : completed(body) + (type === 'unfinished-frame' ? done.trimEnd() : '')));
    await expect(provider.generate(request())).rejects.toMatchObject({ code: 'ADP_STREAM_INCOMPLETE' });
  });

  it.each(['user', 'failed', 'wrong-conversation', 'wrong-request', 'two-replies'])('rejects invalid final response metadata: %s', async (type) => {
    const { provider } = providerWith((body) => {
      const changes: Record<string, unknown> = type === 'user' ? { Role: 'user' }
        : type === 'failed' ? { Status: 'failed', StatusDesc: 'private-provider-text' }
          : type === 'wrong-conversation' ? { ConversationId: 'another-case' }
            : type === 'wrong-request' ? { ExtraInfo: { RequestId: 'another-request' } }
              : { Messages: [1, 2].map(() => ({ Type: 'reply', Status: 'success', Contents: [{ Type: 'text', Text: '{}' }] })) };
      return sse(completed(body, '{}', changes) + done);
    });
    await expect(provider.generate(request())).rejects.toThrow(/^ADP_/);
  });

  it('discards sensitive error bodies from both HTTP and SSE failures', async () => {
    const secret = 'synthetic-rider-key provider-private-details';
    for (const response of [
      new Response(secret, { status: 401 }),
      sse(event('error', { Error: { Code: 460001, Message: secret } })),
      new Response(secret, { headers: { 'Content-Type': 'application/json' } }),
    ]) {
      const { provider } = providerWith(() => response);
      const error = await provider.generate(request()).catch((value: unknown) => value);
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toContain(secret);
      expect(JSON.stringify(error)).not.toContain('synthetic-rider-key');
      expect(error).not.toHaveProperty('cause');
    }
  });

  it('sanitizes transport exceptions and aborts the other in-flight call on failure', async () => {
    const signals: AbortSignal[] = [];
    const { provider } = providerWith((_body, init) => {
      signals.push(init.signal!);
      if (signals.length === 1) return Promise.reject(new Error('synthetic-rider-key private transport error'));
      return new Promise<Response>(() => {});
    });
    const results = await Promise.allSettled([provider.generate(request('rider_brief')), provider.generate(request('driver_brief'))]);
    expect(results[0]).toMatchObject({ status: 'rejected', reason: { code: 'ADP_TRANSPORT_ERROR' } });
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { code: 'ADP_RUN_ABORTED' } });
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it('bounds hung transport calls even when the injected fetch ignores cancellation', async () => {
    vi.useFakeTimers();
    const { provider } = providerWith(() => new Promise<Response>(() => {}), { callTimeoutMs: 30, runTimeoutMs: 100 });
    const check = expect(provider.generate(request())).rejects.toMatchObject({ code: 'ADP_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(30);
    await check;
  });

  it('enforces the total run deadline across separate requests', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const { provider } = providerWith((body) => ++calls === 1 ? sse(completed(body) + done) : new Promise<Response>(() => {}), { callTimeoutMs: 100, runTimeoutMs: 60 });
    await provider.generate(request('rider_brief'));
    await vi.advanceTimersByTimeAsync(40);
    const check = expect(provider.generate(request('driver_brief'))).rejects.toMatchObject({ code: 'ADP_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(20);
    await check;
  });

  it('cancels a stalled response reader on timeout', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const { provider } = providerWith(() => new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'text/event-stream' } }), { callTimeoutMs: 20 });
    const check = expect(provider.generate(request())).rejects.toMatchObject({ code: 'ADP_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(20);
    await check;
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('allows the coordinator to stop outstanding calls after schema validation fails', async () => {
    const { provider, fetcher } = providerWith(() => new Promise<Response>(() => {}));
    const check = expect(provider.generate(request())).rejects.toMatchObject({ code: 'ADP_RUN_ABORTED' });
    provider.abort();
    await check;
    await expect(provider.generate(request())).rejects.toMatchObject({ code: 'ADP_RUN_ABORTED' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('caps a run at five requests without making a sixth network call', async () => {
    const { provider, fetcher } = providerWith((body) => sse(completed(body) + done));
    for (let i = 0; i < 5; i++) await provider.generate(request());
    await expect(provider.generate(request())).rejects.toMatchObject({ code: 'ADP_CALL_LIMIT' });
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('rejects an oversized request before sending any data', async () => {
    const { provider, fetcher } = providerWith((body) => sse(completed(body) + done));
    const input = request();
    input.systemPrompt = 'x'.repeat(256 * 1024);
    await expect(provider.generate(input)).rejects.toMatchObject({ code: 'ADP_INPUT_LIMIT' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('bounds aggregate input bytes across individually permitted requests', async () => {
    const { provider, fetcher } = providerWith((body) => sse(completed(body) + done));
    const input = request();
    input.systemPrompt = 'x'.repeat(220 * 1024);
    for (let i = 0; i < 4; i++) await provider.generate(input);
    await expect(provider.generate(input)).rejects.toMatchObject({ code: 'ADP_INPUT_LIMIT' });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it.each(['stream', 'answer'])('bounds %s bytes', async (type) => {
    const { provider } = providerWith((body) => sse(type === 'stream'
      ? ': ' + 'x'.repeat(2 * 1024 * 1024) + '\n\n'
      : completed(body, JSON.stringify({ text: 'x'.repeat(120 * 1024) })) + done));
    await expect(provider.generate(request())).rejects.toMatchObject({ code: 'ADP_RESPONSE_LIMIT' });
  });

  it('rejects reusing a provider instance for a different case', async () => {
    const { provider, fetcher } = providerWith((body) => sse(completed(body) + done));
    await provider.generate(request());
    const next = request();
    next.evidence.caseId = 'DIFFERENT-CASE';
    await expect(provider.generate(next)).rejects.toMatchObject({ code: 'ADP_INPUT_INVALID' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(['https://attacker.invalid/adp/v2/chat', 'http://wss.lke.tencentcloud.com/adp/v2/chat', DEFAULT_ADP_CHAT_URL + '?debug=1'])('never sends keys to an unapproved endpoint: %s', (chatUrl) => {
    expect(() => new AdpModelProvider({ ...keys, chatUrl })).toThrow('ADP_CONFIG_INVALID');
  });
});
