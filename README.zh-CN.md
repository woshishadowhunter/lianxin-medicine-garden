# 连心本草园 / Lianxin Medicine Garden

[English](README.md) | [简体中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform: WeChat Mini Program](https://img.shields.io/badge/Platform-WeChat%20Mini%20Program-07C160.svg)](https://developers.weixin.qq.com/miniprogram/dev/framework/)
[![CI](https://github.com/woshishadowhunter/lianxin-medicine-garden/actions/workflows/ci.yml/badge.svg)](https://github.com/woshishadowhunter/lianxin-medicine-garden/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/woshishadowhunter/lianxin-medicine-garden)](https://github.com/woshishadowhunter/lianxin-medicine-garden/releases/latest)

连心本草园是一套开源微信小程序，用于社区、学校和公益项目中的长期种植活动记录。家庭用户可以提交带照片的日常养护记录，管理员可以审核记录、统计参与情况、导出数据并支持年度总结。

这个项目最初面向约 200 个家庭、多个社区的本草种植活动设计，但它的工作流可以复用于劳动教育、亲子共育、社区治理、公益活动打卡、长期观察记录等场景。

## 部署前先验证

不配置微信云环境，也可以先验证仓库和演示数据。只需要 Node.js 20 或更高版本：

```bash
npm ci
npm test
npm run demo:data
```

测试会检查全部 JavaScript 和 JSON 源文件，并在临时目录生成不含真实个人信息的家庭、照片、养护记录和积分账户数据。随后可以先查看下方截图，再按照[演示指南](docs/demo-mode.md)在微信开发者工具中体验完整流程。

## 它解决什么问题

很多社区和学校活动仍然依赖微信群、表格和人工收集照片：

- 家庭每天发照片，管理员很难追踪谁提交过、谁漏提交。
- 图片证据散落在聊天记录中，后期难以审核和归档。
- 活动周期长，参与度统计和年度总结需要大量手工整理。
- 管理员需要审核、纠错、导出数据，但缺少统一后台。
- 新社区想复用活动模式，却缺少可部署、可二次开发的模板。

连心本草园把这些流程整理成一个可复用的小程序系统。

## 核心功能

- 家庭码和手机号绑定。
- 每日养护记录提交，照片为必填证据。
- 离线提交队列，网络恢复后自动重试。
- 记录时间线和照片墙。
- 本草任务卡和成长档案。
- 管理员审核、家庭管理、统计看板和数据导出。
- 年度展示、积分、徽章、图表和提醒。
- 基于微信云开发的云函数、云数据库和云存储。

## 适用场景

- 社区本草种植活动。
- 小学劳动教育和家庭实践记录。
- 社区公益项目打卡。
- 亲子共育活动。
- 需要照片证据、管理员审核和长期统计的微信小程序项目。

## 项目截图

| 首页 | 提交记录 | 记录列表 |
| --- | --- | --- |
| ![首页](docs/design/lianxin-premium-home.png) | ![提交](docs/design/lianxin-premium-submit.png) | ![记录](docs/design/lianxin-premium-records.png) |

| 种植任务 | 个人中心 | 管理后台 |
| --- | --- | --- |
| ![种植任务](docs/design/lianxin-premium-garden.png) | ![个人中心](docs/design/lianxin-premium-profile.png) | ![管理后台](docs/design/lianxin-premium-admin.png) |

## 技术栈

- 微信小程序原生框架：WXML、WXSS、JavaScript。
- 微信云开发：云函数、云数据库、云存储。
- 目标基础库：3.6.0+。

## 快速开始

1. 使用微信开发者工具导入本仓库。
2. 将 `project.config.json` 中的 `appid` 替换为你自己的小程序 AppID。
3. 将 `miniprogram/app.js` 中的 `your-cloud-env-id` 替换为你的云开发环境 ID。
4. 按照 `docs/database-schema.md` 创建云数据库集合。
5. 部署 `cloudfunctions/` 下的云函数。
6. 首次部署时运行数据库初始化函数，并传入强管理员密码 `adminPassword`。

## 社区运营者使用路径

如果你不是开发者，而是社区、学校或公益项目运营者，建议先看：

- [社区运营者指南](docs/community-operator-guide.md)
- [需求说明](docs/requirements.md)
- [数据库结构](docs/database-schema.md)
- [部署说明](docs/points-bank-deployment.md)

## 开源维护方向

当前优先欢迎这些贡献：

- 部署文档和截图 walkthrough。
- 云函数 smoke tests。
- 管理员权限和数据库规则加固。
- 无真实个人信息的演示数据。
- 微信小程序兼容性问题复现。
- 双语文档和活动模板。

## 与 Codex for OSS 的关系

这个仓库展示的是一个完整、真实、有社区治理场景的小程序项目。它包含前端、云函数、数据库结构、审核流程、照片证据、离线队列、导出和安全注意事项。Codex 或类似工具可以用于：

- 审核 PR 和云函数改动。
- 生成部署检查清单。
- 维护双语文档。
- 辅助排查小程序兼容性问题。
- 自动化 release notes 和维护者周报。

## 安全说明

- 不要提交 `project.private.config.json`。
- 不要提交真实云环境 ID、密钥、API key 或管理员密码。
- 初始化管理员密码必须在部署或调用时传入。
- 上线前必须检查云数据库权限和云函数访问控制。
- 安全问题请尽量私下报告，见 [SECURITY.md](SECURITY.md)。

## License

MIT

