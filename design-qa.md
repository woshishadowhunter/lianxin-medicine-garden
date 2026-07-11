# Design QA — 草本档案馆

- Source visual truth: `docs/design/lianxin-herb-archive-reference.png`
- Implementation screenshot: `docs/design/lianxin-herb-archive-implementation.png`
- Full-view comparison: `docs/design/lianxin-herb-archive-comparison.png`
- Viewport: 390 × 844 mobile
- State: 家庭 F018，首页已绑定、有提醒、有统计和照片
- Focused comparison: 首屏全部关键区域在 390px 宽度内清晰可读，无需额外裁切；重点检查了品牌区、主操作、提醒、统计、热力图和底部导航。

## Findings

- 无剩余 P0 / P1 / P2 问题。
- 字体与层级：品牌标题采用系统宋体回退，正文继续使用微信系统无衬线；字号、字重和行高与参考稿层级一致。
- 间距与布局：首屏结构、横向边距、分隔节奏、主按钮高度和 4 列统计保持一致；已移除多余“今日建议”标题以减少首屏下移。
- 色彩与 token：纸张背景、墨绿主色、暖金提醒和低对比边线已映射到全局 token；普通容器不再依赖阴影。
- 图片质量：首页使用独立生成并压缩的 1500px WebP 草本档案静物，约 80KB；动态养护照片仍由业务数据提供，不使用静态占位资源。
- 文案与内容：保留家庭、天气、提醒、统计、日历和照片证据等业务信息；文案适合户外快速浏览。
- 图标与交互：继续使用项目 `lx-icon` 与现有 PNG 图标系统；主按钮、列表、筛选和卡片均保留 active/hover 反馈。

## Patches Made

- 首页从深绿大卡改为浅纸张草本摄影头图，主操作使用墨绿实体按钮。
- 首页提醒改为轻量档案行，统计改为宋体数字与分隔布局。
- 记录、药园、个人中心和提交页减少卡片套卡片与渐变，统一为分组面板和行分隔。
- 养护类型、照片网格、审核和导出区域统一边框、状态色和阴影策略。
- 最近照片证据由 3 列改为 4 列，更贴近参考稿并提升档案浏览效率。

## Follow-up Polish

- P3：真实用户照片的色温和构图不可控，后续可在云端缩略图阶段增加统一裁切策略。
- P3：宋体显示受不同手机系统字体影响，发布前建议在至少一台 iOS 和一台 Android 真机确认标题字形。

## Final Result

final result: passed
