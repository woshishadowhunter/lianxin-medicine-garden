const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  'miniprogram/app.json',
  'miniprogram/pages/index',
  'miniprogram/pages/bind',
  'miniprogram/pages/submit',
  'miniprogram/pages/records',
  'miniprogram/pages/garden',
  'miniprogram/pages/herb-detail',
  'miniprogram/pages/growth-archive',
  'miniprogram/pages/profile',
  'miniprogram/pages/record-detail',
  'miniprogram/pages/annual-showcase',
  'miniprogram/components/record-card',
  'miniprogram/utils/photo.js',
];
const FORBIDDEN = /连心药园|我的药园|药材|药草|中草药/g;

function sourceFiles(target) {
  const absolute = path.join(ROOT, target);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  return fs.readdirSync(absolute)
    .filter(name => /\.(js|json|wxml)$/.test(name))
    .map(name => path.join(absolute, name));
}

test('family-facing source uses generic plant language', () => {
  const violations = [];
  TARGETS.flatMap(sourceFiles).forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(FORBIDDEN) || [];
    if (matches.length) {
      violations.push(`${path.relative(ROOT, file)}: ${[...new Set(matches)].join(', ')}`);
    }
  });

  assert.deepEqual(violations, []);
});
