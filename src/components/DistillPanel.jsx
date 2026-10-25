import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, FileInput, Loader2, Sparkles } from 'lucide-react'
import { SAMPLE_TRANSCRIPT, SOURCE_OPTIONS, sleep } from '../lib/constants'
import { distillContent } from '../lib/distill'

const STEPS = ['接收原稿', '压缩 noise', '拣选金句', '切片归档']

export default function DistillPanel({ onDistill }) {
  const [title, setTitle] = useState('')
  const [sourceType, setSourceType] = useState('podcast')
  const [text, setText] = useState('')
  const [progress, setProgress] = useState(-1)
  const [error, setError] = useState('')
  const textareaRef = useRef(null)
  const mounted = useRef(true)
  const loading = progress >= 0 && progress < 4
  const charCount = text.replace(/\s/g, '').length

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const fillSample = () => {
    setText(SAMPLE_TRANSCRIPT)
    setTitle('信息密度：为什么你的收藏夹越来越满')
    setSourceType('podcast')
    setError('')
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const handleDistill = async () => {
    if (loading) return
    if (charCount < 20) {
      setError('再多给一点原料吧：至少需要 20 个字才能开始切片。')
      textareaRef.current?.focus()
      return
    }
    setError('')
    setProgress(0)
    for (let step = 1; step <= 4; step += 1) {
      await sleep(step === 4 ? 520 : 680)
      if (!mounted.current) return
      setProgress(step)
    }
    const draft = distillContent({ title, text, sourceType, sourceLabel: SOURCE_OPTIONS.find((item) => item.value === sourceType)?.label, sourceUrl: '' })
    onDistill(draft)
    await sleep(450)
    if (!mounted.current) return
    setProgress(-1)
    setTitle('')
    setText('')
  }

  return (
    <section className={`distill-console ${loading ? 'is-processing' : ''}`} id="distill" aria-label="脱水控制台">
      <div className="console-heading">
        <div><span className="eyebrow">INPUT CONSOLE / 01</span><h2>投喂一份长内容</h2></div>
        <span className={`ready-indicator ${charCount >= 20 ? 'is-ready' : ''}`}><i />{loading ? '运转中' : charCount >= 20 ? '已就绪' : '等待原稿'}</span>
      </div>

      <div className="console-fields">
        <label className="console-label" htmlFor="entry-title">标题 <span>TITLE</span></label>
        <input id="entry-title" className="line-input" value={title} disabled={loading} onChange={(event) => setTitle(event.target.value)} placeholder="给这张切片起个名字（可留空）" maxLength={60} />

        <span className="console-label">来源 <span>SOURCE</span></span>
        <div className="source-selector" role="group" aria-label="选择来源类型">
          {SOURCE_OPTIONS.map((source) => (
            <button key={source.value} type="button" disabled={loading} className={`source-choice source-choice--${source.value} ${sourceType === source.value ? 'is-active' : ''}`} onClick={() => setSourceType(source.value)} aria-pressed={sourceType === source.value}>
              <i className={`geo geo--${source.shape}`} /><source.Icon size={15} /><span>{source.label}</span>
            </button>
          ))}
        </div>

        <div className="transcript-label"><label className="console-label" htmlFor="entry-text">逐字稿 <span>TRANSCRIPT</span></label><span>{charCount.toLocaleString('zh-CN')} 字</span></div>
        <textarea id="entry-text" ref={textareaRef} value={text} disabled={loading} onChange={(event) => { setText(event.target.value); setError('') }} placeholder="把播客逐字稿、B站字幕或深度长文粘贴到这里。&#10;&#10;我们会替你找到真正值得留下的部分……" />
      </div>

      {(loading || progress === 4) && (
        <div className="process-monitor" aria-live="polite">
          <div className="process-track"><span style={{ width: `${(progress / 4) * 100}%` }} /></div>
          <div className="process-steps">
            {STEPS.map((step, index) => {
              const done = index < progress
              const active = index === progress
              return <div key={step} className={`${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`}><span>{done ? <Check size={14} /> : active ? <Loader2 size={14} className="spin" /> : String(index + 1).padStart(2, '0')}</span><small>{step}</small></div>
            })}
          </div>
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="console-footer">
        <button type="button" className="sample-button" onClick={fillSample} disabled={loading}><FileInput size={16} />填入示例播客文稿</button>
        <button type="button" className="primary-action" onClick={handleDistill} disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
          <span>{loading ? '正在切片…' : progress === 4 ? '归档完成' : '开始脱水归档'}</span>
          {!loading && <ArrowRight size={18} />}
        </button>
      </div>
    </section>
  )
}
