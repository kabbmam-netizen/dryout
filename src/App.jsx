import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Circle, HardDrive, RotateCcw } from 'lucide-react'
import Header from './components/Header'
import DistillPanel from './components/DistillPanel'
import DehydratedCard from './components/DehydratedCard'
import DetailModal from './components/DetailModal'
import EmptyState from './components/EmptyState'
import Toast from './components/Toast'
import AuthDialog from './components/AuthDialog'
import { SOURCE_OPTIONS } from './lib/constants'
import { matchesQuery } from './lib/distill'
import { supabase, supabaseReady } from './lib/supabase'
import { deleteCardById, fetchCards, insertCard, savePersonalState } from './lib/cardsApi'

const THEME_KEY = 'dryout.theme.v2'

function loadValue(key, fallback) {
  try {
    const value = window.localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch { return fallback }
}

export default function App() {
  const [cards, setCards] = useState([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [session, setSession] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authReason, setAuthReason] = useState('account')

  const [query, setQuery] = useState('')
  const [starredOnly, setStarredOnly] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [activeTag, setActiveTag] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [theme, setTheme] = useState(() => loadValue(THEME_KEY, 'primary'))
  const [toast, setToast] = useState(null)
  const searchRef = useRef(null)
  const toastTimer = useRef(null)

  const userId = session?.user?.id || null

  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), message })
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  const requireAuth = useCallback((reason) => {
    setAuthReason(reason)
    setAuthOpen(true)
  }, [])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme === 'night' ? 'dark' : 'light'
    window.localStorage.setItem(THEME_KEY, JSON.stringify(theme))
  }, [theme])

  // 登录态：读取已有会话并订阅变化
  useEffect(() => {
    if (!supabaseReady) { setLoadingCards(false); return undefined }
    let active = true
    supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  const loadedRef = useRef(false)

  const refreshCards = useCallback(async () => {
    if (!supabaseReady) { setLoadingCards(false); return }
    if (!loadedRef.current) setLoadingCards(true)
    try {
      setCards(await fetchCards(userId))
      loadedRef.current = true
    } catch {
      showToast('云端归档拉取失败，请检查网络后刷新页面')
    } finally {
      setLoadingCards(false)
    }
  }, [showToast, userId])

  // 访客看到公开切片；登录后重新拉取，把本人的星标与批注合并进来
  useEffect(() => { refreshCards() }, [refreshCards])

  useEffect(() => {
    const handleKey = (event) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(event.target.tagName)
      if (event.key === '/' && !typing && !authOpen) { event.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [authOpen])

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

  const handleDistill = async (draft) => {
    if (!session) { requireAuth('distill'); return false }
    try {
      const created = await insertCard({ ...draft, key_takeaways: draft.key_takeaways.slice(0, 3) }, session.user.id)
      setCards((previous) => [created, ...previous])
      setQuery(''); setSourceFilter('all'); setStarredOnly(false); setActiveTag(null)
      showToast('新切片已压入云端归档，点击继续阅读与导出')
      setTimeout(() => document.getElementById('archive')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
      return true
    } catch (error) {
      showToast(`归档写入失败：${error.message || '请稍后重试'}`)
      return false
    }
  }

  const toggleStar = async (id) => {
    if (!session) { requireAuth('star'); return }
    const card = cards.find((item) => item.id === id)
    if (!card) return
    const next = !card.starred
    setCards((previous) => previous.map((item) => (item.id === id ? { ...item, starred: next, hasPersonal: true } : item)))
    try {
      await savePersonalState(id, session.user.id, { starred: next })
    } catch (error) {
      setCards((previous) => previous.map((item) => (item.id === id ? { ...item, starred: !next } : item)))
      showToast(error.name === 'PermissionError' ? '星标没有保存成功，请重新登录后再试' : '星标保存失败，请稍后重试')
    }
  }

  const saveNote = async (id, note) => {
    if (!session) { requireAuth('note'); return false }
    const card = cards.find((item) => item.id === id)
    if (!card) return false
    const before = { personal_note: card.personal_note, noteUpdatedAt: card.noteUpdatedAt, hasOwnNote: card.hasOwnNote }
    const stamp = new Date().toISOString()
    setCards((previous) => previous.map((item) => (item.id === id ? { ...item, personal_note: note, noteUpdatedAt: stamp, hasPersonal: true, hasOwnNote: true } : item)))
    try {
      await savePersonalState(id, session.user.id, { personal_note: note, note_updated_at: stamp })
      showToast('个人批注已同步到云端')
      return true
    } catch (error) {
      setCards((previous) => previous.map((item) => (item.id === id ? { ...item, ...before } : item)))
      showToast(error.name === 'PermissionError' ? '批注没有保存成功，请重新登录后再试' : '批注保存失败，请稍后重试')
      return false
    }
  }

  const deleteCard = async (id) => {
    if (!session) { requireAuth('delete'); return false }
    const card = cards.find((item) => item.id === id)
    if (!card) return false
    if (card.userId !== session.user.id) { showToast('只能删除自己创建的切片'); return false }
    try {
      await deleteCardById(id)
      setCards((previous) => previous.filter((item) => item.id !== id))
      setActiveId(null)
      showToast('切片已从云端归档中删除')
      return true
    } catch (error) {
      showToast(error.name === 'PermissionError' ? '这张切片不属于当前账户，无法删除' : '删除失败，请稍后重试')
      return false
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setActiveId(null)
    showToast('已退出登录，继续以访客身份浏览公开切片')
  }

  const clearFilters = () => { setQuery(''); setStarredOnly(false); setSourceFilter('all'); setActiveTag(null) }
  const toggleTag = (tag) => setActiveTag((previous) => (previous === tag ? null : tag))

  return (
    <div className="app-shell" id="top">
      <Header query={query} onQueryChange={setQuery} starredOnly={starredOnly} onToggleStarred={() => setStarredOnly(!starredOnly)} starredCount={starredCount} theme={theme} onThemeChange={setTheme} session={session} onOpenAuth={() => requireAuth('account')} onSignOut={signOut} searchRef={searchRef} activeTag={activeTag} onClearTag={() => setActiveTag(null)} />

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
          <DistillPanel onDistill={handleDistill} canWrite={Boolean(session)} onRequireAuth={requireAuth} />
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

          {loadingCards ? (
            <p className="archive-loading">正在同步云端归档…</p>
          ) : visibleCards.length ? (
            <div className="archive-grid">{visibleCards.map((card, index) => <DehydratedCard key={card.id} card={card} index={index} number={cardNumbers.get(card.id)} onOpen={setActiveId} onToggleStar={toggleStar} onToggleTag={toggleTag} activeTag={activeTag} />)}</div>
          ) : <EmptyState onClearFilters={clearFilters} />}
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand"><span className="brand-mark" aria-hidden="true"><i /><b /><em /></span><strong>DRYOUT</strong></div>
        <p>LESS CONTENT.<br />MORE CLARITY.</p>
        <span><HardDrive size={15} />云端同步 · 归档与批注保存在你的账户</span>
        <a href="#top">回到顶部 ↑</a>
      </footer>

      {activeCard && <DetailModal card={activeCard} onClose={() => setActiveId(null)} onToggleStar={toggleStar} onSaveNote={saveNote} onDelete={deleteCard} onToast={showToast} authOpen={authOpen} isOwner={Boolean(session) && activeCard.userId === userId} />}
      <AuthDialog open={authOpen} reason={authReason} onClose={() => setAuthOpen(false)} />
      <Toast toast={toast} />
    </div>
  )
}
