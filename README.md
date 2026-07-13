# Lianxin Plant Journal / 连心植物园

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Platform: WeChat Mini Program](https://img.shields.io/badge/Platform-WeChat%20Mini%20Program-07C160.svg)
![Status: v2.0](https://img.shields.io/badge/Status-v2.0-blue.svg)
[![CI](https://github.com/woshishadowhunter/lianxin-medicine-garden/actions/workflows/ci.yml/badge.svg)](https://github.com/woshishadowhunter/lianxin-medicine-garden/actions/workflows/ci.yml)

Lianxin Plant Journal is an open source WeChat Mini Program for community and family planting activities. Families can track flowers, foliage plants, vegetables, fruit trees, herbs, and custom plants with photo-backed care records. Administrators review evidence, issue points, monitor participation, and export long-term reports.

连心植物园是一套面向社区、学校和家庭种植活动的开源微信小程序。花卉、绿植、蔬菜、果树、本草和其他自定义植物都可以建立成长档案、提交照片记录、获得积分并兑换种植好物。

## What Changed in v2

- Expanded from eleven herbs to six plant categories
- Added a preset plant catalog and family-created custom plants
- Added category filters, plant cover photos, and long-term observation mode
- Reworked the family experience into a photo-led observation journal
- Generalized review, reminders, points, statistics, and exports
- Preserved legacy `herb_*` data through additive compatibility fields
- Added repeatable catalog seeding and legacy migration cloud functions
- Added Node tests for normalization, validation, idempotency, exports, and visible copy

## Core Features

- Family binding by family code and phone verification
- Preset catalog selection plus custom plant creation
- Flowers, foliage plants, vegetables, fruit trees, herbs, and other plants
- Watering, pruning, fertilizing, weeding, pest control, and growth observations
- Mandatory photo evidence with watermarking and offline queue support
- Timeline, photo wall, plant detail, and growth archive views
- Administrator review with approval, correction, and batch operations
- Ten points for each confirmed photo-backed care record
- Idempotent points transactions and automatic reversal on correction
- Atomic reward redemption, inventory reservation, cancellation refunds, pickup codes, and fulfillment queues
- Community statistics, annual showcases, Excel/CSV exports, and reminders

## Architecture

```text
miniprogram/                 Native WeChat Mini Program UI
  pages/plant-add/           Preset and custom plant creation
  pages/garden/              Plant collection and category filters
  utils/plant.js             Legacy-compatible plant normalization
cloudfunctions/
  plantManager/              Catalog listing and secure task creation
  submitRecord/              Server-validated care record submission
  auditReview/               Review and points posting/reversal
  pointsBank/                Accounts, ledger, redemption, stock, fulfillment, and backfill
  migratePlants/             Idempotent catalog seed and legacy migration
  init-database/             New deployment initialization
tests/                       Node built-in test suite
docs/                        Requirements, schema, deployment, and design
```

The data model is additive. New tasks and records write `plant_*` fields and legacy `herb_*` aliases. Readers prefer `plant_*` and fall back to old fields, so existing records, photos, and points remain available without a destructive migration.

## Getting Started

1. Import this repository in WeChat Developer Tools.
2. Replace `appid` in `project.config.json` with your Mini Program AppID.
3. Replace `your-cloud-env-id` in `miniprogram/app.js` with your cloud environment ID.
4. Create the collections documented in `docs/database-schema.md`.
5. Deploy all folders under `cloudfunctions/`, including `plantManager` and `migratePlants`.
6. For a new deployment, run `init-database` once with a strong `adminPassword`.
7. For an existing v1 deployment, call `migratePlants` with `seedCatalog`, then repeatedly call `migrateCollection` for `planting_tasks` and `care_records` until `done` is true.
8. Review cloud database permissions before production use.

## Testing

```powershell
npm install
npm test
Get-ChildItem miniprogram,cloudfunctions,scripts -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Points Rules

- A care record must contain at least one photo.
- New records start as `pending`.
- Confirmation awards 10 points exactly once.
- Changing an awarded record to `needs_revision` posts a 10-point reversal.
- A redemption atomically deducts points and reserves stock.
- Pending redemptions can be canceled with an atomic point refund and stock release.
- Administrators prepare rewards within 7 days and verify the four-digit pickup code before fulfillment.
- Administrator rewards use fixed rules and idempotent request IDs.
- The first release does not support redemption, transfer, or withdrawal.

## Interface History

The following images show the earlier herb-focused release. The v2 code keeps the same evidence-first workflow while replacing herb-only language with a plant observation journal and adding the plant creation flow.

| Home | Submit | Records |
| --- | --- | --- |
| ![Earlier home dashboard](docs/design/lianxin-premium-home.png) | ![Earlier care submission](docs/design/lianxin-premium-submit.png) | ![Earlier records timeline](docs/design/lianxin-premium-records.png) |

## Documentation

- [Requirements](docs/requirements.md)
- [Database schema](docs/database-schema.md)
- [Points and migration deployment](docs/points-bank-deployment.md)
- [v2 design specification](docs/superpowers/specs/2026-07-12-all-plants-expansion-design.md)
- [v2 implementation plan](docs/superpowers/plans/2026-07-12-all-plants-expansion.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Security Notes

- Never commit `project.private.config.json`, real cloud secrets, API keys, or administrator passwords.
- `plantManager` and `submitRecord` verify family membership on the server.
- Plant identity and family ownership are derived from server-side task documents.
- Points balances can only be changed through cloud transactions.
- Review database permissions and cloud function access before deployment.

## License

MIT License. See [LICENSE](LICENSE).
