# 连心植物园部署、迁移与积分说明

## 1. 部署前准备

1. 在微信开发者工具中导入项目。
2. 将 `project.config.json` 的 `appid` 替换为正式 AppID。
3. 将 `miniprogram/app.js` 的 `your-cloud-env-id` 替换为云环境 ID。
4. 确认基础库版本不低于 3.6.0。
5. 创建 `docs/database-schema.md` 中列出的集合。
6. 为管理员设置长度至少 8 位的独立强密码，不要写入仓库。

积分兑换上线前必须确认以下集合已经创建，且客户端均无直接写权限：

- `points_accounts`
- `points_transactions`
- `points_redemptions`
- `points_reward_stock`
- `points_redemption_logs`

必须在云数据库控制台建立以下复合索引：

| 集合 | 索引字段 |
| --- | --- |
| points_transactions | `family_code` 升序 + `created_at` 降序 |
| points_redemptions | `family_code` 升序 + `created_at` 降序 |
| points_redemptions | `status` 升序 + `created_at` 降序 |
| points_redemptions | `status` 升序 + `due_at` 升序 |
| points_redemption_logs | `redemption_no` 升序 + `created_at` 降序 |

索引未生效前不要开放兑换入口，否则家庭订单和管理员队列查询会失败。

## 2. 需要部署的云函数

- `login`
- `plantManager`
- `submitRecord`
- `getRecords`
- `getTasks`
- `auditReview`
- `getStats`
- `exportData`
- `pointsBank`
- `sendReminder`
- `migratePlants`
- `init-database`（仅新部署初始化时使用）

在微信开发者工具中逐个选择云函数目录，执行“上传并部署：云端安装依赖”。

## 3. 新部署初始化

仅在空数据库执行一次 `init-database`：

```json
{
  "adminPassword": "使用部署时提供的强密码"
}
```

初始化内容包括：

- 200 个家庭账号
- 22 个跨六类的预设植物
- 兼容的 11 种本草目录
- 每个家庭 3 至 5 个初始种植任务
- 200 个积分账户
- 1 个超级管理员

不要在已有生产数据的环境再次运行完整初始化。

## 4. 从 v1 升级

最简单的方式是管理员登录小程序后进入“数据导出”，在“旧数据升级”区域点击“开始升级”。页面会自动写入目录并循环处理全部任务和记录。以下云函数参数用于需要手动控制批次的部署人员。

### 4.1 部署新版函数和前端

先部署 `plantManager`、`submitRecord`、`auditReview`、`pointsBank`、`exportData` 和 `migratePlants`，再上传新版小程序。

### 4.2 写入预设植物目录

以管理员身份调用：

```json
{
  "action": "seedCatalog"
}
```

函数使用固定文档 ID，可以重复执行，不会产生重复目录项。

### 4.3 迁移旧任务

首次调用：

```json
{
  "action": "migrateCollection",
  "collection": "planting_tasks",
  "cursor": ""
}
```

响应示例：

```json
{
  "success": true,
  "data": {
    "processed": 100,
    "updated": 100,
    "nextCursor": "上一批最后一个文档ID",
    "done": false
  }
}
```

将 `nextCursor` 传入下一次调用，直到 `done` 为 `true`。

### 4.4 迁移旧记录

使用同样流程，将 `collection` 改为 `care_records`。迁移只补充缺失的 `plant_*` 字段，不删除或覆盖旧字段。

未执行迁移时，新版读取逻辑仍会从 `herb_*` 回退，因此迁移可以分批进行。

## 5. 植物创建权限

`plantManager` 提供三个动作：

- `listCatalog`：读取启用的预设植物。
- `createPresetTask`：从目录创建家庭植物任务。
- `createCustomTask`：创建家庭自定义植物。

两个创建动作都执行以下校验：

- 家庭编号格式正确。
- 当前 openid 是该家庭成员或管理员。
- requestId 格式正确，并用于生成幂等任务 ID。
- 植物名称、类别、日期、周期和封面 fileID 有效。

