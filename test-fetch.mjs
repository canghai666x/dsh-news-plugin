// 验证 dsh-news-plugin 的 RSS 抓取+解析逻辑（无 Cordis 依赖的独立测试）
const SOURCES = [
  { id: 'ithome', name: 'IT之家', url: 'https://www.ithome.com/rss/', category: 'tech' },
  { id: 'sspai', name: '少数派', url: 'https://sspai.com/feed', category: 'tech' },
  { id: 'ruanyf', name: '阮一峰的网络日志', url: 'https://www.ruanyifeng.com/blog/atom.xml', category: 'tech' },
  { id: 'chuapp', name: '触乐', url: 'https://www.chuapp.com/feed', category: 'culture' },
]

function decodeXml(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

function parseRss(xml, source) {
  const items = []
  const blockRe = /<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi
  const titleRe = /<(?:title)\b[^>]*>([\s\S]*?)<\/(?:title)>/i
  const linkRe = /<(?:link)\b[^>]*?(?:href="([^"]+)"|>([\s\S]*?)<\/(?:link)>)/i
  const dateRe = /<(?:pubDate|published|updated)\b[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i
  const descRe = /<(?:description|summary|content:encoded)\b[^>]*>([\s\S]*?)<\/(?:description|summary|content:encoded)>/i
  for (const block of xml.matchAll(blockRe)) {
    const b = block[0]
    const title = titleRe.exec(b)?.[1]
    if (!title) continue
    const link = linkRe.exec(b)
    const date = dateRe.exec(b)?.[1]
    const desc = descRe.exec(b)?.[1]
    items.push({
      title: decodeXml(title).trim(),
      link: link ? decodeXml(link[1] ?? link[2] ?? '').trim() : '',
      source: source.name,
      sourceId: source.id,
      pubDate: date ? decodeXml(date).trim() : '',
      summary: decodeXml((desc ?? '').replace(/<[^>]+>/g, ' ')).trim().slice(0, 120),
    })
  }
  return items
}

async function fetchSource(src, timeoutMs = 9000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(src.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; dsh-news-plugin/0.1)' },
    })
    if (!res.ok) { console.warn(`[${src.id}] HTTP ${res.status}`); return [] }
    return parseRss(await res.text(), src)
  } catch (e) {
    console.warn(`[${src.id}] failed: ${e.message}`)
    return []
  } finally { clearTimeout(timer) }
}

;(async () => {
  console.log('=== dsh-news-plugin 抓取验证 ===')
  const results = await Promise.allSettled(SOURCES.map((s) => fetchSource(s)))
  let total = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const items = r.value
      total += items.length
      console.log(`\n[${SOURCES[i].id}] ${SOURCES[i].name}: ${items.length} 条`)
      items.slice(0, 3).forEach((it) => console.log(`  - ${it.title.slice(0, 60)} | ${it.pubDate.slice(0, 16)}`))
    }
  })
  console.log(`\n=== 合计 ${total} 条 ===`)
})().catch((e) => { console.error('FATAL:', e); process.exit(1) })
