import { ArrowUpRight, Star } from 'lucide-react'
import { SOURCE_TYPES } from '../lib/constants'

export default function DehydratedCard({ card, index, number, onOpen, onToggleStar, onToggleTag, activeTag }) {
  const source = SOURCE_TYPES[card.sourceType] || SOURCE_TYPES.article
  const code = String(number ?? index + 1).padStart(3, '0')

  return (
    <article className={`archive-card archive-card--${card.sourceType} ${index === 0 ? 'is-featured' : ''}`}>
      <div className="card-main">
        <button className="card-open-layer" type="button" onClick={() => onOpen(card.id)} aria-label={`阅读归档：${card.title}`} />
        <div className="card-topline">
          <span className="source-stamp"><i className={`geo geo--${source.shape}`} /><source.Icon size={14} />{source.short}</span>
          <span className="archive-number">DRY—{code}</span>
        </div>
        <blockquote>“{card.golden_quote}”</blockquote>
        <div className="card-summary"><span>ONE CLEAR IDEA</span><p>{card.one_line_summary}</p></div>
        <div className="card-title">{card.title}</div>
        <div className="card-bottom">
          <div className="card-tags">
            {card.tags.map((tag) => (
              <button key={tag} type="button" className={`tag-filter ${activeTag === tag ? 'is-active' : ''}`} aria-pressed={activeTag === tag} onClick={() => onToggleTag(tag)} title={`只看 #${tag}`}><span>#{tag}</span></button>
            ))}
          </div>
          <span className="open-card">阅读切片<ArrowUpRight size={17} /></span>
        </div>
      </div>
      <button type="button" className={`card-star ${card.starred ? 'is-starred' : ''}`} onClick={() => onToggleStar(card.id)} aria-label={card.starred ? '取消星标' : '添加星标'} aria-pressed={card.starred}><Star size={19} fill={card.starred ? 'currentColor' : 'none'} /></button>
      <span className="card-geometry" aria-hidden="true"><i className={`geo geo--${source.shape}`} /></span>
    </article>
  )
}
