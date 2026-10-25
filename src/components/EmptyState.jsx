import { SearchX } from 'lucide-react'

export default function EmptyState({ onClearFilters }) {
  return (
    <div className="empty-state">
      <span className="empty-shape" aria-hidden="true">◒</span>
      <SearchX size={28} />
      <h3>这一格暂时是空的</h3>
      <p>没有找到匹配的思想切片，换个关键词或清除筛选试试。</p>
      <button type="button" className="secondary-button" onClick={onClearFilters}>清除全部筛选</button>
    </div>
  )
}
