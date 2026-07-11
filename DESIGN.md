# Design

## Name

连心药园 · 草本档案馆 v3

## Intent

选定方向为“草本档案馆”。设计以温润纸张底色、墨绿主操作、宋体品牌标题和真实草本摄影建立档案可信度；普通信息使用分组与分隔线，照片证据和关键任务保留明确层级。

## Design Image Workflow

先使用 `docs/design/lianxin-premium-concept.html` 生成设计图，确认后再改小程序 WXML/WXSS/JS。未确认前不直接落地业务页面。

## Visual Direction

- 场景句：家庭用户在户外或社区药园用手机快速记录养护，管理员在手机上审核照片证据和项目数据。
- 视觉策略：Restrained product UI，少量墨绿承担品牌和主操作，金棕只用于档案感和关键强调。
- 概念主线：Archive / dossier + living garden，药园的温度与档案的可信度结合。
- 密度：家庭端中低密度，管理端中高密度。
- 禁止：emoji 图标、装饰性英文眉标、过度卡片化、卡片套卡片、过圆容器、渐变文字、彩色无意义图标。

## Color Tokens

```css
--lx-ink: #17251d;
--lx-ink-2: #34443a;
--lx-muted: #66736a;
--lx-hint: #8a958c;
--lx-bg: #eef2ed;
--lx-bg-deep: #e2ebe3;
--lx-surface: #ffffff;
--lx-surface-2: #f8faf7;
--lx-border: #dbe4dc;
--lx-primary: #1f6b4b;
--lx-primary-dark: #123c2d;
--lx-primary-soft: #e5f0e9;
--lx-accent: #b98b45;
--lx-accent-soft: #f3eadb;
--lx-warning: #d8922f;
--lx-warning-soft: #faefd9;
--lx-danger: #c95045;
--lx-danger-soft: #f8e4e1;
--lx-info: #3d739c;
--lx-info-soft: #e2edf5;
```

## Typography

- 字体：微信系统默认无衬线栈。
- 首页品牌标题：52-60rpx，900，行高 1.12。
- 页面标题：36-42rpx，800，行高 1.22。
- 分区标题：30-32rpx，800。
- 正文：26-28rpx，行高 1.55-1.7。
- 标签/说明：22-24rpx，600-700。
- UI 不使用流式字号，不使用负字距，不使用全大写英文装饰。

## Layout System

- 页面外边距：24rpx。
- 主间距：12 / 16 / 24 / 32 / 40 / 56rpx。
- 卡片半径：16rpx；按钮半径：14-16rpx；标签可用胶囊。
- 阴影：仅用于首页主视觉和浮动底部 CTA，普通内容优先用边框、背景层次和留白。
- 页面结构：顶部任务区 + 当前状态 + 核心工作区 + 次级列表。不要每个模块都套 card。

## Icon System

继续使用 `miniprogram/components/lx-icon` 与 `/images/ui-icons/<tone>/<name>.png`。图标应为统一线性/实心混合风格，单屏最多使用 2 个主要色调。药材状态、养护类型、导航和操作图标不得回退到 emoji。

## Component Grammar

- Home Hero：完整显示“连心药园”，携带家庭编号、社区、天气和今日主操作。
- Priority Action Bar：新增养护是家庭端最强动作，记录和药园为次动作。
- Evidence Module：照片网格、记录卡、审核详情都以照片为第一证据。
- Task Row：药材任务以行项目为主，显示药材、状态、进度、上次养护和关注提示。
- Care Type Tile：6 个养护类型是可选控件，必须有 selected/pressed/disabled 状态。
- Filter Chips：筛选是轻量控件，不做大弹窗优先。
- Status Tag：待审核、已确认、需修正、需关注等状态有固定颜色和文字。
- Admin Audit Row：管理端采用更密集的记录行，照片、家庭、药材、时间、状态、操作同屏可判断。
- Points Bank Card：积分账户使用墨绿银行账户卡，余额是主数字，累计入账和冲正作为次级指标。
- Ledger Row：积分流水必须同时显示摘要、时间、交易编号、有符号金额和交易后余额。
- Admin Reward Panel：奖励发放采用家庭账户、固定奖励规则和备注三段式表单，提交前二次确认。

## Interaction States

所有可点击项必须有 `hover-class` 或显式 active 反馈。选中状态要同时改变背景、边框、文字或图标；上传必须显示压缩、上传、保存三个阶段；离线暂存、同步失败和审核结果要有明确 banner/toast/inline 状态。

## Screen Concepts

1. 首页：大品牌与家庭上下文完整露出，首屏给出“今日建议”和“新增养护”。
2. 新增养护：四步流程压缩成清晰任务台，照片上传面积变大，底部 CTA 固定。
3. 养护记录：从普通时间轴升级为照片证据流，筛选和照片墙切换更轻。
4. 我的药园：药材任务从卡片堆叠改成清晰任务行，关注状态突出。
5. 我的：账户、同步、档案、年度成效、提醒和管理员入口分组明确。
6. 管理端审核：保留密度，强化照片证据、批量操作和状态判断。

## Implementation Notes

- `miniprogram/app.wxss` 后续应移除卡片标题左侧粗色条，改为纯标题或图标+标题。
- 首页不能再依赖原生导航栏表达品牌，必须有 in-page hero。
- 绑定状态以 `familyCode` 为核心判断，已有家庭编号时不能回到绑定引导。
- 管理端不要套用家庭端的大留白，保持操作密度。
- 设计稿确认后，优先重构全局 token 和共享组件，再落页面。
