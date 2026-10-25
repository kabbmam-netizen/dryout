import { SOURCE_TYPES } from '../lib/constants'

export function formatPosterDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export default function QuotePoster({ card, theme }) {
  const source = SOURCE_TYPES[card.sourceType] || SOURCE_TYPES.article
  return (
    <div className={`quote-poster quote-poster--${theme}`} aria-label={`${theme} 金句藏书票预览`}>
      <span className="poster-orbit" aria-hidden="true" />
      <span className="poster-block" aria-hidden="true" />
      <span className="poster-semicircle" aria-hidden="true" />
      <div className="poster-head"><strong>DRYOUT<span>®</span></strong><span>{formatPosterDate(card.createdAt)}</span></div>
      <div className="poster-kicker"><i className={`geo geo--${source.shape}`} />THOUGHT / 思想切片</div>
      <blockquote>“{card.golden_quote}”</blockquote>
      <div className="poster-footer">
        <span className="poster-source">{source.short} — {card.sourceName}</span>
        <h4>{card.title}</h4>
        <div><span>{card.tags.slice(0, 2).map((tag) => `#${tag}`).join('  ')}</span><b>DRY / {card.id.slice(-3).toUpperCase()}</b></div>
      </div>
    </div>
  )
}
