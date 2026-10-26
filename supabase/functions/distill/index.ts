// Supabase Edge Function: distill
// 职责：接收逐字稿，调用 DeepSeek 生成结构化切片字段。
// Key 只存在 Supabase Secret（DEEPSEEK_API_KEY），绝不进前端。

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_INPUT = 12000
const TIMEOUT_MS = 15000

const SYSTEM_PROMPT = `你是一名中文内容编辑，擅长把冗长的播客、视频或文章压缩成可以直接收藏的卡片。

只输出一个 JSON 对象，不要输出任何解释、不要用 markdown 代码块。结构固定为：
{
  "golden_quote": "全篇最有传播力的一句，60 字以内，保留原意，可轻度润色",
  "one_line_summary": "一句话核心结论，45 字以内",
  "key_takeaways": [
    "第一条：它指出的问题或反常识之处，60 字以内",
    "第二条：它背后的逻辑或机制，60 字以内",
    "第三条：读者可以带走的具体行动，60 字以内"
  ],
  "tags": ["三个分类标签，每个 2-6 个字，不要带 # 号"]
}

要求：
1. 金句要能独立成立，脱离上下文也读得懂；不要用「这期节目」「本期」开头。
2. 结论要给出判断，不要复述主题。
3. 三条论据必须分别对应「看见问题 / 理解逻辑 / 带走行动」，不要三条都在讲同一件事。
4. 全部使用中文，不要出现「作为 AI」之类的自我指涉。`

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function clamp(value: unknown, max: number) {
  if (typeof value !== 'string') return ''
  const text = value.trim().replace(/^["“”']|["“”']$/g, '')
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function normalize(payload: any) {
  const quote = clamp(payload?.golden_quote, 74)
  const summary = clamp(payload?.one_line_summary, 46)
  const rawPoints = Array.isArray(payload?.key_takeaways) ? payload.key_takeaways : []
  const points = rawPoints.map((item: unknown) => clamp(item, 62)).filter(Boolean).slice(0, 3)
  const rawTags = Array.isArray(payload?.tags) ? payload.tags : []
  const tags = rawTags
    .map((item: unknown) => clamp(item, 8).replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 3)

  if (!quote || !summary || points.length < 3) return null
  while (tags.length < 3) tags.push('灵感碎片')
  return { golden_quote: quote, one_line_summary: summary, key_takeaways: points, tags }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // 1. 必须登录：否则任何人拿 anon key 就能刷额度
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return json({ error: 'unauthorized' }, 401)

  // 2. 没配 Key 时明确告知，前端据此静默降级而不是报错
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) return json({ error: 'not_configured' }, 503)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }

  const text = String(body?.text ?? '').trim().slice(0, MAX_INPUT)
  if (text.length < 20) return json({ error: 'text_too_short' }, 400)

  const title = String(body?.title ?? '').trim().slice(0, 60)
  const sourceLabel = String(body?.sourceType ?? '内容')

  // 3. 调用 DeepSeek
  let upstream: Response
  try {
    upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.6,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `${title ? `标题：${title}\n` : ''}来源类型：${sourceLabel}\n\n原文：\n${text}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    return json({ error: 'upstream_unreachable', detail: String(error) }, 504)
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    return json({ error: 'upstream_error', status: upstream.status, detail: detail.slice(0, 300) }, 502)
  }

  // 4. 解析并校验，脏数据一律拒绝，交给前端降级
  try {
    const completion = await upstream.json()
    const content = completion?.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(content)
    const card = normalize(parsed)
    if (!card) return json({ error: 'invalid_output' }, 502)
    return json(card)
  } catch {
    return json({ error: 'parse_failed' }, 502)
  }
})
