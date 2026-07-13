# All-Plants Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Mini Program from herb-only planting to preset and family-created plants across six categories while preserving legacy records, photo workflows, and points.

**Architecture:** Add a small pure plant-domain layer for normalization and validation, a permission-checked `plantManager` cloud function for task creation, and additive plant fields alongside legacy `herb_*` fields. Keep existing page routes and collections stable, then replace user-facing herb semantics with a photo-led field-notebook interface.

**Tech Stack:** WeChat Mini Program native WXML/WXSS/JavaScript, WeChat Cloud Development, Node.js built-in test runner, PNG/WebP assets.

## Global Constraints

- Preserve all existing collections, routes, `herb_*` fields, records, photos, and points.
- Support `flower`, `foliage`, `vegetable`, `fruit`, `herb`, and `other` plant categories.
- Support preset catalog selection and family-owned custom plants.
- Award 10 points only after a photo-backed care record is confirmed.
- Do not add third-party frontend dependencies or SVG assets.
- Use the confirmed B2 “自然观察手账” visual direction.

---

### Task 1: Plant Domain Model and Test Harness

**Files:**
- Create: `package.json`
- Create: `tests/plant-domain.test.js`
- Create: `miniprogram/utils/plant.js`
- Modify: `miniprogram/utils/constants.js`

**Interfaces:**
- Produces: `normalizePlantTask(task)`, `normalizePlantRecord(record)`, `validatePlantInput(input, today)`, `getPlantDisplayName(value)`, `PLANT_CATEGORIES`, `PRESET_PLANTS`, `PLANT_STATUS`.
- Consumes: legacy `herb_code`, `herb_name`, and `herb_icon_name` fields.

- [ ] **Step 1: Add the failing domain tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlantTask, validatePlantInput } = require('../miniprogram/utils/plant');

test('normalizes a legacy herb task without losing its identity', () => {
  const task = normalizePlantTask({ herb_code: 'bh', herb_name: '薄荷', plant_date: '2026-04-20' });
  assert.equal(task.plant_code, 'bh');
  assert.equal(task.plant_name, '薄荷');
  assert.equal(task.plant_category, 'herb');
  assert.equal(task.source, 'legacy');
});

test('preserves generic fields on a new plant task', () => {
  const task = normalizePlantTask({ plant_code: 'rose', plant_name: '月季', plant_category: 'flower', growth_days: 120, source: 'preset' });
  assert.equal(task.plant_name, '月季');
  assert.equal(task.plant_category, 'flower');
  assert.equal(task.growth_days, 120);
});

test('rejects future planting dates and invalid categories', () => {
  assert.throws(() => validatePlantInput({ name: '月季', category: 'tree', plantDate: '2026-07-01', growthDays: 120 }, '2026-07-12'), /类别/);
  assert.throws(() => validatePlantInput({ name: '月季', category: 'flower', plantDate: '2026-07-13', growthDays: 120 }, '2026-07-12'), /日期/);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/plant-domain.test.js`

Expected: FAIL because `miniprogram/utils/plant.js` does not exist.

- [ ] **Step 3: Implement the pure plant-domain API and generic constants**

```js
const CATEGORY_VALUES = ['flower', 'foliage', 'vegetable', 'fruit', 'herb', 'other'];

function normalizePlantTask(task = {}) {
  return {
    ...task,
    plant_code: task.plant_code || task.herb_code || '',
    plant_name: task.plant_name || task.herb_name || '未命名植物',
    plant_category: task.plant_category || 'herb',
    growth_days: Number(task.growth_days || 0),
    source: task.source || 'legacy',
    cover_image: task.cover_image || '',
  };
}

function validatePlantInput(input, today) {
  const name = String(input.name || '').trim();
  if (!name || name.length > 30) throw new Error('植物名称须为 1 至 30 个字符');
  if (!CATEGORY_VALUES.includes(input.category)) throw new Error('请选择有效的植物类别');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.plantDate) || input.plantDate > today) throw new Error('种植日期不能晚于今天');
  const growthDays = Number(input.growthDays || 0);
  if (!Number.isInteger(growthDays) || growthDays < 0 || growthDays > 3650) throw new Error('成长周期须为 0 至 3650 天');
  return { name, category: input.category, plantDate: input.plantDate, growthDays };
}
```

Extend `constants.js` with category labels and a mixed preset catalog while exporting old names as compatibility aliases.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/plant-domain.test.js`

