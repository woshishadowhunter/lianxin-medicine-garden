# Deployment Checklist

Use this checklist before a school, community group, or public-welfare operator
starts a real activity.

## 1. Mini Program Setup

- Replace the placeholder AppID in `project.config.json`.
- Replace the cloud environment ID in `miniprogram/app.js`.
- Confirm the target base library is compatible with your user devices.
- Test every tab in WeChat Developer Tools and on one real phone.

## 2. Cloud Development

- Create all collections listed in `docs/database-schema.md`.
- Deploy every folder under `cloudfunctions/`.
- Run the initialization function once with a strong `adminPassword`.
- Verify that `families`, `planting_tasks`, `points_accounts`, and `admins`
  contain expected records.

## 3. Data And Privacy

- Decide what participant data is truly required.
- Publish a privacy notice for families before collecting photos.
- Keep administrator passwords and private config files outside Git.
- Review cloud database permissions before production launch.
- Prepare a retention policy for photos and activity records.

## 4. Points And Rewards

- Configure reward inventory before opening redemption.
- Use the admin points page to check pending backfill records.
- Fulfill rewards only after matching the pickup code.
- Keep cancellation and refund logs for every stock change.

## 5. Launch Readiness

- Test family binding with at least three demo families.
- Submit, reject, revise, approve, and export records in a dry run.
- Confirm offline submission retry after network recovery.
- Confirm that exported reports match the operator's review format.
- Assign one person to review submissions at least once per week.

