import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deleteCardById, fetchCards, insertCard, savePersonalState, updateCardVisibility } from '../lib/cardsApi'
import { matchesQuery } from '../lib/distill'
import { supabaseReady } from '../lib/supabase'

/** 归档数据与四维筛选。星标 / 批注 / 可见性都是乐观更新，失败回滚。 */
export function useCards({ userId, session, showToast, requireAuth }) {
  const [cards, setCards] = useState([])
  const [loadingCards, setLoadingCards] = useState(true)
  const loadedRef = useRef(false)

  const [query, setQuery] = useState('')
  const [starredOnly, setStarredOnly] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [activeTag, setActiveTag] = useState(null)
  const [activeId, setActiveId] = useState(null)

  const refreshCards = useCallback(async () => {
    if (!supabaseReady) {
      setLoadingCards(false)
      return
    }
    // 只有首屏显示加载态；登录态变化触发的刷新保留旧列表，避免闪一下空态
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

  const visibleCards = useMemo(
    () =>
      cards.filter((card) => {
        if (starredOnly && !card.starred) return false
        if (sourceFilter !== 'all' && card.sourceType !== sourceFilter) return false
        if (activeTag && !(card.tags || []).includes(activeTag)) return false
        return matchesQuery(card, query)
      }),
    [cards, query, sourceFilter, starredOnly, activeTag],
  )

  // 馆藏编号：按入库先后（createdAt 升序）一次性分配，与筛选结果和展示顺序无关
  const cardNumbers = useMemo(() => {
    const ordered = [...cards].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    return new Map(ordered.map((card, index) => [card.id, index + 1]))
  }, [cards])

  const handleDistill = async (draft, meta = {}) => {
    if (!session) {
      requireAuth('distill')
      return false
    }
    try {
      const created = await insertCard({ ...draft, key_takeaways: draft.key_takeaways.slice(0, 3) }, session.user.id)
      setCards((previous) => [created, ...previous])
      setQuery('')
      setSourceFilter('all')
      setStarredOnly(false)
      setActiveTag(null)
      showToast(meta.aiFallback ? '大模型暂不可用，已用本地算法完成归档' : '新切片已压入云端归档，点击继续阅读与导出')
      setTimeout(() => document.getElementById('archive')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
      return true
    } catch (error) {
      showToast(`归档写入失败：${error.message || '请稍后重试'}`)
      return false
    }
  }

  const toggleStar = async (id) => {
    if (!session) {
      requireAuth('star')
      return
    }
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
    if (!session) {
      requireAuth('note')
      return false
    }
    const card = cards.find((item) => item.id === id)
    if (!card) return false
    const before = { personal_note: card.personal_note, noteUpdatedAt: card.noteUpdatedAt, hasOwnNote: card.hasOwnNote }
    const stamp = new Date().toISOString()
    setCards((previous) =>
      previous.map((item) => (item.id === id ? { ...item, personal_note: note, noteUpdatedAt: stamp, hasPersonal: true, hasOwnNote: true } : item)),
    )
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

  const toggleVisibility = async (id, isPublic) => {
    if (!session) {
      requireAuth('visibility')
      return false
    }
    const card = cards.find((item) => item.id === id)
    if (!card) return false
    if (card.userId !== session.user.id) {
      showToast('只能修改自己创建的切片')
      return false
    }
    setCards((previous) => previous.map((item) => (item.id === id ? { ...item, isPublic } : item)))
    try {
      await updateCardVisibility(id, isPublic)
      showToast(isPublic ? '已公开，访客现在能看到这张切片' : '已转为私密，只有你自己可见')
      return true
    } catch (error) {
      setCards((previous) => previous.map((item) => (item.id === id ? { ...item, isPublic: !isPublic } : item)))
      showToast(error.name === 'PermissionError' ? '这张切片不属于当前账户，无法修改可见性' : '可见性切换失败，请稍后重试')
      return false
    }
  }

  const deleteCard = async (id) => {
    if (!session) {
      requireAuth('delete')
      return false
    }
    const card = cards.find((item) => item.id === id)
    if (!card) return false
    if (card.userId !== session.user.id) {
      showToast('只能删除自己创建的切片')
      return false
    }
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

  const clearFilters = () => {
    setQuery('')
    setStarredOnly(false)
    setSourceFilter('all')
    setActiveTag(null)
  }

  const toggleTag = (tag) => setActiveTag((previous) => (previous === tag ? null : tag))

  return {
    cards,
    loadingCards,
    visibleCards,
    cardNumbers,
    starredCount: cards.filter((card) => card.starred).length,
    filtering: Boolean(query.trim() || starredOnly || sourceFilter !== 'all' || activeTag),
    activeCard: cards.find((card) => card.id === activeId) || null,
    query,
    setQuery,
    starredOnly,
    setStarredOnly,
    sourceFilter,
    setSourceFilter,
    activeTag,
    setActiveTag,
    activeId,
    setActiveId,
    clearFilters,
    toggleTag,
    handleDistill,
    toggleStar,
    saveNote,
    toggleVisibility,
    deleteCard,
  }
}
