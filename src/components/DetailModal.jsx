import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, Check, Copy, Loader2, NotebookPen, Save, Star, X } from 'lucide-react'
import { POSTER_THEMES, SOURCE_TYPES } from '../lib/constants'
import { downloadQuotePoster } from '../lib/exportPoster'
import QuotePoster, { formatPosterDate } from './QuotePoster'

export default function DetailModal({ card, onClose, onToggleStar, onSaveNote, onToast }) {
  const [note, setNote] = useState(card.personal_note || '')
  const [theme, setTheme] = useState('primary')
  const [downloading, setDownloading] = useState(false)
  const [saved, setSaved] = useState(false)
  const panelRef = useRef(null)
  const source = SOURCE_TYPES[card.sourceType] || SOURCE_TYPES.article
  const dirty = note !== (card.personal_note || '')

  useEffect(() => {
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    const handleKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener('keydown', handleKey) }
  }, [onClose])

  const save = () => {
    if (!dirty) return
    onSaveNote(card.id, note.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const copyQuote = async () => {
    const content = `“${card.golden_quote}”\n—— ${card.title} / DRYOUT`
    try { await navigator.clipboard.writeText(content); onToast('金句与来源已复制') }
    catch { onToast('复制受限，请直接选择金句文字') }
  }

  const download = async () => {
    setDownloading(true)
    try { await downloadQuotePoster(card, theme); onToast('高清藏书票 PNG 已下载') }
    catch { onToast('导出失败，请稍后重试') }
    finally { setDownloading(false) }
  }

  return (
    <div className="drawer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="detail-drawer" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="detail-title" tabIndex={-1}>
        <div className="drawer-topbar"><span>ARCHIVE DETAIL / 归档详情</span><span>{formatPosterDate(card.createdAt)}</span><button type="button" onClick={onClose} aria-label="关闭详情"><X size={22} /></button></div>
        <div className="drawer-columns">
          <div className="detail-reading">
            <div className="detail-source"><span className={`source-stamp source-stamp--${card.sourceType}`}><i className={`geo geo--${source.shape}`} /><source.Icon size={14} />{source.label}</span><span>{card.sourceName} · {card.meta}</span></div>
            <h2 id="detail-title">{card.title}</h2>
            <button type="button" className={`detail-star ${card.starred ? 'is-starred' : ''}`} onClick={() => onToggleStar(card.id)}><Star size={16} fill={card.starred ? 'currentColor' : 'none'} />{card.starred ? '已星标收藏' : '加入星标收藏'}</button>
            <blockquote className="detail-quote">“{card.golden_quote}”</blockquote>
            <div className="detail-summary"><span className="eyebrow">ONE CLEAR IDEA / 核心结论</span><p>{card.one_line_summary}</p></div>

            <section className="takeaways-section">
              <div className="detail-section-title"><span>01—03</span><h3>三段式结构化论据</h3></div>
              <ol>{card.key_takeaways.slice(0, 3).map((item, index) => <li key={`${item}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{['看见问题', '理解逻辑', '带走行动'][index]}</small><p>{item}</p></div></li>)}</ol>
            </section>

            <section className="notes-section">
              <div className="detail-section-title"><NotebookPen size={20} /><h3>个人批注</h3><span>{dirty ? '有未保存修改' : '仅本地保存'}</span></div>
              <textarea value={note} onChange={(event) => { setNote(event.target.value); setSaved(false) }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); save() } }} placeholder="它为什么戳中你？你准备把它用在哪里？" rows={5} />
              <div className="note-actions"><span>{note.length} 字 · Ctrl / ⌘ + Enter</span><button type="button" onClick={save} disabled={!dirty}>{saved ? <Check size={16} /> : <Save size={16} />}{saved ? '已保存' : '保存批注'}</button></div>
            </section>
          </div>

          <aside className="poster-studio">
            <div className="studio-heading"><div><span className="eyebrow">EXPORT STUDIO / 02</span><h3>金句藏书票</h3></div><span>1080 × 1440 PNG</span></div>
            <QuotePoster card={card} theme={theme} />
            <div className="poster-theme-list" role="group" aria-label="藏书票配色">
              {POSTER_THEMES.map((item) => <button type="button" key={item.value} className={`poster-theme poster-theme--${item.value} ${theme === item.value ? 'is-active' : ''}`} onClick={() => setTheme(item.value)} aria-pressed={theme === item.value}><i /><span>{item.label}</span>{theme === item.value && <Check size={14} />}</button>)}
            </div>
            <button type="button" className="download-button" onClick={download} disabled={downloading}>{downloading ? <Loader2 size={18} className="spin" /> : <ArrowDownToLine size={18} />}{downloading ? '正在制版…' : '下载高清藏书票'}</button>
            <button type="button" className="copy-button" onClick={copyQuote}><Copy size={16} />复制金句与来源</button>
          </aside>
        </div>
      </section>
    </div>
  )
}
