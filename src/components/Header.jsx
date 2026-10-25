import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, LogIn, LogOut, Search, Star, UserRound, X } from 'lucide-react'
import { APP_THEMES } from '../lib/constants'

export default function Header({ query, onQueryChange, starredOnly, onToggleStarred, starredCount, theme, onThemeChange, loggedIn, onLoginChange, searchRef, activeTag, onClearTag }) {
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef(null)

  useEffect(() => {
    if (!accountOpen) return undefined
    const close = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [accountOpen])

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
          <button type="button" className={`account-trigger ${loggedIn ? 'is-logged' : ''}`} onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen}>
            <span className="account-avatar">{loggedIn ? 'LI' : <UserRound size={17} />}</span>
            <span className="account-copy"><b>{loggedIn ? 'LI' : '本地访客'}</b><small>{loggedIn ? '演示已登录' : '未登录'}</small></span>
            <ChevronDown size={13} />
          </button>
          {accountOpen && (
            <div className="account-popover">
              <span className="eyebrow">ACCOUNT / 账户</span>
              <h3>{loggedIn ? '你好，LI。' : '你的内容，留在这里。'}</h3>
              <p>当前为作品集演示，归档与批注仅保存在此浏览器。登录按钮用于演示账户状态，不会上传数据。</p>
              <div className="local-status"><Check size={15} /><span>本地存储运行正常</span></div>
              <button type="button" className="account-login" onClick={() => { onLoginChange(!loggedIn); setAccountOpen(false) }}>
                {loggedIn ? <LogOut size={16} /> : <LogIn size={16} />}
                {loggedIn ? '退出演示账户' : '进入演示账户'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