Expected: all plant-domain tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json tests/plant-domain.test.js miniprogram/utils/plant.js miniprogram/utils/constants.js
git commit -m "Add generic plant domain model"
```

### Task 2: Permission-Checked Plant Creation Cloud Function

**Files:**
- Create: `cloudfunctions/plantManager/package.json`
- Create: `cloudfunctions/plantManager/config.json`
- Create: `cloudfunctions/plantManager/domain.js`
- Create: `cloudfunctions/plantManager/index.js`
- Create: `tests/plant-manager-domain.test.js`

**Interfaces:**
- Produces cloud actions: `listCatalog`, `createPresetTask`, `createCustomTask`.
- Produces pure helpers: `validateCreateInput(input, today)`, `buildTaskDocument(input, context)`, `createTaskId(familyCode, requestId)`.
- Consumes `family_members`, legacy `families.openid`, `plants`, and `planting_tasks`.

- [ ] **Step 1: Write failing task-creation tests**

```js
test('builds compatibility fields for a custom flower', () => {
  const task = buildTaskDocument({ name: '月季', category: 'flower', plantDate: '2026-07-01', growthDays: 120 }, { familyCode: 'F001', openid: 'o1', source: 'custom', plantCode: 'custom_1' });
  assert.equal(task.plant_name, '月季');
  assert.equal(task.herb_name, '月季');
  assert.equal(task.plant_category, 'flower');
  assert.equal(task.owner_openid, 'o1');
});

