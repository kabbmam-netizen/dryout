import { requireSupabase, supabaseReady } from './supabase'

const TIMEOUT_MS = 20000

/**
 * 调用 Edge Function 让大模型生成卡片字段。
 * 返回 { data, reason }：
 *   reason = 'ok'           → 用 data 覆盖金句/结论/论据/标签
 *   reason = 'unconfigured' → 没配 Key，静默走本地算法
 *   reason = 'failed'       → 网络或模型出错，降级并提示
 */
export async function requestDistill({ text, title, sourceType }) {
  if (!supabaseReady) return { data: null, reason: 'unconfigured' }

  const call = async () => {
    const client = requireSupabase()
    const { data, error } = await client.functions.invoke('distill', {
      body: { text: text.slice(0, 12000), title, sourceType },
    })
    if (error) {
      // 503 = 没配 Key，404 = 函数还没部署：都算"未配置"，静默降级
      const status = error?.context?.status ?? 0
      if (status === 503 || status === 404) return { data: null, reason: 'unconfigured' }
      return { data: null, reason: 'failed' }
    }
    if (!data || !data.golden_quote || !Array.isArray(data.key_takeaways)) {
      return { data: null, reason: 'failed' }
    }
    return { data, reason: 'ok' }
  }

  try {
    return await Promise.race([
      call(),
      new Promise((resolve) => setTimeout(() => resolve({ data: null, reason: 'failed' }), TIMEOUT_MS)),
    ])
  } catch {
    return { data: null, reason: 'failed' }
  }
}
