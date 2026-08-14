# AGENT 安装指引（给 AI Agent 看的说明书）

用户说「安装这个插件」时，请严格按以下步骤执行。本文件的存在是为了让安装过程可复现、可验证——不要跳过任何一步。

## 前置检查

1. 确认本机已装 Node.js ≥ 18：`node --version`
2. 找到 DSH 项目根目录（特征：存在 `cordis.yml` 或 `package.json` 含 `@deepseek-ai/dsh` 依赖）。找不到就问用户项目在哪，**不要猜**
3. 确认 `cordis.yml` 中已有 `@deepseek-ai/dsh-tools` 插件（本插件的 `news_fetch` 工具依赖 tools 服务）

## 安装步骤

```sh
# 1. 克隆到项目 plugins 目录（目录不存在就创建）
cd <DSH项目根目录>
mkdir -p plugins
git clone https://github.com/canghai666x/dsh-news-plugin plugins/dsh-news-plugin

# 2. 在 cordis.yml 的 plugins 列表末尾追加（保持 YAML 缩进与现有条目一致）
#    - name: './plugins/dsh-news-plugin/index.ts'
#    如果 plugins 列表是内联数组，直接加一行：'./plugins/dsh-news-plugin/index.ts'
```

用 patch 工具或编辑器修改 `cordis.yml`，在 `plugins:` 列表里追加：

```yaml
  - name: './plugins/dsh-news-plugin/index.ts'
```

## 重启与验证

```sh
# 3. 重启 dsh（通常 Ctrl-C 后重新运行；如果项目有热重载可跳过）
# 4. 验证插件被加载且工具已注册
```

验证方法（任选其一）：
- 启动日志中搜索 `dsh-news-plugin`，无 ERROR
- 在 DSH 对话里问模型：「你有哪些工具？有没有 news_fetch？」
- 直接让模型调用一次：`news_fetch`，参数 `{ "limit": 3 }`，应返回结构化新闻条目

## 排障

| 现象 | 处理 |
|------|------|
| `Cannot find module '@deepseek-ai/cordis'` | 项目依赖未装：`npm install` 后重试 |
| 插件 PENDING 不加载 | `@deepseek-ai/dsh-tools` 未在 cordis.yml 中声明，补上 |
| `news_fetch` 返回空数组 | 网络问题（部分 RSS 源需代理）或源暂时不可达，单源失败不影响整体 |
| fetch 超时 | 插件内置逐源 9 秒超时，属正常容错，重试即可 |
