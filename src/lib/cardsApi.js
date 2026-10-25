import { requireSupabase } from './supabase'

const CARD_COLUMNS = [
  'id',
  'user_id',
  'title',
  'source_type',
  'source_name',
  'source_url',
  'source_assets',
  'meta',
  'golden_quote',
  'one_line_summary',
  'key_takeaways',
  'tags',
  'personal_note',
  'starred',
  'is_public',
  'created_at',
  'note_updated_at',
].join(',')

/** 数据库行 → 前端卡片对象，字段名与 mockCards / distill.js 保持一致 */
export function rowToCard(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    sourceType: row.source_type,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourceAssets: row.source_assets || [],
    meta: row.meta,
    golden_quote: row.golden_quote,
    one_line_summary: row.one_line_summary,
    key_takeaways: row.key_takeaways || [],
    tags: row.tags || [],
    personal_note: row.personal_note || '',
    starred: Boolean(row.starred),
    isPublic: row.is_public,
    createdAt: row.created_at,
    noteUpdatedAt: row.note_updated_at,
  }
}

/** 前端卡片对象 → 数据库行，只写前端真正拥有的字段 */
export function cardToRow(card, userId) {
  return {
    user_id: userId,
    title: card.title,
    source_type: card.sourceType,
    source_name: card.sourceName || '',
    source_url: card.sourceUrl || '',
    source_assets: card.sourceAssets || [],
    meta: card.meta || '',
    golden_quote: card.golden_quote,
    one_line_summary: card.one_line_summary,
    key_takeaways: card.key_takeaways || [],
    tags: card.tags || [],
    personal_note: card.personal_note || '',
    starred: Boolean(card.starred),
    is_public: card.isPublic !== false,
  }
}

export class PermissionError extends Error {
  constructor() {
    super('没有权限修改这张卡片')
    this.name = 'PermissionError'
  }
}

export async function fetchCards() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('distill_cards')
    .select(CARD_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(rowToCard)
}

export async function insertCard(card, userId) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('distill_cards')
    .insert(cardToRow(card, userId))
    .select(CARD_COLUMNS)
    .single()
  if (error) throw error
  return rowToCard(data)
}

/** RLS 拦截时 PostgREST 返回 0 行而不报错，这里用 select 回读来判断是否真的写成功 */
export async function updateCardFields(id, patch) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('distill_cards')
    .update(patch)
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new PermissionError()
  return true
}

export async function deleteCardById(id) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('distill_cards')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new PermissionError()
  return true
}

const AUTH_ERRORS = [
  ['Invalid login credentials', '邮箱或密码不正确'],
  ['Email not confirmed', '邮箱还没验证，请先查收验证邮件'],
  ['User already registered', '这个邮箱已经注册过了，直接登录即可'],
  ['Password should be at least', '密码至少需要 6 位'],
  ['Unable to validate email address', '邮箱格式看起来不对'],
  ['Signups not allowed', '当前项目未开放注册'],
  ['over_email_send_rate_limit', '验证邮件发送太频繁，请稍后再试'],
]

export function toChineseAuthError(error) {
  const raw = error?.message || '操作失败，请稍后重试'
  const hit = AUTH_ERRORS.find(([key]) => raw.toLowerCase().includes(key.toLowerCase()))
  return hit ? hit[1] : raw
}
