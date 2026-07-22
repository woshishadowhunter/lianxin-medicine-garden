const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { validateProject } = require('../scripts/validate-project');

const root = resolve(__dirname, '..');

test('all checked JavaScript and JSON files are valid', () => {
  const result = validateProject(root);

  assert.ok(result.javascriptFiles > 40, `checked only ${result.javascriptFiles} JavaScript files`);
  assert.ok(result.jsonFiles > 20, `checked only ${result.jsonFiles} JSON files`);
});

test('demo generator emits isolated synthetic records', () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'lianxin-demo-'));

  try {
    const generated = spawnSync(
      process.execPath,
      [join(root, 'scripts', 'generate-demo-data.js'), '5'],
      { cwd: outputRoot, encoding: 'utf8' },
    );
    assert.equal(generated.status, 0, generated.stderr);

    const dataset = JSON.parse(
      readFileSync(join(outputRoot, 'docs', 'demo-data', 'demo-dataset.json'), 'utf8'),
    );
    assert.equal(dataset.families.length, 5);
    assert.ok(dataset.families.every((family) => /^D\d{3}$/.test(family.family_code)));
    assert.ok(dataset.families.every((family) => family.openid === ''));
    assert.ok(dataset.families.every((family) => family.contact_name.startsWith('Demo Family ')));
    assert.ok(dataset.care_records.every((record) => record.photos[0].startsWith('cloud://demo/')));
    assert.match(dataset.note, /Synthetic demo data/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
