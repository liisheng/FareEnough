const MAX_BYTES = 2 * 1024 * 1024;

const eventNames = new Set(['response.created','response.started','response.in_progress','response.delta','response.completed','response.failed','response.cancelled','response.output_text.delta','response.output_text.done','response.message.delta','response.message.completed','response.thinking.delta','response.reasoning.delta','message.delta','message.completed','request.ack','request_ack','ack','error','done','ping','pong','heartbeat','workflow.status','response.processing','message.added','message.processing','message.done','content.added','text.delta','text.replace','quote_info.added','reference.added']);
const statuses = new Set(['success','processing','failed','failure','error','pending','running','completed','cancelled','canceled','timeout','interrupted','done','accepted']);
const messageTypes = new Set(['reply','thought','reasoning','tool_call','function_call','tool','workflow','text','knowledge','knowledge_retrieval']);
const label = (value, allowed) => typeof value!=='string' ? null : allowed.has(value) ? value : '[unrecognized]';
// Tencent ADP v2 HTTP SSE §2.13/§4; unknown upstream codes are never copied.
// https://intl.cloud.tencent.com/document/product/1254/81449
const errorCodes = new Set([400,460001,460002,460004,460006,460007,460008,460009,460010,460011,460020,460021,460022,460023,460024,460025,460031,460032,460033,460034,460035,460036,460037,460038,460501,4505004]);
const MAX_METADATA_ITEMS = 64;

/** Allowlisted metadata only; never echoed questions, thoughts or error prose. */
export function protocolSummary(sse, { bytes = Buffer.byteLength(sse,'utf8'), eof = false, secrets = [], requestId } = {}) {
  const protocol = { bytesReceived:bytes,streamEnded:eof,frameCount:0,eventNames:[],types:[],responseStatuses:[],messages:[],errorCodes:[],doneObserved:false,completedObserved:false,unparseableFrames:0,truncatedFrame:false,
    ackStatuses:[],requestIds:[],traceIds:[],eventTimeline:[],eventTimelineTruncated:false,acknowledgedWithoutCompletion:false };
  const unique = (list,value) => { if(value!==null && !list.includes(value) && list.length<MAX_METADATA_ITEMS)list.push(value); };
  const containsSecret = value => secrets.some(secret=>typeof secret==='string' && secret && value.includes(secret));
  const safeCode = value => {
    if(value===undefined || value===null)return null;
    const text=String(value);
    if(!containsSecret(text) && /^\d{1,8}$/.test(text) && errorCodes.has(Number(text)))return text;
    return '[redacted]';
  };
  const safeTiming = (value,max) => {
    if(typeof value!=='number' && !(typeof value==='string' && /^\d{1,16}$/.test(value)))return null;
    const number=Number(value);
    return Number.isSafeInteger(number) && number>=0 && number<=max ? number : null;
  };
  const collectCorrelation = info => {
    if(!info || typeof info!=='object')return;
    // Request IDs must match the locally generated UUID, not arbitrary upstream text.
    if(typeof requestId==='string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(requestId)
      && info.RequestId===requestId && !containsSecret(requestId))unique(protocol.requestIds,requestId);
    const trace=info.TraceId;
    // Documented trace hash, optionally followed by ADP's timestamped record ID.
    if(typeof trace==='string' && /^[a-f\d]{32}(?: \/ [A-Za-z\d]{1,16}_\d{8}_\d{6}_\d{3}_[A-Za-z\d]{1,32})?$/i.test(trace)
      && !containsSecret(trace))unique(protocol.traceIds,trace);
  };
  const frames=sse.split(/\r?\n\r?\n/);
  const completeCount=frames.length-1;
  protocol.truncatedFrame=frames.at(-1).trim().length>0;
  for(const frame of frames.slice(0,completeCount)) {
    if(!frame.trim())continue;
    protocol.frameCount++;
    const lines=frame.split(/\r?\n/);
    const event=lines.find(line=>line.startsWith('event:'))?.slice(6).trim().replace(/^"(.*)"$/,'$1');
    const eventLabel=label(event,eventNames);
    unique(protocol.eventNames,eventLabel);
    const timeline={event:eventLabel};
    if(protocol.eventTimeline.length<MAX_METADATA_ITEMS)protocol.eventTimeline.push(timeline);
    else protocol.eventTimelineTruncated=true;
    const data=lines.filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n');
    if(event==='done' && data==='[DONE]'){protocol.doneObserved=true;continue;}
    if(!data)continue;
    let payload;try{payload=JSON.parse(data);}catch{protocol.unparseableFrames++;continue;}
    unique(protocol.types,label(payload?.Type,eventNames));
    if(payload?.Type==='response.completed')protocol.completedObserved=true;
    unique(protocol.responseStatuses,label(payload?.Response?.Status,statuses));
    unique(protocol.ackStatuses,label(payload?.RequestAck?.Status,statuses));
    for(const info of [payload?.RequestAck?.ExtraInfo,payload?.Response?.ExtraInfo,payload?.Error])collectCorrelation(info);
    const timing=payload?.RequestAck?.ExtraInfo??payload?.Response?.ExtraInfo??payload?.Error;
    const elapsedMs=safeTiming(timing?.Elapsed,86_400_000);
    const startTimeMs=safeTiming(timing?.StartTime,8_640_000_000_000_000);
    if(elapsedMs!==null)timeline.elapsedMs=elapsedMs;
    if(startTimeMs!==null)timeline.startTimeMs=startTimeMs;
    const errors=[payload?.Error,payload?.Response?.Error,payload?.RequestAck?.Error];
    if(payload?.Type==='error')errors.push(payload);
    for(const error of errors)if(error && typeof error==='object')unique(protocol.errorCodes,safeCode(error.Code??error.code));
    for(const message of Array.isArray(payload?.Response?.Messages)?payload.Response.Messages:[]) {
      const metadata={type:label(message?.Type,messageTypes),status:label(message?.Status,statuses)};
      if(!protocol.messages.some(item=>item.type===metadata.type&&item.status===metadata.status)&&protocol.messages.length<32)protocol.messages.push(metadata);
      if(message?.Error && typeof message.Error==='object')unique(protocol.errorCodes,safeCode(message.Error.Code??message.Error.code));
    }
  }
  protocol.acknowledgedWithoutCompletion=protocol.ackStatuses.includes('success') && protocol.doneObserved && !protocol.completedObserved;
  return protocol;
}

