import { Check } from 'lucide-react'

export default function Toast({ toast }) {
  if (!toast) return null
  return <div className="toast" role="status" aria-live="polite"><span><Check size={15} strokeWidth={3} /></span>{toast.message}</div>
}
