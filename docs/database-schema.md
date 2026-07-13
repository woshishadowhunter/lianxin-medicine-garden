# 连心植物园数据库设计

## 1. families

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| family_code | string | 家庭编号，例如 F001，唯一 |
| community | string | 所属社区 |
| phone | string | 预留手机号 |
| contact_name | string | 联系人 |
| member_count | number | 家庭成员数量 |
| openid | string | 旧版单账号绑定字段 |
| is_active | boolean | 是否启用 |
| created_at / updated_at | Date | 时间戳 |

## 2. family_members

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| _id | string | `fm_` + SHA-1(family_code:openid) |
| family_code | string | 家庭编号 |
| openid | string | 微信账号 openid |
| bound_at | Date | 首次绑定时间 |
| last_login | Date | 最近登录时间 |

## 3. plants

预设植物目录。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| code | string | 稳定植物编码，唯一 |
| name | string | 标准名称 |
| category | string | flower/foliage/vegetable/fruit/herb/other |
| icon_name | string | 位图图标语义名 |
| growth_days | number | 建议成长周期；0 表示长期观察 |
| description | string | 简介 |
| is_active | boolean | 是否允许创建新任务 |
| created_at / updated_at | Date | 时间戳 |

`herbs` 集合作为 v1 兼容目录保留，不再作为新界面的唯一植物来源。

## 4. planting_tasks

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| _id | string | 自动或幂等任务 ID |
| family_code | string | 所属家庭 |
| plant_code | string | 预设编码或 `custom_<hash>` |
| plant_name | string | 显示名称 |
| plant_category | string | 植物类别 |
| plant_icon_name | string | 图标语义名 |
| growth_days | number | 创建时固化的成长周期 |
| source | string | preset/custom/legacy |
| cover_image | string | 可选云存储 fileID |
| owner_openid | string | 创建者 openid |
| herb_code / herb_name | string | v1 兼容别名 |
| herb_icon_name | string | v1 兼容图标字段 |
| plant_date | string | YYYY-MM-DD |
| status | string | growing/harvested/warning/dead |
| care_count | number | 养护记录数 |
| last_care_date | string | 最近养护日期 |
| last_care_type | string | 最近养护类型 |
| created_at / updated_at | Date | 时间戳 |

## 5. care_records

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| family_code | string | 由服务端任务文档派生 |
| task_id | string | planting_tasks._id |
| plant_code / plant_name | string | 通用植物身份 |
| plant_category | string | 植物类别 |
| herb_code / herb_name | string | v1 兼容别名 |
| care_type | string | watering/pruning/fertilizing/weeding/pest_control/growth_check/other |
| photos | Array<string> | 1 至 9 个云存储 fileID |
| description | string | 养护说明 |
| weather | string | 天气 |
| growth_stage | string | 生长阶段 |
| care_date / care_time | string | 养护日期和时间 |
| audit_status | string | pending/confirmed/needs_revision |
| audit_comment | string | 审核意见 |
| audited_by / audited_at | string / Date | 审核人和时间 |
| points_status | string | none/awarded/reversed |
| points_sequence | number | 积分动作序号 |
| created_at / updated_at | Date | 时间戳 |

## 6. points_accounts

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| _id / family_code | string | 家庭编号 |
| balance | number | 当前余额 |
| total_earned | number | 累计正向入账 |
| total_reversed | number | 累计冲正绝对值 |
| total_redeemed | number | 累计兑换扣除积分 |
| total_refunded | number | 取消兑换后累计退回积分 |
| transaction_count | number | 流水数量 |
| version | number | 账户版本 |
| created_at / updated_at | Date | 时间戳 |

## 7. points_transactions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| _id / transaction_no | string | 确定性交易编号 |
| family_code | string | 家庭编号 |
| amount | number | 有符号积分值 |
| balance_after | number | 交易后余额 |
| type | string | care_award/reward/reversal/redemption/redemption_refund |
| source_type / source_id | string | 来源类型和 ID |
| rule_code | string | 计分规则 |
| description | string | 流水摘要 |
| operator_openid | string | 操作人 |
| created_at | Date | 入账时间 |

## 8. points_redemptions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| redemption_no | string | 确定性兑换编号，用于防止网络重试重复扣分 |
| family_code | string | 家庭编号 |
| reward_code / reward_name | string | 兑换项目 |
| quantity / points_cost | number | 数量与扣除积分 |
| status | string | pending/ready/fulfilled/canceled |
| pickup_code | string | 四位现场领取码 |
| due_at | Date | 最晚备货日期，默认申请后 7 天 |
| created_at / ready_at / fulfilled_at / canceled_at | Date | 各阶段时间 |

## 9. points_reward_stock 与 points_redemption_logs

`points_reward_stock` 以兑换项目编码为文档 ID，记录 `available`、`reserved`、`fulfilled`、`total_received` 和版本号。兑换时在事务内从可用库存转入预留，发放时转为已发，取消时归还可用库存。

`points_redemption_logs` 保存兑换状态变化、库存调整、操作人和备注，供管理员追溯。

## 10. admins 与 admin_logs

`admins` 保存管理员身份、密码和角色；`admin_logs` 保存审核等管理动作。管理员权限必须在云函数内通过 openid 验证，客户端 `isAdmin` 只用于界面状态。

## 11. 建议索引

- `plants`: `code` unique，`category + is_active`
- `planting_tasks`: `family_code + status`，`family_code + plant_category`
- `care_records`: `family_code + care_date(desc)`，`task_id + care_date(desc)`，`audit_status + created_at(desc)`
- `family_members`: `family_code + openid`
- `points_transactions`: `family_code + created_at(desc)`
- `points_redemptions`: `family_code + created_at(desc)`，`status + created_at(desc)`，`status + due_at(asc)`
- `points_redemption_logs`: `redemption_no + created_at(desc)`
- `admins`: `openid`

## 12. 迁移原则

- 新字段采用补充式写入，不删除旧字段。
- `migratePlants.seedCatalog` 使用固定文档 ID，可重复执行。
- `migratePlants.migrateCollection` 每次最多处理 100 条，使用游标继续。
- 旧任务默认 `plant_category=herb`、`source=legacy`、`growth_days=0`。
