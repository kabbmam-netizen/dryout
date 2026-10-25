import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, LogIn, LogOut, Search, Star, UserRound, X } from 'lucide-react'
import { APP_THEMES } from '../lib/constants'

export default function Header({ query, onQueryChange, starredOnly, onToggleStarred, starredCount, theme, onThemeChange, session, onOpenAuth, onSignOut, searchRef, activeTag, onClearTag }) {
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef(null)

  const email = session?.user?.email || ''
  const loggedIn = Boolean(session)
  const handle = email ? email.split('@')[0] : ''
  const initial = handle ? handle.slice(0, 2).toUpperCase() : ''

  useEffect(() => {
    if (!accountOpen) return undefined
    const close = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [accountOpen])

  useEffect(() => { if (!loggedIn) setAccountOpen(false) }, [loggedIn])

  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="DRYOUT 首页">
        <span className="brand-mark" aria-hidden="true"><i /><b /><em /></span>
        <span className="brand-word">DRYOUT<span>内容切片机</span></span>
      </a>

      <div className="global-search" role="search">
        <Search size={17} aria-hidden="true" />
        <label className="sr-only" htmlFor="global-search-input">搜索标题、金句或标签</label>
        <input id="global-search-input" ref={searchRef} type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索标题 / 金句 / 标签" />
        {activeTag && (
          <button type="button" className="active-tag-badge" onClick={() => { onClearTag(); searchRef.current?.focus() }} aria-label={`清除标签筛选 ${activeTag}`}>
            <span>#{activeTag}</span><X size={13} aria-hidden="true" />
          </button>
        )}
        {query ? (
          <button type="button" className="search-clear" onClick={() => onQueryChange('')} aria-label="清空搜索"><X size={15} /></button>
        ) : activeTag ? null : <kbd>/</kbd>}
      </div>

      <div className="header-actions">
        <button type="button" className={`star-filter ${starredOnly ? 'is-active' : ''}`} onClick={onToggleStarred} aria-pressed={starredOnly}>
          <Star size={16} fill={starredOnly ? 'currentColor' : 'none'} />
          <span>仅看星标</span><b>{String(starredCount).padStart(2, '0')}</b>
        </button>

        <div className="theme-switcher" role="group" aria-label="切换视觉风格">
          {APP_THEMES.map((item, index) => (
            <button key={item.value} type="button" className={`theme-option theme-option--${item.value} ${theme === item.value ? 'is-active' : ''}`} onClick={() => onThemeChange(item.value)} aria-label={item.label} aria-pressed={theme === item.value} title={item.label}>
              <span aria-hidden="true">{index === 0 ? '●' : index === 1 ? '■' : '◐'}</span>
              <small>{item.short}</small>
            </button>
          ))}
        </div>

        <div className="account" ref={accountRef}>
          {loggedIn ? (
            <button type="button" className="account-trigger is-logged" onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen} aria-haspopup="menu">
              <span className="account-avatar">{initial || 'ME'}</span>
              <span className="account-copy"><b>{handle}</b><small>已连接云端</small></span>
              <ChevronDown size={13} />
            </button>
          ) : (
            <button type="button" className="account-trigger" onClick={() => onOpenAuth()} aria-haspopup="dialog">
              <span className="account-avatar"><UserRound size={17} /></span>
              <span className="account-copy"><b>本地访客</b><small>登录 / 注册</small></span>
              <LogIn size={14} />
            </button>
          )}

          {loggedIn && accountOpen && (
            <div className="account-popover">
              <span className="eyebrow">ACCOUNT / 账户</span>
              <h3>{handle ? `你好，${handle}。` : '你好。'}</h3>
              <p>{email}</p>
              <p>归档、星标与批注已同步到云端；只有你本人能修改自己创建的切片。</p>
              <div className="local-status"><Check size={15} /><span>云端数据库连接正常</span></div>
              <button type="button" className="account-login" onClick={() => { setAccountOpen(false); onSignOut() }}>
                <LogOut size={16} />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