客户端不能直接为其他家庭创建任务。

## 6. 养护记录安全

`submitRecord` 只信任 `task_id` 和养护内容。云函数读取任务文档后：

1. 获取真实家庭编号和植物身份。
2. 验证当前 openid 的家庭权限。
3. 验证养护类型、日期和 1 至 9 张照片。
4. 写入 `plant_*` 字段及 `herb_*` 兼容别名。
5. 更新任务养护次数和最近养护日期。

客户端传入的家庭编号或植物名称不会覆盖服务端任务信息。

## 7. 积分规则

### 自动积分

- 记录创建：不发分，`points_status=none`。
- 审核确认：发放 10 分，`points_status=awarded`。
- 已发分记录改为需修正：冲正 10 分，`points_status=reversed`。
- 同一审核状态重复提交：不重复记账。
- 如果家庭已经使用了积分，审核冲正可以形成负余额；后续新积分先抵扣负余额，负余额期间不能兑换。

### 管理员奖励

| 规则编码 | 名称 | 分值 |
| --- | --- | --- |
| growth_quality | 成长状态优秀 | 50 |
| stage_milestone | 关键生长节点 | 30 |
| excellent_harvest | 完整成长档案 | 100 |
| community_example | 社区绿色示范 | 80 |

每次奖励必须提供唯一 `requestId`。积分流水 ID 由请求上下文确定性生成，网络重试不会重复入账。

### 历史记录补发

管理员可调用 `pointsBank.backfillConfirmed`，每次处理最多 20 条已确认但未发分的记录。重复调用直到待补发数为 0。

### 积分兑换与发放

- 家庭可兑换四季种子包、儿童园艺手套、迷你浇水壶和家庭种植礼包。
- 每次仅兑换一份，兑换请求 ID 保存在客户端本地，网络重试不会重复扣分。
- 兑换时积分扣除、库存预留、积分流水和兑换单在同一个事务内写入。
- 管理员按“待备货 → 待领取 → 已发放”推进，默认应在 7 天内完成备货。
- 家庭在待备货阶段可取消；管理员在发放前可取消。取消时积分退款与库存归还同事务完成。
- 家庭领取时出示四位领取码，管理员核对后确认发放。
- 管理端首屏显示待备货、待领取和超期数量，并可按礼品补充或减少可用库存。

## 8. 数据库权限建议

- `points_accounts`、`points_transactions`、`points_redemptions`、`points_reward_stock` 和 `points_redemption_logs` 禁止客户端直接写入。
- `admins` 和 `admin_logs` 禁止普通家庭读取或写入。
- `planting_tasks` 的创建优先通过 `plantManager`。
- `care_records` 的创建通过 `submitRecord`。
- 家庭读取应限制到自身 `family_code`；管理端操作通过验证管理员身份的云函数。

上线前根据实际云环境配置并验证权限规则。仓库不包含生产环境密钥、密码或完整权限策略。

## 9. 验收流程

1. 绑定一个家庭账号。
2. 从植物库添加一株花卉。
3. 创建一株自定义绿植。
4. 分别提交带照片的养护记录。
5. 管理员确认一条记录，验证余额增加 10 分。
6. 将该记录改为需修正，验证产生 -10 分冲正流水。
7. 兑换一份礼品，验证积分扣除、库存预留和兑换单同时生成。
8. 管理员标记备货完成，家庭端确认显示四位领取码。
9. 管理员核码后确认发放，验证预留库存转为已发放。
10. 另建一笔兑换并取消，验证积分和库存均自动退回。
11. 查看首页成长照片、植物园分类、植物详情和积分流水。
12. 导出植物状态和积分流水文件。
13. 确认一个旧本草任务和旧记录仍可查看。

## 10. 自动化检查

```powershell
npm test
Get-ChildItem miniprogram,cloudfunctions,scripts -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
git diff --check
```

微信小程序页面仍需在微信开发者工具中完成真实编译和交互验收。
