import fs from 'fs';

const LOG_PATH = '/Users/sofie.garden/code/demos/bakeoff/.cursor/debug-8f0f4b.log';
const ENDPOINT = 'http://127.0.0.1:7513/ingest/1a37cc79-5ffb-4bd6-9406-4a4cf26c7d02';

/** Best-effort debug log for short-lived hook processes. */
export function agentLog({ hypothesisId, location, message, data = {}, runId }) {
  const payload = {
    sessionId: '8f0f4b',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  if (runId) payload.runId = runId;
  try {
    fs.appendFileSync(LOG_PATH, `${JSON.stringify(payload)}\n`);
  } catch {
    // ignore
  }
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8f0f4b' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
