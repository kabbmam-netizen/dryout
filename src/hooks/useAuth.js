import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseReady } from '../lib/supabase'

/**
 * 登录态与登录弹窗。
 * 会话来自 supabase.auth，登录 / 退出后 onAuthStateChange 会自动更新，
 * useCards 依赖 userId 变化重新拉取，因此这里不需要手动触发刷新。
 */
export function useAuth(showToast) {
  const [session, setSession] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authReason, setAuthReason] = useState('account')

  useEffect(() => {
    if (!supabaseReady) return undefined
    let active = true
    supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const requireAuth = useCallback((reason) => {
    setAuthReason(reason)
    setAuthOpen(true)
  }, [])

  const closeAuth = useCallback(() => setAuthOpen(false), [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    showToast('已退出登录，继续以访客身份浏览公开切片')
  }, [showToast])

  return {
    session,
    userId: session?.user?.id || null,
    authOpen,
    authReason,
    requireAuth,
    closeAuth,
    signOut,
  }
}
