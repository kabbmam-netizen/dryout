import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Circle, HardDrive, RotateCcw, Square, Star } from 'lucide-react'
import Header from './components/Header'
import DistillPanel from './components/DistillPanel'
import DehydratedCard from './components/DehydratedCard'
import DetailModal from './components/DetailModal'
import EmptyState from './components/EmptyState'
import Toast from './components/Toast'
import { MOCK_CARDS } from './data/mockCards'
import { SOURCE_OPTIONS } from './lib/constants'
import { matchesQuery } from './lib/distill'

const CARDS_KEY = 'dryout.cards.v2'
const THEME_KEY = 'dryout.theme.v2'
const ACCOUNT_KEY = 'dryout.account.v2'

function loadValue(key, fallback) {
  try {
    const value = window.localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch { return fallback }
}

export default function App() {
  const [cards, setCards] = useState(() => {
    const stored = loadValue(CARDS_KEY, MOCK_CARDS)
    return Array.isArray(stored) && stored.length ? stored : MOCK_CARDS
  })
  const [query, setQuery] = useState('')
  const [starredOnly, setStarredOnly] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [activeTag, setActiveTag] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [theme, setTheme] = useState(() => loadValue(THEME_KEY, 'primary'))
  const [loggedIn, setLoggedIn] = useState(() => loadValue(ACCOUNT_KEY, false))
  const [toast, setToast] = useState(null)
  const searchRef = useRef(null)
  const toastTimer = useRef(null)

  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), message })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])
  useEffect(() => { window.localStorage.setItem(CARDS_KEY, JSON.stringify(cards)) }, [cards])
  useEffect(() => { window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(loggedIn)) }, [loggedIn])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme === 'night' ? 'dark' : 'light'
    window.localStorage.setItem(THEME_KEY, JSON.stringify(theme))
  }, [theme])

  useEffect(() => {
    const handleKey = (event) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(event.target.tagName)
      if (event.key === '/' && !typing) { event.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const visibleCards = useMemo(() => cards.filter((card) => {
    if (starredOnly && !card.starred) return false
    if (sourceFilter !== 'all' && card.sourceType !== sourceFilter) return false
    if (activeTag && !(card.tags || []).includes(activeTag)) return false
    return matchesQuery(card, query)
  }), [cards, query, sourceFilter, starredOnly, activeTag])

  // 馆藏编号：按入库先后（createdAt 升序）一次性分配，与筛选结果和展示顺序无关
  const cardNumbers = useMemo(() => {
    const ordered = [...cards].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    return new Map(ordered.map((card, index) => [card.id, index + 1]))
  }, [cards])

  const activeCard = cards.find((card) => card.id === activeId) || null
  const starredCount = cards.filter((card) => card.starred).length
  const filtering = Boolean(query.trim() || starredOnly || sourceFilter !== 'all' || activeTag)

  const handleDistill = (draft) => {
    const card = { ...draft, id: `card-${Date.now()}`, createdAt: new Date().toISOString(), key_takeaways: draft.key_takeaways.slice(0, 3) }
    setCards((previous) => [card, ...previous])
    setQuery(''); setSourceFilter('all'); setStarredOnly(false); setActiveTag(null)
    showToast('新切片已压入归档，点击继续阅读与导出')
    setTimeout(() => document.getElementById('archive')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
  }

  const toggleStar = (id) => setCards((previous) => previous.map((card) => card.id === id ? { ...card, starred: !card.starred } : card))
  const saveNote = (id, note) => {
    setCards((previous) => previous.map((card) => card.id === id ? { ...card, personal_note: note, noteUpdatedAt: new Date().toISOString() } : card))
    showToast('个人批注已保存到这张切片')
  }
  const clearFilters = () => { setQuery(''); setStarredOnly(false); setSourceFilter('all'); setActiveTag(null) }
  const toggleTag = (tag) => setActiveTag((previous) => (previous === tag ? null : tag))

  return (
    <div className="app-shell" id="top">
      <Header query={query} onQueryChange={setQuery} starredOnly={starredOnly} onToggleStarred={() => setStarredOnly(!starredOnly)} starredCount={starredCount} theme={theme} onThemeChange={setTheme} loggedIn={loggedIn} onLoginChange={setLoggedIn} searchRef={searchRef} activeTag={activeTag} onClearTag={() => setActiveTag(null)} />

      <main>
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="section-index">A MACHINE FOR CLEAR IDEAS — 2026</span>
            <h1 id="hero-title"><span>LONG</span><span>CONTENT.</span><span className="accent-word">LESS</span><span>NOISE.</span></h1>
            <p className="hero-translation">长内容进。<strong>好想法留下。</strong></p>
            <p className="hero-description">把播客、视频与深度长文，压缩成一句值得记住的话。<br />收藏观点，写下批注，再把它带走。</p>
            <div className="hero-geometry" aria-hidden="true"><span className="hero-circle" /><span className="hero-square" /><span className="hero-half" /><i>原稿<br />→<br />切片</i></div>
            <div className="hero-stats">
              <div><b>{String(cards.length).padStart(2, '0')}</b><span>归档切片<br />ARCHIVED</span></div>
              <div><b>{String(starredCount).padStart(2, '0')}</b><span>星标收藏<br />STARRED</span></div>
              <a href="#archive">浏览画廊<ArrowDown size={17} /></a>
            </div>
          </div>
          <DistillPanel onDistill={handleDistill} />
        </section>

        <section className="archive-section" id="archive" aria-labelledby="archive-title">
          <div className="archive-heading">
            <div><span className="section-index">SELECTED THOUGHTS / 02</span><h2 id="archive-title">思想切片<span>ARCHIVE</span></h2></div>
            <p>每一条归档，都是一次主动选择。<br /><b>{visibleCards.length}</b> / {cards.length} 张正在展出</p>
          </div>

          <div className="archive-toolbar">
            <div className="source-filters" role="group" aria-label="按来源筛选">
              <button type="button" className={sourceFilter === 'all' ? 'is-active' : ''} onClick={() => setSourceFilter('all')}><Circle size={13} />全部</button>
              {SOURCE_OPTIONS.map((source) => <button key={source.value} type="button" className={sourceFilter === source.value ? 'is-active' : ''} onClick={() => setSourceFilter(source.value)}><i className={`geo geo--${source.shape}`} />{source.label}</button>)}
            </div>
            {filtering ? <button type="button" className="clear-filter" onClick={clearFilters}><RotateCcw size={14} />重置筛选</button> : <span className="sort-note">按归档时间倒序 ↓</span>}
          </div>

          {visibleCards.length ? (
            <div className="archive-grid">{visibleCards.map((card, index) => <DehydratedCard key={card.id} card={card} index={index} number={cardNumbers.get(card.id)} onOpen={setActiveId} onToggleStar={toggleStar} onToggleTag={toggleTag} activeTag={activeTag} />)}</div>
          ) : <EmptyState onClearFilters={clearFilters} />}
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand"><span className="brand-mark" aria-hidden="true"><i /><b /><em /></span><strong>DRYOUT</strong></div>
        <p>LESS CONTENT.<br />MORE CLARITY.</p>
        <span><HardDrive size={15} />本地优先 · 原稿与批注不会上传</span>
        <a href="#top">回到顶部 ↑</a>
      </footer>

      {activeCard && <DetailModal card={activeCard} onClose={() => setActiveId(null)} onToggleStar={toggleStar} onSaveNote={saveNote} onToast={showToast} />}
      <Toast toast={toast} />
    </div>
  )
}