test('creates a deterministic task id for retries', () => {
  assert.equal(createTaskId('F001', 'request-1'), createTaskId('F001', 'request-1'));
  assert.notEqual(createTaskId('F001', 'request-1'), createTaskId('F001', 'request-2'));
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/plant-manager-domain.test.js`

Expected: FAIL because the domain module is missing.

- [ ] **Step 3: Implement validation, deterministic IDs, access checks, catalog listing, and task creation**

`createPresetTask` must read the selected plant from `plants`; `createCustomTask` must validate client fields. Both actions call `assertFamilyAccess`, use `requestId`, and write generic plus compatibility fields with `doc(taskId).set()`.

```js
switch (event.action) {
  case 'listCatalog': return { success: true, data: await listCatalog(event) };
  case 'createPresetTask': return { success: true, data: await createPresetTask(event, openid) };
  case 'createCustomTask': return { success: true, data: await createCustomTask(event, openid) };
  default: throw new Error('未知植物管理操作');
}
```

- [ ] **Step 4: Run tests and syntax checks**

Run: `node --test tests/plant-manager-domain.test.js && node --check cloudfunctions/plantManager/index.js`

Expected: tests pass and syntax check exits 0.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/plantManager tests/plant-manager-domain.test.js
git commit -m "Add secure plant task creation"
```

### Task 3: Secure Generic Care Submission and Points Descriptions

**Files:**
- Create: `cloudfunctions/submitRecord/domain.js`
- Create: `tests/submit-record-domain.test.js`
- Modify: `cloudfunctions/submitRecord/index.js`
- Modify: `cloudfunctions/auditReview/index.js`
- Modify: `cloudfunctions/pointsBank/index.js`

**Interfaces:**
- Produces: `buildRecordDocument(event, task)`, `getPlantName(value)`.
- Consumes task ID, authenticated openid, task ownership, photos, care type, and normalized plant fields.

- [ ] **Step 1: Write failing submission tests**

```js
test('builds a generic record from the server task', () => {
  const record = buildRecordDocument({ task_id: 't1', care_type: 'watering', photos: ['cloud://photo'], care_date: '2026-07-12' }, { family_code: 'F001', plant_code: 'rose', plant_name: '月季', plant_category: 'flower' });
  assert.equal(record.family_code, 'F001');
  assert.equal(record.plant_name, '月季');
  assert.equal(record.herb_name, '月季');
});

test('rejects submissions without a photo', () => {
  assert.throws(() => buildRecordDocument({ task_id: 't1', care_type: 'watering', photos: [], care_date: '2026-07-12' }, { family_code: 'F001', plant_name: '月季' }), /照片/);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/submit-record-domain.test.js`

Expected: FAIL because the domain module is missing.

- [ ] **Step 3: Implement server-derived record fields and access validation**

The cloud function must ignore client-supplied family and plant names, load `planting_tasks.doc(task_id)`, verify current openid can access that family, require one to nine photos, then write both `plant_*` and `herb_*` fields.

Change points descriptions to:

```js
const plantName = record.plant_name || record.herb_name || '植物';
const description = amount > 0 ? `${plantName}养护记录审核通过` : `${plantName}养护积分冲正`;
```

Rename reward descriptions so every rule applies to any plant category.

- [ ] **Step 4: Run focused and regression tests**

Run: `node --test tests/submit-record-domain.test.js tests/plant-manager-domain.test.js tests/plant-domain.test.js`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/submitRecord cloudfunctions/auditReview/index.js cloudfunctions/pointsBank/index.js tests/submit-record-domain.test.js
git commit -m "Generalize secure care records and points"
```

### Task 4: Seed Data and Optional Legacy Migration

**Files:**
- Modify: `cloudfunctions/init-database/index.js`
- Modify: `scripts/init-database.js`
- Create: `cloudfunctions/migratePlants/package.json`
- Create: `cloudfunctions/migratePlants/config.json`
- Create: `cloudfunctions/migratePlants/index.js`
- Create: `tests/plant-seed.test.js`

**Interfaces:**
- Produces mixed `PLANTS` seed data and a repeatable `migratePlants` cloud action.
- Consumes legacy `herbs`, `planting_tasks`, and `care_records`.

- [ ] **Step 1: Write a failing seed coverage test**

The test requires at least one preset in each category, unique codes, the original eleven herbs, and compatibility fields on generated tasks.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/plant-seed.test.js`

Expected: FAIL because mixed plant seed data is not exported.

- [ ] **Step 3: Add mixed presets and the idempotent migration**

Seed flowers, foliage plants, vegetables, fruits, herbs, and other plants into `plants`. The migration updates only missing `plant_*` fields, processes at most 100 documents per invocation, and returns `{ processed, remaining, cursor }`.

- [ ] **Step 4: Run tests and syntax checks**

Run: `node --test tests/plant-seed.test.js && node --check cloudfunctions/migratePlants/index.js && node --check cloudfunctions/init-database/index.js && node --check scripts/init-database.js`

Expected: all checks exit 0.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/init-database scripts/init-database.js cloudfunctions/migratePlants tests/plant-seed.test.js
git commit -m "Seed and migrate generic plants"
```

### Task 5: Preset and Custom Plant Creation UI

**Files:**
- Create: `miniprogram/pages/plant-add/plant-add.js`
- Create: `miniprogram/pages/plant-add/plant-add.json`
- Create: `miniprogram/pages/plant-add/plant-add.wxml`
- Create: `miniprogram/pages/plant-add/plant-add.wxss`
- Create: `miniprogram/pages/plant-add/view-model.js`
- Create: `tests/plant-add-view-model.test.js`
- Modify: `miniprogram/app.json`
- Modify: `miniprogram/pages/garden/garden.js`
- Modify: `miniprogram/pages/garden/garden.wxml`
- Modify: `miniprogram/pages/garden/garden.wxss`

**Interfaces:**
- Produces the `/pages/plant-add/plant-add` route and `filterPlants(plants, category, keyword)`.
- Consumes `plantManager.listCatalog`, `createPresetTask`, and `createCustomTask`.

- [ ] **Step 1: Write failing filter and form-state tests**

Test category filtering, case-insensitive name search, custom-mode validation messages, and request ID reuse during a retry.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/plant-add-view-model.test.js`

Expected: FAIL because the view model is missing.

- [ ] **Step 3: Implement the add page and plant garden controls**

The page has segmented “植物库 / 自定义” modes, category chips, search, preset rows, and a compact custom form. Submission disables the button, preserves form state on error, and navigates back only after a successful cloud response. The garden page adds category filters and an add button.

- [ ] **Step 4: Run tests and syntax checks**

Run: `node --test tests/plant-add-view-model.test.js && node --check miniprogram/pages/plant-add/plant-add.js && node --check miniprogram/pages/garden/garden.js`

Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/plant-add miniprogram/app.json miniprogram/pages/garden tests/plant-add-view-model.test.js
git commit -m "Add preset and custom plant flow"
```

### Task 6: Field-Notebook Family Experience

**Files:**
- Modify: `miniprogram/app.json`
- Modify: `miniprogram/app.wxss`
- Modify: `miniprogram/pages/index/index.js`
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.wxss`
- Modify: `miniprogram/pages/submit/submit.js`
- Modify: `miniprogram/pages/submit/submit.wxml`
- Modify: `miniprogram/pages/records/records.js`
- Modify: `miniprogram/pages/records/records.wxml`
- Modify: `miniprogram/pages/herb-detail/herb-detail.js`
- Modify: `miniprogram/pages/herb-detail/herb-detail.wxml`
- Modify: `miniprogram/pages/growth-archive/growth-archive.js`
- Modify: `miniprogram/pages/growth-archive/growth-archive.wxml`
- Modify: `miniprogram/components/record-card/record-card.wxml`
- Create: `miniprogram/images/plant-journal-hero.webp`

**Interfaces:**
- Consumes `normalizePlantTask` and `normalizePlantRecord` for all family-facing reads.
- Produces generic visible copy and the B2 visual hierarchy.

- [ ] **Step 1: Add a failing visible-copy guard**

Create a Node test that scans family-facing WXML/JSON files and fails on `连心药园`, `我的药园`, `选择药材`, `药材档案`, and `药草任务`.

- [ ] **Step 2: Run the guard and verify RED**

Run: `node --test tests/visible-copy.test.js`

Expected: FAIL with the current herb-only copy locations.

- [ ] **Step 3: Generate the neutral bitmap hero and implement the field-notebook UI**

Generate one text-free WebP/PNG hero containing varied household plants and a paper observation journal. Use it as a complete, readable image rather than a dark overlay. Replace visible herb semantics, normalize legacy data, show a photo-led recent story, use category labels, and show “已陪伴 N 天” when `growth_days` is zero.

- [ ] **Step 4: Run copy, unit, and syntax checks**

Run: `node --test tests/visible-copy.test.js tests/plant-domain.test.js && node --check miniprogram/pages/index/index.js && node --check miniprogram/pages/submit/submit.js && node --check miniprogram/pages/records/records.js && node --check miniprogram/pages/herb-detail/herb-detail.js && node --check miniprogram/pages/growth-archive/growth-archive.js`

Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add miniprogram tests/visible-copy.test.js
git commit -m "Redesign family experience for all plants"
```

### Task 7: Generic Admin, Statistics, and Exports

**Files:**
- Modify: `cloudfunctions/getTasks/index.js`
- Modify: `cloudfunctions/getRecords/index.js`
- Modify: `cloudfunctions/getStats/index.js`
- Modify: `cloudfunctions/exportData/index.js`
- Modify: `cloudfunctions/sendReminder/index.js`
- Modify: `miniprogram/pages/admin/audit/audit.js`
- Modify: `miniprogram/pages/admin/audit/audit.wxml`
- Modify: `miniprogram/pages/admin/dashboard/dashboard.js`
- Modify: `miniprogram/pages/admin/dashboard/dashboard.wxml`
- Modify: `miniprogram/pages/admin/export/export.js`
- Modify: `miniprogram/pages/admin/families/family-detail/family-detail.wxml`
- Modify: `miniprogram/pages/annual-showcase/annual-showcase.js`
- Modify: `miniprogram/pages/annual-showcase/annual-showcase.wxml`
- Create: `tests/export-plant-view.test.js`

**Interfaces:**
- Produces generic filters, category statistics, plant status export, and legacy field fallback.
- Consumes records and tasks in either legacy or generic shape.

- [ ] **Step 1: Write failing export-view tests**

Test `getPlantName`, `getPlantCategory`, and plant status row grouping for one legacy herb and one new flower.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/export-plant-view.test.js`

Expected: FAIL because generic export helpers do not exist.

- [ ] **Step 3: Implement generic admin reads and exports**

Accept `plant_code` with `herb_code` fallback, expose category counts, rename export type `herb_status` to `plant_status` while accepting the legacy value, and use “植物名称/植物类别/植物生长状况” headers.

- [ ] **Step 4: Run tests, syntax checks, and visible-copy scan**

Run: `node --test tests/export-plant-view.test.js tests/visible-copy.test.js && Get-ChildItem cloudfunctions -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }`

Expected: tests pass and every JavaScript syntax check exits 0.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions miniprogram/pages/admin miniprogram/pages/annual-showcase tests/export-plant-view.test.js
git commit -m "Generalize administration and exports"
```

### Task 8: Documentation, Completion Audit, and GitHub Publication

**Files:**
- Modify: `README.md`
- Modify: `docs/requirements.md`
- Modify: `docs/database-schema.md`
- Modify: `docs/points-bank-deployment.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Documents deployment, `plants`, migration, custom plant permissions, points behavior, and legacy compatibility.

- [ ] **Step 1: Update project identity and deployment documentation**

Rename the public project description to “Lianxin Plant Journal / 连心植物园”, describe all six categories, list both creation modes, document `plantManager` and `migratePlants`, and preserve a legacy compatibility section.

- [ ] **Step 2: Run the complete automated verification suite**

Run: `npm test`

Expected: every Node test passes with zero failures.

- [ ] **Step 3: Run complete syntax and repository checks**

```powershell
Get-ChildItem miniprogram,cloudfunctions,scripts -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
git diff --check
rg -n --hidden -S "(ghp_|gho_|AKIA|OPENAI_API_KEY|api[_-]?key|private[_-]?key|lianxin2026)" -g '!node_modules/**' -g '!.git/**' -g '!.superpowers/**'
```

Expected: syntax and diff checks exit 0; sensitive scan returns no matches.

- [ ] **Step 4: Audit every design completion criterion**

Verify source evidence for preset creation, custom creation, six categories, photo submission, points award/reversal, legacy fallback, generic visible copy, bitmap-only new assets, docs, and Git status. Record any manual WeChat Developer Tools limitation explicitly.

- [ ] **Step 5: Commit, push, and open a draft pull request**

```bash
git add README.md docs AGENTS.md CLAUDE.md
git commit -m "Document all-plants release"
git push -u origin agent/all-plants-expansion
gh pr create --draft --base main --head agent/all-plants-expansion --title "Expand planting records and points to all plants" --body-file <prepared-pr-body>
```

Expected: remote branch exists and GitHub returns a draft PR URL.
