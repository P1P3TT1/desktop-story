// Writes content/manifest.json: a list of every .md file under content/, grouped by folder.
// Browsers can't list a folder's contents, so the story reads this list to know what to load.
// Files whose name starts with "_" are skipped, so you can keep drafts next to published content.
//
// It also checks the story for mistakes, such as a "requires" that points to a file that doesn't
// exist, and prints a warning for each one. With --strict, any warning makes the build fail
// (the GitHub Pages deploy uses this, so a broken story never goes live).
//
// Usage: node tools/build-manifest.mjs [--strict]

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { asList, parseChoices, parseFrontMatter, parseRequirement } from '../js/content.js';

export const contentRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');

const byName = (a, b) => a.localeCompare(b, 'en', { numeric: true });

// Folders whose items can be password protected (the others have no place to show a lock).
const LOCKABLE = ['documents', 'photos', 'web/sites'];

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
  return { files, warnings: await checkStory(files) };
}

async function checkStory(files) {
  const warnings = [];
  const entries = new Map();

  try {
    JSON.parse(await readFile(join(contentRoot, 'story.json'), 'utf8'));
  } catch (error) {
    warnings.push(`story.json: not valid JSON (${error.message})`);
  }

  for (const [folder, names] of Object.entries(files)) {
    for (const name of names) {
      const { data } = parseFrontMatter(await readFile(join(contentRoot, folder, name), 'utf8'));
      const id = `${folder}/${name.replace(/\.md$/, '')}`;
      entries.set(id, { ...data, id, folder });
    }
  }

  for (const entry of entries.values()) {
    const where = `content/${entry.id}.md`;
    const section = entry.folder.split('/')[0];

    for (const requirement of asList(entry.requires)) {
      const { id, choice } = parseRequirement(requirement);
      const target = entries.get(id);
      if (!target) {
        warnings.push(`${where}: requires "${requirement}", but there is no content/${id}.md`);
      } else if (choice && !parseChoices(target.choices).some(c => c.value === choice)) {
        warnings.push(`${where}: requires the choice "${choice}", but content/${id}.md has no such choice`);
      }
    }
    if (entry.opens && !files[`${entry.folder}/${entry.opens}`]) {
      warnings.push(`${where}: opens "${entry.opens}", but content/${entry.folder}/${entry.opens}/ has no .md files`);
    }
    if (entry.password && !LOCKABLE.some(folder => entry.folder.startsWith(folder))) {
      warnings.push(`${where}: "password" only works in ${LOCKABLE.join(', ')}`);
    }
    if (entry.choices && section !== 'emails') {
      warnings.push(`${where}: "choices" only works on emails`);
    }
    if (entry.delay !== undefined && typeof entry.delay !== 'number') {
      warnings.push(`${where}: delay should be a number of seconds, not "${entry.delay}"`);
    }
    if (section === 'endings' && !asList(entry.requires).length) {
      warnings.push(`${where}: an ending needs "requires", or it plays as soon as the story starts`);
    }
  }
  return warnings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { files, warnings } = await buildManifest();
  for (const [folder, names] of Object.entries(files)) {
    console.log(`${folder.padEnd(14)} ${names.length} file(s)`);
  }
  console.log('Wrote content/manifest.json');
  if (warnings.length) {
    console.warn(`\n${warnings.length} problem(s) found:\n${warnings.map(w => `  - ${w}`).join('\n')}`);
    if (process.argv.includes('--strict')) process.exit(1);
  }
}
