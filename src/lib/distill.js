const SIGNAL_WORDS = [
  '真正',
  '其实',
  '本质',
  '关键',
  '核心',
  '因为',
  '所以',
  '意味着',
  '价值',
  '秘密',
  '记住',
  '从来',
  '永远',
  '不是',
  '而是',
  '反而',
  '与其',
  '不如',
  '只有',
  '才',
  '判断',
  '结论',
  '建议',
  '相信',
  '重要',
  '稀缺',
]

const TAG_DICTIONARY = [
  { tag: 'AI 协作', words: ['ai', '模型', '提示词', '智能', 'gpt', '算法'] },
  { tag: '效率', words: ['效率', '提效', '产出', '时间管理', '日程'] },
  { tag: '注意力', words: ['注意力', '专注', '信息流', '过载', '分心'] },
  { tag: '内容创作', words: ['内容', '创作', '写作', '视频', '播客', '表达'] },
  { tag: '产品思维', words: ['产品', '用户', '需求', '体验', '增长'] },
  { tag: '认知升级', words: ['认知', '思维', '判断', '决策', '偏见'] },
  { tag: '职业成长', words: ['职场', '工作', '团队', '管理', '晋升', '同事'] },
  { tag: '商业观察', words: ['商业', '公司', '市场', '商业模式', '收入'] },
  { tag: '习惯养成', words: ['习惯', '坚持', '系统', '复盘', '自律'] },
  { tag: '情绪管理', words: ['情绪', '焦虑', '内耗', '压力', '松弛'] },
]

const LEADING_NOISE = /^(?:主持人|嘉宾|主播|旁白|我|你|他|她|其实|然后|就是|那个|嗯|啊|对)\s*[:：,，]\s*/

function cleanSentence(raw) {
  return raw
    .replace(/\[?\d{1,2}:\d{2}(?::\d{2})?\]?/g, '')
    .replace(/^[\s\-—–·•*#>\d.、]+/, '')
    .replace(LEADING_NOISE, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function ensurePeriod(text) {
  if (!text) return ''
  return /[。！？!?…」』】）)]$/.test(text) ? text : `${text}。`
}

function trimTo(text, max) {
  if (text.length <= max) return text
  const sliced = text.slice(0, max)
  const lastStop = Math.max(
    sliced.lastIndexOf('，'),
    sliced.lastIndexOf('；'),
    sliced.lastIndexOf('、'),
    sliced.lastIndexOf('。')
  )
  const cut = lastStop > max * 0.55 ? sliced.slice(0, lastStop) : sliced
  return `${cut.replace(/[，、；。]+$/, '')}…`
}

function splitSentences(text) {
  return text
    .replace(/\r/g, '')
    .split(/(?<=[。！？!?；;…])|\n+/)
    .map(cleanSentence)
    .filter((sentence) => sentence.length >= 8)
}

function scoreSentence(sentence) {
  let score = 0
  const length = sentence.length

  if (length >= 12 && length <= 46) score += 3.2
  else if (length <= 62) score += 1.6
  else score -= 0.8

  SIGNAL_WORDS.forEach((word) => {
    if (sentence.includes(word)) score += 0.75
  })

  if (/[！!]/.test(sentence)) score += 1.1
  if (/[？?]/.test(sentence)) score -= 1.6
  if (/\d/.test(sentence)) score += 0.4
  if (/「.+」|“.+”|".+"/.test(sentence)) score += 0.8
  if (/^(?:这|那|我们|你|我)/.test(sentence)) score += 0.35

  return score + Math.min(2, length / 30)
}

function pickTags(text, sourceLabel) {
  const lower = text.toLowerCase()
  const scored = TAG_DICTIONARY.map(({ tag, words }) => ({
    tag,
    hits: words.reduce((total, word) => {
      if (!lower.includes(word)) return total
      const matches = lower.split(word).length - 1
      return total + matches
    }, 0),
  }))
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .map((item) => item.tag)

  if (scored.length >= 2) return scored
  if (scored.length === 1) return [...scored, '灵感碎片']
  return ['灵感碎片', sourceLabel]
}

function suggestTitle(text) {
  const bookMatch = text.match(/《([^》]{2,24})》/)
  if (bookMatch) return bookMatch[1]

  const topicMatch = text.match(
    /(?:话题|问题|主题|事情|变化|结论)[：:]\s*([^。！？!?]{6,40})/
  )
  if (topicMatch) return trimTo(topicMatch[1].replace(/[，,、；;]+$/, ''), 26)

  const sentences = splitSentences(text)
  const first = sentences[0] || ''

  const colonParts = first.split(/[：:]/)
  if (colonParts.length > 1) {
    const tail = colonParts.slice(1).join('：').trim()
    if (tail.length >= 6) return trimTo(tail, 26)
  }

  const stripped = first
    .replace(/^(?:这期节目|本期节目|今天|我们|我|其实|然后)[^，。]{0,12}[，,]\s*/, '')
    .replace(/^(?:想|来)?(?:聊|说|讲)(?:一个|一下)?[^，。]{0,8}[，,]?\s*/, '')

  return trimTo(stripped || first || '未命名灵感', 26)
}

export function distillContent({ title, text, sourceType, sourceLabel, sourceUrl, sourcePlatform = '', sourceAssets = [] }) {
  const source = text.trim()
  const sentences = [...new Set(splitSentences(source))]
  const ranked = sentences
    .map((sentence) => ({ sentence, score: scoreSentence(sentence) }))
    .sort((a, b) => b.score - a.score)

  const fallback = source.slice(0, 48) || '这段内容还没有留下可提炼的句子。'

  const golden = ranked.length ? ranked[0].sentence : fallback
  const goldenQuote = trimTo(ensurePeriod(golden), 74)

  const summaryCandidate =
    ranked.find(
      (item) =>
        item.sentence !== golden &&
        item.sentence.length >= 12 &&
        item.sentence !== goldenQuote
    )?.sentence || fallback
  const oneLineSummary = trimTo(ensurePeriod(summaryCandidate), 46)

  const takeaways = ranked
    .filter((item) => item.sentence !== golden && item.sentence !== summaryCandidate)
    .slice(0, 4)
    .map((item) => trimTo(ensurePeriod(item.sentence), 62))

  if (takeaways.length < 3 && sentences.length > 1) {
    sentences.slice(0, 3).forEach((sentence) => {
      const point = trimTo(ensurePeriod(sentence), 62)
      if (!takeaways.includes(point) && takeaways.length < 4) takeaways.push(point)
    })
  }

  const tags = pickTags(source, sourceLabel)
  const charCount = source.replace(/\s/g, '').length

  let sourceName = sourcePlatform || '手动粘贴'
  if (!sourcePlatform && sourceUrl.trim()) {
    try {
      sourceName = new URL(sourceUrl.trim()).hostname.replace(/^www\./, '')
    } catch {
      sourceName = '手动粘贴'
    }
  }

  return {
    title: (title || '').trim() || suggestTitle(source),
    sourceType,
    sourceName,
    sourceUrl: sourceUrl.trim(),
    sourceAssets,
    meta: `${charCount} 字原始稿`,
    golden_quote: goldenQuote,
    one_line_summary: oneLineSummary,
    key_takeaways: takeaways,
    tags,
    personal_note: '',
    starred: false,
    noteUpdatedAt: null,
  }
}

export function matchesQuery(card, query) {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return true
  const haystack = [
    card.title,
    card.golden_quote,
    card.one_line_summary,
    card.sourceName,
    ...(card.tags || []),
    ...(card.key_takeaways || []),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(keyword)
}
