// Local preview server with optional source watching. Run with npm run dev.
import { createServer } from 'node:http';
import { createReadStream, statSync, watch } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { buildSite, output, root } from './build.mjs';
import { securityHeaders } from './security-headers.mjs';

const { values } = parseArgs({ options: { watch: { type: 'boolean' }, port: { type: 'string', default: '3000' }, 'csp-enforce': { type: 'boolean' } } });
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Choose a port from 1 to 65535.');
buildSite();
let headers = securityHeaders(output, { reportOnly: !values['csp-enforce'] });

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive'
};

const server = createServer((request, response) => {
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = resolve(output, '.' + pathname);
    if (file !== output && !file.startsWith(output + sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error('Not a file');
    const extension = extname(file).toLowerCase();
    response.writeHead(200, {
      'Content-Type': types[extension] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store'
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Page not found');
  }
});

const watchers = [];
let rebuildTimer;
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is in use. Choose another: npm run dev -- --port ${port + 1}`
    : error.message);
  for (const watcher of watchers) watcher.close();
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Black Gold: http://127.0.0.1:${port}`);
  if (!values.watch) return;
  for (const directory of ['src', 'public']) {
    const watcher = watch(join(root, directory), { recursive: true }, () => {
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(() => {
        try {
          buildSite();
          headers = securityHeaders(output, { reportOnly: !values['csp-enforce'] });
          console.log('Updated. Refresh your browser.');
        } catch (error) {
          console.error('Build failed:', error.message);
        }
      }, 200);
    });
    watcher.on('error', error => console.error('Watch error:', error.message));
    watchers.push(watcher);
  }
  console.log('Watching src/ and public/. Edit a source file, then refresh the browser. Ctrl+C stops the server.');
});

function stop() {
  clearTimeout(rebuildTimer);
  for (const watcher of watchers) watcher.close();
  server.close();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
