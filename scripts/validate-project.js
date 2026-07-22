#!/usr/bin/env node

const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');
const { spawnSync } = require('node:child_process');

function walk(target, predicate, output = []) {
  const stat = statSync(target);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(target)) {
      walk(join(target, entry), predicate, output);
    }
  } else if (predicate(target)) {
    output.push(target);
  }
  return output;
}

function validateProject(root) {
  const sourceRoots = ['miniprogram', 'cloudfunctions', 'scripts'].map((entry) => join(root, entry));
  const javascriptFiles = sourceRoots.flatMap((target) => walk(target, (file) => file.endsWith('.js')));
  const jsonFiles = sourceRoots.flatMap((target) => walk(target, (file) => file.endsWith('.json')));
  jsonFiles.push(join(root, 'project.config.json'), join(root, 'package.json'));

  const failures = [];
  for (const file of javascriptFiles) {
    const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (checked.status !== 0) {
      failures.push(`${relative(root, file)}: ${checked.stderr.trim()}`);
    }
  }

  for (const file of jsonFiles) {
    try {
      JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      failures.push(`${relative(root, file)}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Project validation failed:\n${failures.join('\n')}`);
  }

  return { javascriptFiles: javascriptFiles.length, jsonFiles: jsonFiles.length };
}

if (require.main === module) {
  const result = validateProject(process.cwd());
  console.log(`Validated ${result.javascriptFiles} JavaScript files and ${result.jsonFiles} JSON files.`);
}

module.exports = { validateProject };
