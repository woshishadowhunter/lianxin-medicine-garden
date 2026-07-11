# 数据库集合设计

## 1. families（家庭信息表）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| family_code | string | 家庭编号 F001-F200，唯一索引 |
| community | string | 所属社区 |
| phone | string | 预留手机号 |
| contact_name | string | 联系人姓名 |
| member_count | number | 成员数量，默认1 |
| openid | string | 绑定的微信 openid |
| is_active | boolean | 是否活跃，默认 true |
| created_at | Date | 创建时间 |
| updated_at | Date | 更新时间 |

## 2. herbs（药材配置表）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| code | string | 药材编码（如 jyh, bh） |
| name | string | 药材名称 |
| icon | string | emoji图标 |
| growth_days | number | 预计生长周期（天） |
| description | string | 药材简介（可选） |
| created_at | Date | 创建时间 |

## 3. planting_tasks（种植任务表）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| family_code | string | 家庭编号 |
| herb_code | string | 药材编码 |
| herb_name | string | 药材名称（冗余便于查询） |
| herb_icon | string | 药材图标（冗余） |
| plant_date | string | 种植日期 2026-04-20 |
| status | string | growing/harvested/warning/dead |
| care_count | number | 累计养护次数，默认0 |
| last_care_date | string | 最近养护日期 |
| last_care_type | string | 最近养护类型 |
| created_at | Date | 创建时间 |
| updated_at | Date | 更新时间 |

## 4. care_records（养护记录表 — 核心表）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| family_code | string | 家庭编号 |
| task_id | string | 关联 planting_tasks._id |
| herb_code | string | 药材编码 |
| herb_name | string | 药材名称 |
| care_type | string | watering/weeding/fertilizing/pest_control/growth_check/other |
| photos | Array<string> | 照片云存储 fileID 数组 |
| description | string | 文字描述（500字内） |
| weather | string | 天气（可选） |
| growth_stage | string | 生长阶段（可选） |
| care_date | string | 养护日期 |
| care_time | string | 养护时间 |
| audit_status | string | pending/confirmed/needs_revision |
| audit_comment | string | 审核意见 |
| audited_by | string | 审核人 openid |
| audited_at | Date | 审核时间 |
| created_at | Date | 创建时间 |
| updated_at | Date | 更新时间 |

## 5. admin_logs（管理员操作日志表）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| action | string | 操作类型 |
| record_ids | Array<string> | 操作的记录 ID |
| new_status | string | 新状态 |
| comment | string | 备注 |
| admin_openid | string | 管理员 openid |
| operated_at | Date | 操作时间 |

## 6. admins（管理员表）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| name | string | 管理员名称 |
| password | string | 登录密码 |
| role | string | admin/super_admin |
| created_at | Date | 创建时间 |

## 7. family_members（家庭成员绑定表）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | `family_code + openid` 的 SHA-1，防止重复绑定 |
| family_code | string | 家庭编号 |
| openid | string | 微信用户 openid |
| bound_at | Date | 首次绑定时间 |
| last_login | Date | 最近登录时间 |

## 8. points_accounts（积分银行账户表）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 家庭编号，例如 F001 |
| family_code | string | 家庭编号，唯一 |
| balance | number | 当前积分余额，由流水汇总产生 |
| total_earned | number | 累计入账积分 |
| total_reversed | number | 累计冲正积分绝对值 |
| transaction_count | number | 交易笔数 |
| version | number | 账户版本号 |
| created_at | Date | 开户时间 |
| updated_at | Date | 最近交易时间 |

## 9. points_transactions（积分流水表）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 幂等交易编号的 SHA-1 |
| transaction_no | string | 可展示的唯一交易编号 |
| family_code | string | 家庭账户 |
| amount | number | 有符号金额；入账为正，冲正为负 |
| balance_after | number | 本笔交易后的账户余额 |
| type | string | care_award/reward/reversal |
| source_type | string | care_record/admin_reward |
| source_id | string | 养护记录或奖励请求编号 |
| rule_code | string | 计分规则编码 |
| description | string | 流水摘要 |
| operator_openid | string | 发起操作的管理员 |
| created_at | Date | 入账时间 |

### 积分账本约束

- `points_accounts.balance` 不允许由客户端直接修改，只能通过云函数事务更新。
- 每条审核通过的养护记录基础入账 10 分；退回修正时生成 -10 分冲正流水。
- 优秀种植奖励由管理员从固定规则中选择发放，每次请求必须携带唯一 `requestId`。
- 交易编号确定性生成，云函数重试不会重复入账。
- 账户余额不得小于 0；第一期不支持兑换、转账和提现。

### 建议索引

- `points_transactions`: `family_code + created_at(desc)`
- `points_transactions`: `created_at(desc)`
- `care_records`: `audit_status + points_status + created_at(asc)`
- `admins`: `openid`
- `family_members`: `family_code + openid`
