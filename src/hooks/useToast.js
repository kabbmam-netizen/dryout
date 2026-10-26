import { useCallback, useEffect, useRef, useState } from 'react'

/** 单条 toast，新的覆盖旧的，3.2 秒后自动消失 */
export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const showToast = useCallback((message) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ id: Date.now(), message })
    timer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return { toast, showToast }
}
