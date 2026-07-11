# Lianxin Medicine Garden

Lianxin Medicine Garden is an open source WeChat Mini Program for community herb-growing activities. It helps families record daily plant care with photo evidence and helps administrators review records, track participation, and export summary data.

The project was designed for a community-scale activity with about 200 families across multiple neighborhoods, but the codebase can be reused for schools, community groups, public welfare programs, and other long-running activity record systems.

## Features

- Family binding by family code and phone verification
- Daily herb care submissions with required photo evidence
- Offline-first submission queue with automatic retry
- Care record timeline and photo wall
- Herb task cards and growth archives
- Administrator dashboard, audit workflow, family management, and data export
- Annual showcase, scoring, badges, charts, and reminders
- WeChat Cloud Development backend with cloud functions and cloud database collections

## Tech Stack

- WeChat Mini Program native framework: WXML, WXSS, JavaScript
- WeChat Cloud Development: cloud functions, cloud database, cloud storage
- Target base library: 3.6.0+

## Repository Layout

```text
miniprogram/        Mini Program frontend pages, components, utilities, and assets
cloudfunctions/     WeChat Cloud Functions
docs/               Requirements, database schema, and design notes
scripts/            Database initialization helpers
```

## Getting Started

1. Import this repository in WeChat Developer Tools.
2. Replace `appid` in `project.config.json` with your own Mini Program AppID.
3. Replace `your-cloud-env-id` in `miniprogram/app.js` with your own WeChat Cloud environment ID.
4. Create the cloud database collections described in `docs/database-schema.md`.
5. Deploy the cloud functions under `cloudfunctions/`.
6. Run the database initialization function once and pass a strong `adminPassword` value.

## Security Notes

- Do not commit `project.private.config.json`.
- Do not commit real cloud secrets, API keys, or administrator passwords.
- The seed script requires the administrator password to be provided during deployment or invocation.
- Review cloud database permissions before production use.

## Documentation

- Requirements: `docs/requirements.md`
- Database schema: `docs/database-schema.md`
- Deployment notes: `docs/points-bank-deployment.md`

## License

This project is licensed under the MIT License.
