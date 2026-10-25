import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Loader2, Lock, Mail, X } from 'lucide-react'
import { requireSupabase } from '../lib/supabase'
import { toChineseAuthError } from '../lib/cardsApi'

const REASONS = {
  distill: '登录后才能把这张切片存进云端归档。',
  star: '登录后才能保存你的星标收藏。',
  note: '登录后才能保存个人批注。',
  delete: '登录后才能删除自己创建的切片。',
  account: '登录后，归档、星标与批注会同步到云端。',
}

export default function AuthDialog({ open, reason = 'account', onClose, onSignedIn }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const emailRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    setError('')
    setNotice('')
    const timer = window.setTimeout(() => emailRef.current?.focus(), 60)
    const handleKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => { window.clearTimeout(timer); window.removeEventListener('keydown', handleKey) }
  }, [open, onClose])

  if (!open) return null

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setNotice('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const client = requireSupabase()
      const credentials = { email: email.trim(), password }
      if (mode === 'signin') {
        const { error: signInError } = await client.auth.signInWithPassword(credentials)
        if (signInError) throw signInError
        onSignedIn?.()
        onClose()
      } else {
        const { data, error: signUpError } = await client.auth.signUp(credentials)
        if (signUpError) throw signUpError
        if (!data.session) {
          setMode('signin')
          setNotice('注册成功，请先到邮箱完成验证，再回来登录。')
          return
        }
        onSignedIn?.()
        onClose()
      }
    } catch (err) {
      setError(toChineseAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  const signingIn = mode === 'signin'

  return (
    <div className="auth-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="auth-topbar">
          <span>ACCOUNT / 账户</span>
          <button type="button" onClick={onClose} aria-label="关闭登录框"><X size={20} /></button>
        </div>

        <div className="auth-body">
          <h2 id="auth-title">{signingIn ? '登录，把切片存到云端' : '注册一个账户'}</h2>
          <p className="auth-lead">{REASONS[reason] || REASONS.account}</p>

          <div className="auth-switch" role="group" aria-label="登录或注册">
            <button type="button" className={signingIn ? 'is-active' : ''} onClick={() => switchMode('signin')} aria-pressed={signingIn}>登录</button>
            <button type="button" className={!signingIn ? 'is-active' : ''} onClick={() => switchMode('signup')} aria-pressed={!signingIn}>注册</button>
          </div>

          <form onSubmit={submit}>
            <label className="console-label" htmlFor="auth-email">邮箱 <span>EMAIL</span></label>
            <div className="auth-field">
              <Mail size={15} aria-hidden="true" />
              <input id="auth-email" ref={emailRef} type="email" required autoComplete="email" value={email} disabled={busy} onChange={(event) => { setEmail(event.target.value); setError('') }} placeholder="you@example.com" />
            </div>

            <label className="console-label" htmlFor="auth-password">密码 <span>PASSWORD</span></label>
            <div className="auth-field">
              <Lock size={15} aria-hidden="true" />
              <input id="auth-password" type="password" required minLength={6} autoComplete={signingIn ? 'current-password' : 'new-password'} value={password} disabled={busy} onChange={(event) => { setPassword(event.target.value); setError('') }} placeholder="至少 6 位" />
            </div>

            {notice && <p className="auth-notice" role="status">{notice}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}

            <button type="submit" className="primary-action auth-submit" disabled={busy}>
              {busy ? <Loader2 size={18} className="spin" /> : <ArrowRight size={18} />}
              <span>{busy ? '正在处理…' : signingIn ? '登录账户' : '注册并登录'}</span>
            </button>
          </form>

          <p className="auth-foot">未登录也可以浏览 6 张公开切片；登录后新增的切片只有你自己能改。</p>
        </div>
      </section>
    </div>
  )
}
