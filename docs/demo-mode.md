# Demo Mode

Real community photos, phone numbers, and family records should never be used in
public demonstrations. This repository includes a synthetic data generator so
operators can test the workflow without exposing participant data.

## Generate Demo Data

Run from the repository root:

```bash
node scripts/generate-demo-data.js
```

To generate a larger sample:

```bash
node scripts/generate-demo-data.js 50
```

The script writes `docs/demo-data/demo-dataset.json` with synthetic families,
planting tasks, care records, and point accounts.

## Recommended Demo Flow

1. Import the Mini Program in WeChat Developer Tools.
2. Create a separate WeChat Cloud environment for demo use.
3. Import the synthetic collections from `docs/demo-data/demo-dataset.json`.
4. Bind a demo family code such as `D001`.
5. Submit one care record with a non-sensitive test photo.
6. Log in as an administrator, approve the record, then check the points page.
7. Export a report and confirm that no real personal data appears.

## Privacy Guardrails

- Keep demo and production cloud environments separate.
- Do not upload real children, family, school, or community photos to public demo
  environments.
- Use synthetic phone numbers and synthetic family names only.
- Delete demo records before handing the environment to a real operator.

