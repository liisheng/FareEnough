import { describe, expect, it, vi } from 'vitest';
import { AdpModelProvider } from '../src/providers/adp-provider.js';
import { createManualPromptFetch, protocolSummary } from '../scripts/manual-prompt-transport.mjs';

const requestId = '1b9c0b03-dc83-47ac-8394-b366e3ea67ef';
const traceId = '77fc0a9ce9ba9f3b511ac28ad05b5bab / p9G_20251220_225838_112_Pr4FhDcR';
const done = 'event: done\ndata: [DONE]\n\n';
const frame = (type: string, fields: Record<string, unknown> = {}) =>
  `event: ${type}\ndata: ${JSON.stringify({ Type: type, ...fields })}\n\n`;

describe('evaluation-only ADP diagnostic metadata', () => {
  it('identifies an acknowledged stream without completion without saving echoed questions', () => {
    const stream = frame('request_ack', { RequestAck: {
      Status: 'success', StatusDesc: 'private status text',
      ExtraInfo: { RequestId: requestId, TraceId: traceId, Elapsed: '18', StartTime: '1766242718000' },
      Messages: [{ Type: 'question', Contents: [{ Type: 'text', Text: 'private input' }] }],
    } }) + done;
    const result = protocolSummary(stream, { eof: true, requestId });
    expect(result).toMatchObject({
      frameCount: 2, ackStatuses: ['success'], requestIds: [requestId], traceIds: [traceId],
      doneObserved: true, completedObserved: false, acknowledgedWithoutCompletion: true,
      eventTimeline: [
        { event: 'request_ack', elapsedMs: 18, startTimeMs: 1766242718000 },
        { event: 'done' },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/private status text|private input/);
  });

  it('does not diagnose failure from acknowledgment before completion has had a chance to arrive', () => {
    const ack = frame('request_ack', { RequestAck: { Status: 'success' } });
    expect(protocolSummary(ack).acknowledgedWithoutCompletion).toBe(false);
    const complete = frame('response.completed', { Response: { Status: 'success' } });
    expect(protocolSummary(ack + complete + done, { eof: true }).acknowledgedWithoutCompletion).toBe(false);
  });

  it('retains only documented numeric error codes, never arbitrary upstream strings', () => {
    const values = [460020, '460032', 'ResourceInsufficient', 460999, 'synthetic-secret', { private: 'detail' }];
    const stream = values.map(Code => frame('error', { Error: { Code, Message: 'private explanation' } })).join('');
    const result = protocolSummary(stream, { secrets: ['synthetic-secret'] });
    expect(result.errorCodes).toEqual(['460020', '460032', '[redacted]']);
    expect(JSON.stringify(result)).not.toMatch(/ResourceInsufficient|460999|synthetic-secret|private explanation|detail/);
  });

  it('validates correlation fields against local IDs and strict trace syntax, and redacts matching secrets', () => {
    const otherId = '8f15c1ab-4a56-4fc0-9d26-e78f76c3d048';
    const secret = 'a'.repeat(32); // A credential can accidentally resemble a valid trace hash.
    const stream = frame('request_ack', { RequestAck: {
      Status: 'private status', ExtraInfo: { RequestId: otherId, TraceId: secret },
    } }) + frame('response.processing', { Response: {
      ExtraInfo: { RequestId: requestId, TraceId: 'private trace prose' },
      Procedures: [{ Agent: { Input: 'private input', Output: 'private reasoning', TraceId: traceId } }],
    } }) + frame('error', { Error: { Code: 460020, RequestId: requestId, TraceId: traceId } });
    const result = protocolSummary(stream, { requestId, secrets: [secret] });
    expect(result.ackStatuses).toEqual(['[unrecognized]']);
    expect(result.requestIds).toEqual([requestId]);
    expect(result.traceIds).toEqual([traceId]);
    expect(JSON.stringify(result)).not.toMatch(/private|aaaaaaaa|8f15c1ab/);
    expect(protocolSummary(stream, { secrets: [secret] }).requestIds).toEqual([]);
  });

  it('recognizes documented event labels while rejecting text as timing metadata', () => {
    const names = ['response.processing', 'message.added', 'content.added', 'text.delta', 'text.replace', 'message.processing', 'message.done'];
    const stream = names.map(name => frame(name, { Response: { ExtraInfo: { Elapsed: '1e3', StartTime: -1 } }, Text: 'private delta' })).join('')
      + frame('private-event-name', { Response: { ExtraInfo: { Elapsed: 86_400_001, StartTime: 'private time' } } });
    const result = protocolSummary(stream);
    expect(result.eventNames).toEqual([...names, '[unrecognized]']);
    expect(result.eventTimeline.every((event: Record<string, unknown>) => !('elapsedMs' in event) && !('startTimeMs' in event))).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private');
  });

  it('bounds the timeline and correlation collections while retaining the total frame count', () => {
    const stream = Array.from({ length: 100 }, (_, index) => frame('response.processing', {
      Response: { ExtraInfo: { RequestId: requestId, TraceId: index.toString(16).padStart(32, '0'), Elapsed: index } },
    })).join('');
    const result = protocolSummary(stream, { requestId });
    expect(result.frameCount).toBe(100);
    expect(result.eventTimeline).toHaveLength(64);
    expect(result.traceIds).toHaveLength(64);
    expect(result.requestIds).toEqual([requestId]);
    expect(result.eventTimelineTruncated).toBe(true);
  });

  it('captures incomplete-stream diagnostics without changing production rejection or retry behavior', async () => {
    const capture: { protocol?: any; finalText?: string } = {};
    const upstream = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      return new Response(frame('request_ack', { RequestAck: {
        Status: 'success', ExtraInfo: { RequestId: body.RequestId, TraceId: traceId },
        Messages: [{ Contents: [{ Text: body.AppKey + ' private input' }] }],
      } }) + done, { headers: { 'Content-Type': 'text/event-stream' } });
    });
    const provider = new AdpModelProvider({
      riderAppKey: 'synthetic-secret', driverAppKey: 'synthetic-driver', judgeAppKey: 'synthetic-judge',
      fetch: createManualPromptFetch('private input', capture, upstream),
    });
    await expect(provider.generate({
      stage: 'rider_brief', conversationId: 'unused', systemPrompt: 'Assess supplied facts.',
      evidence: { caseId: 'case', evidence: [{ id: 'E1', kind: 'dispute', data: {} }], policyRules: [{ id: 'P1', text: 'Review uncertainty.', value: 0 }] },
      priorOutputs: [],
    })).rejects.toMatchObject({ code: 'ADP_STREAM_INCOMPLETE' });
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(capture.protocol).toMatchObject({ ackStatuses: ['success'], acknowledgedWithoutCompletion: true });
    expect(capture.protocol.requestIds).toHaveLength(1);
    expect(capture.finalText).toBeUndefined();
    expect(JSON.stringify(capture.protocol)).not.toMatch(/synthetic-secret|private input/);
  });
});
