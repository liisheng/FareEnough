import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles/styles.css', ['styles/styles.css', 'text/css; charset=utf-8']],
  ['/styles/demo.css', ['styles/demo.css', 'text/css; charset=utf-8']],
  ['/scripts/app.js', ['scripts/app.js', 'text/javascript; charset=utf-8']],
]);
const server = createServer(async (request, response) => {
  const file = files.get(new URL(request.url, 'http://localhost').pathname);
  if (!file) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const content = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
    response.end(content);
  } catch {
    response.writeHead(500); response.end('Could not load preview');
  }
});
server.listen(3000, '127.0.0.1', () => console.log('FareEnough preview: http://127.0.0.1:3000'));
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
