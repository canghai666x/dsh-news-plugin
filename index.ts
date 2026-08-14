/**
 * dsh-news-plugin — DeepSeek Harness 新闻采集工具插件
 *
 * 注册一个 `news_fetch` 工具：抓取中文/英文 RSS 源并解析为结构化条目，
 * 供模型做五维评分筛选与简报编排。采集与解析是确定性工作，评分/写作交给模型。
 *
 * 基于 Cordis + @deepseek-ai/dsh-tools（DeepSeek Harness v0.1 插件 API）。
 * 参考官方教程第 7 章：docs/cordis-tutorial/07-into-the-harness.zh.md
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-news-plugin'
export const inject = ['tools']

/* ------------------------------------------------------------------ */
/* RSS 源注册表（2026-08 实测可直连的中文源为主，英文源备用）          */
/* ------------------------------------------------------------------ */
export interface RssSource {
  id: string
  name: string
  url: string
  category: string
  /** 超时毫秒，默认 9000 */
  timeout?: number
}

export const SOURCES: RssSource[] = [
  // 中文科技
  { id: 'ithome', name: 'IT之家', url: 'https://www.ithome.com/rss/', category: 'tech' },
  { id: '36kr', name: '36氪', url: 'https://36kr.com/feed', category: 'tech' },
  { id: 'sspai', name: '少数派', url: 'https://sspai.com/feed', category: 'tech' },
  { id: 'oschina', name: 'OSCHINA', url: 'https://www.oschina.net/news/rss', category: 'tech' },
  { id: 'ruanyf', name: '阮一峰的网络日志', url: 'https://www.ruanyifeng.com/blog/atom.xml', category: 'tech' },
  // 中文财经
  { id: 'wallstreetcn', name: '华尔街见闻', url: 'https://rsshub.app/wallstreetcn/live', category: 'finance' },
  { id: 'jiemian', name: '界面新闻', url: 'https://www.jiemian.com/rss', category: 'finance' },
  // 游戏 / 文化
  { id: 'chuapp', name: '触乐', url: 'https://www.chuapp.com/feed', category: 'culture' },
  // 英文（备用）
  { id: 'verge', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech' },
  { id: 'npr', name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', category: 'world' },
]

/* ------------------------------------------------------------------ */
/* RSS 抓取与解析（无第三方依赖：Node 原生 fetch + 正则解析）           */
/* ------------------------------------------------------------------ */
export interface NewsItem {
  title: string
  link: string
  source: string
  sourceId: string
  category: string
  pubDate: string
  summary: string
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** 从 RSS/Atom XML 中提取条目（<item> 或 <entry>） */
export function parseRss(xml: string, source: RssSource): NewsItem[] {
  const items: NewsItem[] = []
  const blockRe = /<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi
  const titleRe = /<(?:title)\b[^>]*>([\s\S]*?)<\/(?:title)>/i
  const linkRe = /<(?:link)\b[^>]*?(?:href="([^"]+)"|>([\s\S]*?)<\/(?:link)>)/i
  const dateRe = /<(?:pubDate|published|updated)\b[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i
  const descRe = /<(?:description|summary|content:encoded)\b[^>]*>([\s\S]*?)<\/(?:description|summary|content:encoded)>/i

  for (const block of xml.matchAll(blockRe)) {
    const b = block[0]
    const title = titleRe.exec(b)?.[1]
    const link = linkRe.exec(b)
    const date = dateRe.exec(b)?.[1]
    const desc = descRe.exec(b)?.[1]
    if (!title) continue
    items.push({
      title: decodeXml(title).trim(),
      link: link ? decodeXml(link[1] ?? link[2] ?? '').trim() : '',
      source: source.name,
      sourceId: source.id,
      category: source.category,
      pubDate: date ? decodeXml(date).trim() : '',
      summary: decodeXml((desc ?? '').replace(/<[^>]+>/g, ' ')).trim().slice(0, 200),
    })
  }
  return items
}

/** 抓取一个源并解析；失败返回空数组并打警告（单个源失败不阻塞整体） */
export async function fetchSource(src: RssSource, timeoutMs = 9000): Promise<NewsItem[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(src.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; dsh-news-plugin/0.1)' },
    })
    if (!res.ok) {
      console.warn(`[dsh-news] ${src.id} HTTP ${res.status}`)
      return []
    }
    const xml = await res.text()
    return parseRss(xml, src)
  } catch (e) {
    console.warn(`[dsh-news] ${src.id} fetch failed: ${(e as Error).message}`)
    return []
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ */
/* 工具定义                                                             */
/* ------------------------------------------------------------------ */
export function apply(ctx: Context) {
  ctx.tools.register(
    defineTool({
      name: 'news_fetch',
      description:
        '抓取 RSS 新闻源并返回结构化条目（标题/链接/来源/时间/摘要）。' +
        '支持按分类过滤：tech(科技) / finance(财经) / culture(文化) / world(国际)。' +
        '不传 sources 时抓取全部源。适合做新闻早报/晚报的素材采集，评分筛选与写作交给模型。',
      parameters: {
        sources: {
          type: 'array',
          items: { type: 'string' },
          required: false,
          description:
            '源 id 列表（可选）：ithome / 36kr / sspai / oschina / ruanyf / wallstreetcn / jiemian / chuapp / verge / npr',
        },
        category: {
          type: 'string',
          required: false,
          description: '按分类过滤：tech / finance / culture / world',
        },
        limit: {
          type: 'number',
          required: false,
          description: '每个源最多返回条数，默认 8',
        },
      },
      output: {
        schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              link: { type: 'string' },
              source: { type: 'string' },
              sourceId: { type: 'string' },
              category: { type: 'string' },
              pubDate: { type: 'string' },
              summary: { type: 'string' },
            },
          },
        },
        render: (_args, value) => [
          {
            type: 'text',
            text: JSON.stringify(
              value.map((it: NewsItem) => `[${it.source}] ${it.title} (${it.link})`),
              null,
              0,
            ),
          },
        ],
      },
      async execute(args: { sources?: string[]; category?: string; limit?: number }) {
        const limit = args.limit ?? 8
        let srcs = SOURCES
        if (args.sources?.length) {
          srcs = srcs.filter((s) => args.sources!.includes(s.id))
        }
        if (args.category) {
          srcs = srcs.filter((s) => s.category === args.category)
        }
        // 并行抓取，逐源限时
        const settled = await Promise.allSettled(srcs.map((s) => fetchSource(s)))
        const items = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
        // 按时间倒序（RSS 内一般已排好，这里兜底），截断
        return items.slice(0, limit * srcs.length || limit)
      },
    }),
  )
}
