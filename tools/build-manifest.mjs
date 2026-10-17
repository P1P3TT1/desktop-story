// Writes content/manifest.json: a list of every .md file under content/, grouped by folder.
// Browsers can't list a folder's contents, so the story reads this list to know what to load.
// Files whose name starts with "_" are skipped, so you can keep drafts next to published content.
//
// Usage: node tools/build-manifest.mjs

import { readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const contentRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');

const byName = (a, b) => a.localeCompare(b, 'en', { numeric: true });

async function collect(dir, files) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      await collect(join(dir, entry.name), files);
    } else if (entry.name.endsWith('.md') && !entry.name.startsWith('_')) {
      const folder = relative(contentRoot, dir).split(sep).join('/');
      (files[folder] ??= []).push(entry.name);
    }
  }
  return files;
}

export async function buildManifest() {
  const found = await collect(contentRoot, {});
  const files = Object.fromEntries(
    Object.keys(found).sort(byName).map(folder => [folder, found[folder].sort(byName)])
  );
  await writeFile(join(contentRoot, 'manifest.json'), JSON.stringify({ files }, null, 2) + '\n');
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await buildManifest();
  for (const [folder, names] of Object.entries(files)) {
    console.log(`${folder.padEnd(12)} ${names.length} file(s)`);
  }
  console.log('Wrote content/manifest.json');
}
