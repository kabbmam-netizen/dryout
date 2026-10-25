import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, FileInput, FileText, Link2, Loader2, Music, Sparkles, Upload, Video, X } from 'lucide-react'
import { SAMPLES, SOURCE_OPTIONS, sleep } from '../lib/constants'
import { distillContent } from '../lib/distill'
import { getSourcePlatform, importSourceFile, normalizeSourceUrl } from '../lib/sourceImport'

const STEPS = ['接收原稿', '压缩 noise', '拣选金句', '切片归档']

function AttachmentIcon({ kind }) {
  if (kind === 'video') return <Video size={14} />
  if (kind === 'audio') return <Music size={14} />
  return <FileText size={14} />
}

export default function DistillPanel({ onDistill, canWrite, onRequireAuth }) {
  const [title, setTitle] = useState('')
  const [sourceType, setSourceType] = useState('podcast')
  const [text, setText] = useState('')
  const [linkInput, setLinkInput] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [attachments, setAttachments] = useState([])
  const [readingFile, setReadingFile] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(-1)
  const [error, setError] = useState('')
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const mounted = useRef(true)
  const loading = progress >= 0 && progress < 4
  const charCount = text.replace(/\s/g, '').length
  const linkPlatform = sourceUrl ? getSourcePlatform(sourceUrl) : null
  const needsTranscript = charCount < 20 && (sourceUrl || attachments.length > 0)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const fillSample = (sample) => {
    if (loading || readingFile) return
    setText(sample.text)
    setTitle(sample.title)
    setSourceType(sample.sourceType)
    setError('')
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const addSourceLink = () => {
    if (!linkInput.trim()) return
    try {
      const normalized = normalizeSourceUrl(linkInput)
      const source = getSourcePlatform(normalized)
      setSourceUrl(normalized)
      setSourceType(source.type)
      setLinkInput('')
      setError('')
    } catch (err) { setError(err.message) }
  }

  const handleFile = async (file) => {
    if (!file || loading || readingFile) return
    setReadingFile(true)
    setError('')
    try {
      const imported = await importSourceFile(file)
      if (!mounted.current) return
      const attachment = { ...imported, id: `source-${Date.now()}` }
      setAttachments((previous) => [...previous, attachment])
      if (imported.sourceType) setSourceType(imported.sourceType)
      if (imported.kind === 'subtitle') {
        setText(imported.text)
        requestAnimationFrame(() => textareaRef.current?.focus())
      }
    } catch (err) { if (mounted.current) setError(err.message || '文件读取失败，请换一份文件重试。') }
    finally { if (mounted.current) setReadingFile(false) }
  }

  const removeAttachment = (attachment) => {
    setAttachments((previous) => previous.filter((item) => item.id !== attachment.id))
    if (attachment.kind === 'subtitle' && text === attachment.text) setText('')
  }

  const handleDistill = async () => {
    if (loading || readingFile || charCount < 20) return
    if (!canWrite) { onRequireAuth('distill'); return }
    let finalSourceUrl = sourceUrl
    try { if (linkInput.trim()) finalSourceUrl = normalizeSourceUrl(linkInput) }
    catch (err) { setError(err.message); return }

    setError('')
    setProgress(0)
    for (let step = 1; step <= 4; step += 1) {
      await sleep(step === 4 ? 520 : 680)
      if (!mounted.current) return
      setProgress(step)
    }
    const platform = finalSourceUrl ? getSourcePlatform(finalSourceUrl) : null
    const firstMedia = attachments.find((item) => item.kind === 'video' || item.kind === 'audio')
    const draft = distillContent({
      title,
      text,
      sourceType,
      sourceLabel: SOURCE_OPTIONS.find((item) => item.value === sourceType)?.label,
      sourceUrl: finalSourceUrl || '',
      sourcePlatform: platform?.platform || firstMedia?.name || '',
      sourceAssets: attachments.map(({ kind, name, size, duration, cueCount }) => ({ kind, name, size, duration, cueCount })),
    })
    const saved = await onDistill(draft)
    await sleep(450)
    if (!mounted.current) return
    setProgress(-1)
    if (saved === false) return
    setTitle('')
    setText('')
    setSourceUrl('')
    setLinkInput('')
    setAttachments([])
  }

  const statusText = loading ? '运转中' : readingFile ? '读取素材' : charCount >= 20 ? '已就绪' : needsTranscript ? '等待文稿' : '等待原稿'

  return (
    <section className={`distill-console ${loading ? 'is-processing' : ''}`} id="distill" aria-label="脱水控制台">
      <div className="console-heading">
        <div><span className="eyebrow">INPUT CONSOLE / 01</span><h2>投喂一份长内容</h2></div>
        <span className={`ready-indicator ${charCount >= 20 ? 'is-ready' : ''}`}><i />{statusText}</span>
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

        <div className="console-label">原始出处 <span>OPTIONAL / 可选</span></div>
        <div className="origin-actions">
          <div className="origin-link-field">
            <Link2 size={15} aria-hidden="true" />
            <input aria-label="来源链接" value={linkInput} disabled={loading} onChange={(event) => { setLinkInput(event.target.value); setError('') }} onBlur={() => { if (linkInput.trim()) addSourceLink() }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSourceLink() } }} placeholder={sourceUrl ? '粘贴新链接以更换出处' : '粘贴视频 / 播客链接'} type="url" />
            <button type="button" disabled={loading || !linkInput.trim()} onClick={addSourceLink}>添加</button>
          </div>
          <button type="button" className={`upload-source-button ${dragging ? 'is-dragging' : ''}`} disabled={loading || readingFile}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => { event.preventDefault(); if (!loading && !readingFile) setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files[0]) }}>
            {readingFile ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
            <span>{readingFile ? '正在读取' : '上传音视频 / 字幕'}</span>
          </button>
          <input ref={fileInputRef} className="source-file-input" type="file" disabled={loading || readingFile} accept=".srt,.vtt,.txt,video/*,audio/*" onChange={(event) => { handleFile(event.target.files[0]); event.target.value = '' }} />
        </div>
        <p className="origin-hint">链接仅保留出处 · SRT / VTT / TXT 自动填入 · 音视频不自动转写</p>

        {(sourceUrl || attachments.length > 0) && (
          <div className="source-attachments" aria-label="已添加的原始出处">
            {sourceUrl && (
              <div className="source-attachment source-attachment--link">
                <Link2 size={14} /><span><b>{linkPlatform?.platform}</b><small>{linkPlatform?.hostname}</small></span>
                <button type="button" disabled={loading} onClick={() => setSourceUrl('')} aria-label="移除来源链接"><X size={13} /></button>
              </div>
            )}
            {attachments.map((attachment) => (
              <div className="source-attachment" key={attachment.id}>
                <AttachmentIcon kind={attachment.kind} />
                <span><b>{attachment.name}</b><small>{attachment.kind === 'subtitle' ? `已导入 ${attachment.cueCount} 条字幕` : `${attachment.duration} · ${attachment.size} · 仅本地读取`}</small></span>
                <button type="button" disabled={loading} onClick={() => removeAttachment(attachment)} aria-label={`移除附件 ${attachment.name}`}><X size={13} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="transcript-label"><label className="console-label" htmlFor="entry-text">逐字稿 <span>TRANSCRIPT</span></label><span>{charCount.toLocaleString('zh-CN')} 字</span></div>
        <textarea id="entry-text" ref={textareaRef} value={text} disabled={loading} onChange={(event) => { setText(event.target.value); setError('') }} placeholder="把播客逐字稿、视频字幕或深度长文粘贴到这里。&#10;&#10;我们会替你找到真正值得留下的部分……" />
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

      {needsTranscript && !loading && <p className="origin-guidance">已收到原始出处，还需要至少 20 字的逐字稿或字幕才能脱水。</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="console-footer">
        <div className="sample-actions" role="group" aria-label="填入测试样本">
          {SAMPLES.map((sample) => (
            <button key={sample.id} type="button" className="sample-button" onClick={() => fillSample(sample)} disabled={loading || readingFile}>
              <FileInput size={15} />{sample.label}
            </button>
          ))}
        </div>
        <button type="button" className="primary-action" onClick={handleDistill} disabled={loading || readingFile || charCount < 20}>
          {loading || readingFile ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
          <span>{loading ? '正在切片…' : readingFile ? '正在读取素材…' : progress === 4 ? '归档完成' : '开始脱水归档'}</span>
          {!loading && !readingFile && <ArrowRight size={18} />}
        </button>
      </div>
    </section>
  )
}
