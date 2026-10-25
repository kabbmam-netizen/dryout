import { ArrowUpRight, Star } from 'lucide-react'
import { SOURCE_TYPES } from '../lib/constants'

export default function DehydratedCard({ card, index, onOpen, onToggleStar }) {
  const source = SOURCE_TYPES[card.sourceType] || SOURCE_TYPES.article
  const number = String(index + 1).padStart(3, '0')

  return (
    <article className={`archive-card archive-card--${card.sourceType} ${index === 0 ? 'is-featured' : ''}`}>
      <button className="card-main" type="button" onClick={() => onOpen(card.id)} aria-label={`阅读归档：${card.title}`}>
        <div className="card-topline">
          <span className="source-stamp"><i className={`geo geo--${source.shape}`} /><source.Icon size={14} />{source.short}</span>
          <span className="archive-number">DRY—{number}</span>
        </div>
        <blockquote>“{card.golden_quote}”</blockquote>
        <div className="card-summary"><span>ONE CLEAR IDEA</span><p>{card.one_line_summary}</p></div>
        <div className="card-title">{card.title}</div>
        <div className="card-bottom">
          <div className="card-tags">{card.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
          <span className="open-card">阅读切片<ArrowUpRight size={17} /></span>
        </div>
      </button>
      <button type="button" className={`card-star ${card.starred ? 'is-starred' : ''}`} onClick={() => onToggleStar(card.id)} aria-label={card.starred ? '取消星标' : '添加星标'} aria-pressed={card.starred}><Star size={19} fill={card.starred ? 'currentColor' : 'none'} /></button>
      <span className="card-geometry" aria-hidden="true"><i className={`geo geo--${source.shape}`} /></span>
    </article>
  )
}
