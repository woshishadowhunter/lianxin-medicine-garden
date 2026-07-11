# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

连心药园 (Lianxin Medicine Garden) — a WeChat mini program for 200 families across 5-8 communities to record daily herb-planting care activities. Families submit care records (watering, weeding, fertilizing, etc.) with photo evidence; administrators review and approve them. The project runs from Guyu (April 20, 2026) through year-end, culminating in annual reports.

Full requirements: `docs/requirements.md`
Database schema: `docs/database-schema.md`

## Tech Stack

- **Frontend**: WeChat Mini Program native framework (WXML + WXSS + JS)
- **Backend**: WeChat Cloud Development (云开发) — Cloud Functions + Cloud Database + Cloud Storage
- **Target base library**: 3.6.0+

## Architecture

### Role-Based Access

Two user roles sharing the same mini program, distinguished at login:

| Role | Scope | Interface |
|------|-------|-----------|
| Family user (家庭用户) | Own family's data only | 5-tab consumer UI |
| Admin (管理员) | All data, unlocked by password | Admin dashboard pages |

Role is stored in `App.globalData.isAdmin` + `wx.storage('isAdmin')`.

### Project Structure

```
miniprogram/
├── app.js / .json / .wxss    # Entry: cloud init, network monitor, auto-sync
├── components/               # Reusable components (see below)
├── pages/
│   ├── index/                # 🏠 Home dashboard (Tab)
│   ├── records/              # 📋 Care records timeline/photo wall (Tab)
│   ├── submit/               # ➕ Multi-step submit form (Tab)
│   ├── garden/               # 🌿 Herb task cards + growth progress (Tab)
│   ├── profile/              # 👤 User center + admin entry (Tab)
│   ├── bind/                 # Family code + phone verification
│   ├── herb-detail/          # Single herb growth timeline
│   ├── record-detail/        # Single record full detail
│   ├── growth-archive/       # All herbs growth archives with stats
│   └── admin/
│       ├── dashboard/        # Data overview with stats
│       ├── audit/            # Record review (approve/reject/batch)
│       ├── families/         # Family list + detail
│       └── export/           # Data export (4 report types)
├── utils/
│   ├── constants.js          # Care types, herb config, communities, enums
│   ├── date.js               # formatDate, timeAgo, daysUntilHarvest
│   ├── photo.js              # compressImages, uploadPhoto, getCloudPath
│   └── offline.js            # saveOffline, syncAll, getQueue, network monitor
└── images/                   # Tab bar icons (placeholder PNGs needed)

cloudfunctions/
├── login/                    # familyBind + adminLogin
├── submitRecord/             # Server-side record creation + task update
├── getRecords/               # Paginated, filterable record query
├── getTasks/                 # Get planting tasks
├── auditReview/              # Batch audit + admin log
├── getStats/                 # Overview, photoCount, communityRank
└── exportData/               # Generate CSV by export type

scripts/
└── init-database.js          # Run once: 200 families + 11 herbs + task assignments
```

### Reusable Components

- `calendar-heatmap` — 12-week GitHub-style care frequency heatmap using canvas-free grid
- `care-type-picker` — 3-column grid of care type icons, emits `change` event
- `photo-grid` — Configurable-column photo grid with preview on tap
- `record-card` — Standard care record display card with auto icon/status resolution
- `stats-summary` — Numeric stats row with icons and colors
- `empty-state` — Centered placeholder with icon, text, optional action button
- `chart` — Canvas 2D chart component: bar, hbar, pie/donut. Auto-scaling, nice-step axes. No dependencies.
- `loading-card` — Skeleton loading placeholder with shimmer animation

### Database Collections

- `families` — family_code (F001-F200), community, phone, contact_name, member_count, openid
- `herbs` — 11 herb configs: code, name, icon (emoji), growth_days
- `planting_tasks` — family_code + herb_code + plant_date (2026-04-20) + status (growing/harvested/warning/dead) + care_count
- `care_records` — **core**: task_id, care_type, photos (JSON array of cloud fileIDs), description, weather, growth_stage, care_date, audit_status (pending/confirmed/needs_revision)
- `admin_logs` — action, record_ids, new_status, admin_openid
- `admins` — name, password, role (admin/super_admin)

### Photo Pipeline

1. User picks from camera/album → `chooseMedia`
2. Client-side compression via `compressImage` (target ≤1MB)
3. Upload to Cloud Storage path: `families/{family_code}/{task_id}/{date}/{uuid}.jpg`
4. Cloud fileIDs stored as JSON array in `care_records.photos`
5. Display uses `wx.previewImage` for full-size viewing

### Offline Sync

- `utils/offline.js` manages a localStorage queue (`offline_pending_records`)
- On submit failure or no-network: record saved to queue via `saveOffline()`
- `app.js` listens to `wx.onNetworkStatusChange` → auto-calls `syncAll()`
- Each record retries up to 5 times, then discarded
- Profile page shows pending sync count with manual "Sync Now" button

## Key Business Rules

- **Photos mandatory**: every care record must have ≥1 photo (max 9). No photo = invalid.
- **Audit workflow**: all records default to `pending`. Admin explicitly `confirm`s or flags `needs_revision`. Only confirmed records count.
- **Care date editable**: users can backdate records; admin validates reasonableness.
- **Offline-first**: care record submission works without network; syncs on reconnect.
- **Multi-member**: multiple WeChat accounts bind to same family_code.

## Development Status

- [x] Phase 1 — Foundation: project structure, cloud config, DB schema, seed script, tab navigation
- [x] Phase 2 — User-facing core: home dashboard with heatmap/reminders, multi-step submit with offline support, timeline/photo-wall records, herb task cards, growth archives, binding flow
- [x] Phase 3 — Admin: canvas chart component (bar/pie/hbar), real-time data dashboard with 4 chart types, audit center with inline expansion + quick comment templates + batch operations, family management with search/filter/activity status, Excel export via node-xlsx with CSV fallback (5 report types including annual multi-sheet)
- [x] Phase 4 — Final polish: push notifications (notify.js + sendReminder cloud function), photo watermarks via canvas (utils/photo.js), annual showcase page with scoring system/badges/charts, subpackage loading for admin pages
- [x] All phases complete — 120+ source files, 15 pages, 8 components, 8 cloud functions, 5 utility modules, 1 seed script, 2 docs

## Initialization Data

- 200 families (F001-F200) distributed across 8 communities
- 11 herb types with emoji icons and growth cycles (80-180 days)
- Each family randomly assigned 3-5 herbs, all planted 2026-04-20
- 1 super-admin account is created by the seed script using a deployment-provided password.
- Run seed via cloud function: deploy `scripts/init-database.js` as `initDatabase`
