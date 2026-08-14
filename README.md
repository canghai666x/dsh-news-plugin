# dsh-news-plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

DeepSeek Harness 新闻采集工具插件。注册一个 `news_fetch` 工具：抓取 RSS 新闻源并解析为结构化条目，供模型做五维评分筛选与简报编排。

**设计原则：采集与解析是确定性工作交给插件，评分/筛选/写作交给模型。** 不依赖第三方包（Node 原生 fetch + 正则解析）。

## 安装（一句话版，推荐）

在 DSH 对话里直接说：

> 安装 https://github.com/canghai666x/dsh-news-plugin 这个插件

Agent 会自动完成：clone 仓库 → 放入 plugins 目录 → 在 `cordis.yml` 注册 → 重启 dsh。全程不用手动敲命令。

**手动安装（备选）：**

将插件放入 Harness 项目，并在 `cordis.yml` 组合中声明（参考官方教程第 7 章）：

```yaml
plugins:
  - name: '@deepseek-ai/dsh-system-prompt'
  - name: '@deepseek-ai/dsh-tools'
  - name: './index.ts'          # 本插件
```

运行：

```sh
node --import tsx ../../vendor/cordis/bin.js
```

> ⚠️ DeepSeek Harness 处于 v0.1 开发者预览期，API 可能有破坏性变更。本插件基于 2026-08 官方 `cordis-tutorial/07-into-the-harness` 文档编写。

## 工具：`news_fetch`

抓取 RSS 源并返回结构化条目。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sources` | string[] | 否 | 源 id 列表（见下表），不传则抓全部 |
| `category` | string | 否 | 按分类过滤：tech / finance / culture / world |
| `limit` | number | 否 | 每个源最多返回条数，默认 8 |

**返回：** `{ title, link, source, sourceId, category, pubDate, summary }[]`

**示例（模型调用）：**

```json
{ "name": "news_fetch", "arguments": { "category": "tech", "limit": 10 } }
```

## 内置源（2026-08 实测）

| id | 名称 | 分类 |
|----|------|------|
| ithome | IT之家 | tech |
| 36kr | 36氪 | tech |
| sspai | 少数派 | tech |
| oschina | OSCHINA | tech |
| ruanyf | 阮一峰的网络日志 | tech |
| wallstreetcn | 华尔街见闻 | finance |
| jiemian | 界面新闻 | finance |
| chuapp | 触乐 | culture |
| verge | The Verge | tech |
| npr | NPR | world |

## 容错设计

- 单个源失败只打 warning，不阻塞整体（`Promise.allSettled` + 逐源超时 9s）
- 源可被直连时正常；被墙环境下建议 Agent 侧配置代理环境变量
- RSS/Atom 格式都支持（`<item>` 与 `<entry>`）

## 验证

```sh
# 无 Cordis 环境验证抓取逻辑（纯 Node）
node test-fetch.mjs
```

## 搭配

- **dsh-news-briefing**（Skill）：拿到 `news_fetch` 结果后做五维评分筛选 + 反标题党写作

## 许可证

MIT
