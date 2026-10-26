import { useEffect, useRef } from 'react'
import { ArrowDown, Circle, HardDrive, RotateCcw } from 'lucide-react'
import Header from './components/Header'
import DistillPanel from './components/DistillPanel'
import DehydratedCard from './components/DehydratedCard'
import DetailModal from './components/DetailModal'
import EmptyState from './components/EmptyState'
import Toast from './components/Toast'
import AuthDialog from './components/AuthDialog'
import { useAuth } from './hooks/useAuth'
import { useCards } from './hooks/useCards'
import { useTheme } from './hooks/useTheme'
import { useToast } from './hooks/useToast'
import { SOURCE_OPTIONS } from './lib/constants'

export default function App() {
  const { toast, showToast } = useToast()
  const { theme, setTheme } = useTheme()
  const { session, userId, authOpen, authReason, requireAuth, closeAuth, signOut } = useAuth(showToast)
  const archive = useCards({ userId, session, showToast, requireAuth })
  const searchRef = useRef(null)

  // 斜杠聚焦搜索框；登录弹窗打开时不抢焦点
  useEffect(() => {
    const handleKey = (event) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(event.target.tagName)
      if (event.key === '/' && !typing && !authOpen) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [authOpen])

  const handleSignOut = async () => {
    await signOut()
    archive.setActiveId(null)
  }

  return (
    <div className="app-shell" id="top">
      <Header
        query={archive.query}
        onQueryChange={archive.setQuery}
        starredOnly={archive.starredOnly}
        onToggleStarred={() => archive.setStarredOnly(!archive.starredOnly)}
        starredCount={archive.starredCount}
        theme={theme}
        onThemeChange={setTheme}
        session={session}
        onOpenAuth={() => requireAuth('account')}
        onSignOut={handleSignOut}
        searchRef={searchRef}
        activeTag={archive.activeTag}
        onClearTag={() => archive.setActiveTag(null)}
      />

      <main>
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="section-index">A MACHINE FOR CLEAR IDEAS — 2026</span>
            <h1 id="hero-title"><span>LONG</span><span>CONTENT.</span><span className="accent-word">LESS</span><span>NOISE.</span></h1>
            <p className="hero-translation">长内容进。<strong>好想法留下。</strong></p>
            <p className="hero-description">把播客、视频与深度长文，压缩成一句值得记住的话。<br />收藏观点，写下批注，再把它带走。</p>
            <div className="hero-geometry" aria-hidden="true"><span className="hero-circle" /><span className="hero-square" /><span className="hero-half" /><i>原稿<br />→<br />切片</i></div>
            <div className="hero-stats">
              <div><b>{String(archive.cards.length).padStart(2, '0')}</b><span>归档切片<br />ARCHIVED</span></div>
              <div><b>{String(archive.starredCount).padStart(2, '0')}</b><span>星标收藏<br />STARRED</span></div>
              <a href="#archive">浏览画廊<ArrowDown size={17} /></a>
            </div>
          </div>
          <DistillPanel onDistill={archive.handleDistill} canWrite={Boolean(session)} onRequireAuth={requireAuth} />
        </section>

        <section className="archive-section" id="archive" aria-labelledby="archive-title">
          <div className="archive-heading">
            <div><span className="section-index">SELECTED THOUGHTS / 02</span><h2 id="archive-title">思想切片<span>ARCHIVE</span></h2></div>
            <p>每一条归档，都是一次主动选择。<br /><b>{archive.visibleCards.length}</b> / {archive.cards.length} 张正在展出</p>
          </div>

          <div className="archive-toolbar">
            <div className="source-filters" role="group" aria-label="按来源筛选">
              <button type="button" className={archive.sourceFilter === 'all' ? 'is-active' : ''} onClick={() => archive.setSourceFilter('all')}><Circle size={13} />全部</button>
              {SOURCE_OPTIONS.map((source) => <button key={source.value} type="button" className={archive.sourceFilter === source.value ? 'is-active' : ''} onClick={() => archive.setSourceFilter(source.value)}><i className={`geo geo--${source.shape}`} />{source.label}</button>)}
            </div>
            {archive.filtering ? <button type="button" className="clear-filter" onClick={archive.clearFilters}><RotateCcw size={14} />重置筛选</button> : <span className="sort-note">按归档时间倒序 ↓</span>}
          </div>

          {archive.loadingCards ? (
            <p className="archive-loading">正在同步云端归档…</p>
          ) : archive.visibleCards.length ? (
            <div className="archive-grid">{archive.visibleCards.map((card, index) => <DehydratedCard key={card.id} card={card} index={index} number={archive.cardNumbers.get(card.id)} onOpen={archive.setActiveId} onToggleStar={archive.toggleStar} onToggleTag={archive.toggleTag} activeTag={archive.activeTag} />)}</div>
          ) : <EmptyState onClearFilters={archive.clearFilters} />}
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand"><span className="brand-mark" aria-hidden="true"><i /><b /><em /></span><strong>DRYOUT</strong></div>
        <p>LESS CONTENT.<br />MORE CLARITY.</p>
        <span><HardDrive size={15} />云端同步 · 归档与批注保存在你的账户</span>
        <a href="#top">回到顶部 ↑</a>
      </footer>

      {archive.activeCard && (
        <DetailModal
          card={archive.activeCard}
          onClose={() => archive.setActiveId(null)}
          onToggleStar={archive.toggleStar}
          onSaveNote={archive.saveNote}
          onDelete={archive.deleteCard}
          onToggleVisibility={archive.toggleVisibility}
          onToast={showToast}
          authOpen={authOpen}
          isOwner={Boolean(session) && archive.activeCard.userId === userId}
        />
      )}
      <AuthDialog open={authOpen} reason={authReason} onClose={closeAuth} />
      <Toast toast={toast} />
    </div>
  )
}
