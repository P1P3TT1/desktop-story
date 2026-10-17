// Local preview server. Serves the project on http://localhost:8000 and rebuilds
// content/manifest.json every time the page loads, so new content files show up on refresh.
//
// Usage: node tools/serve.mjs        (or set PORT to use another port)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from './build-manifest.mjs';

const siteRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const port = Number(process.env.PORT) || 8000;
let lastWarnings = '';

// Rebuilds the manifest and prints story problems, but only when they change (not on every refresh).
async function rebuild() {
  const { warnings } = await buildManifest();
  const text = warnings.join('\n');
  if (text !== lastWarnings) {
    console.warn(warnings.length
      ? `\n${warnings.length} problem(s) in the story:\n${warnings.map(w => `  - ${w}`).join('\n')}`
      : '\nNo problems found in the story.');
    lastWarnings = text;
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path.endsWith('/')) path += 'index.html';

  const file = normalize(join(siteRoot, path));
  if (!file.startsWith(siteRoot + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    if (path === '/content/manifest.json') await rebuild();
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(error);
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Desktop Story running at http://localhost:${port}  (Ctrl+C to stop)`);
});