/** Evaluation-only response envelope: preserve final text, including plain language.
 * Production ADP JSON/schema behavior is deliberately unchanged. No reasoning or
 * credentials are recorded. Original final SSE metadata is still validated by ADP.
 */
export function envelopeFinalText(sse, capture) {
  return sse.split(/\r?\n\r?\n/).map(frame => {
    const lines = frame.split(/\r?\n/);
    const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
    let payload;
    try { payload = JSON.parse(data); } catch { return frame; }
    if (payload?.Type !== 'response.completed' || !Array.isArray(payload.Response?.Messages)) return frame;
    const replies = payload.Response.Messages.filter(message => message?.Type === 'reply');
    if (replies.length !== 1 || !Array.isArray(replies[0].Contents) || !replies[0].Contents.length
      || replies[0].Contents.some(item => item.Type !== 'text' || typeof item.Text !== 'string')) return frame;
    const answer = replies[0].Contents.map(item => item.Text).join('');
    capture.finalText = answer;
    replies[0].Contents = [{ Type: 'text', Text: JSON.stringify({ evaluationFinalText: answer }) }];
    return [...lines.filter(line => !line.startsWith('data:')), 'data: ' + JSON.stringify(payload)].join('\n');
  }).join('\n\n');
}

export function createManualPromptFetch(prompt, capture, fetchImpl = globalThis.fetch) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    // The provider uses an internal nonempty snapshot only to enter its transport.
    // None of that shim, responseContract, or evaluator expectations is transmitted.
    body.Contents = [{ Type: 'text', Text: prompt }];
    const serialized = JSON.stringify(body);
    if (Buffer.byteLength(serialized, 'utf8') > 256 * 1024) throw Error('EVALUATION_INPUT_LIMIT');
    const response = await fetchImpl(url, { ...init, body: serialized });
    capture.protocol={httpStatus:response.status,contentType:response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream')?'text/event-stream':'other',...protocolSummary('',{secrets:[body.AppKey],requestId:body.RequestId})};
    if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream') || !response.body) return response;
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0, text = '', eof = false;
    const update = () => {capture.protocol={httpStatus:response.status,contentType:'text/event-stream',...protocolSummary(text,{bytes,eof,secrets:[body.AppKey],requestId:body.RequestId})};};
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {eof=true;break;}
        bytes += chunk.value.byteLength;
        if (bytes > MAX_BYTES) throw Error('EVALUATION_RESPONSE_LIMIT');
        text += decoder.decode(chunk.value, { stream: true });
        update();
      }
      text += decoder.decode();
    } finally { update(); await reader.cancel().catch(() => {}); }
    return new Response(envelopeFinalText(text, capture), { status: response.status, headers: { 'Content-Type': 'text/event-stream' } });
  };
}
