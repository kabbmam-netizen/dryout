const SUBTITLE_EXTENSIONS = new Set(['srt', 'vtt', 'txt'])
const MAX_SUBTITLE_SIZE = 10 * 1024 * 1024
const MAX_MEDIA_SIZE = 2 * 1024 * 1024 * 1024

export function normalizeSourceUrl(value) {
  const raw = value.trim()
  if (!raw) return null
  let url
  try { url = new URL(raw) } catch { throw new Error('请输入完整的 http:// 或 https:// 来源链接。') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('来源链接仅支持 http:// 或 https://。')
  return url.toString()
}

export function getSourcePlatform(value) {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, '').toLowerCase()
    if (hostname.includes('bilibili.com') || hostname === 'b23.tv') return { type: 'video', platform: 'Bilibili', hostname }
    // YouTube 同样是视频形态，只是平台不同——类型跟着形态走，不跟着平台走
    if (hostname.includes('youtube.com') || hostname === 'youtu.be') return { type: 'video', platform: 'YouTube', hostname }
    if (hostname.includes('xiaoyuzhoufm.com')) return { type: 'podcast', platform: '小宇宙', hostname }
    if (hostname.includes('podcasts.apple.com')) return { type: 'podcast', platform: 'Apple Podcasts', hostname }
    if (hostname.includes('spotify.com')) return { type: 'podcast', platform: 'Spotify', hostname }
    if (hostname.includes('ximalaya.com')) return { type: 'podcast', platform: '喜马拉雅', hostname }
    return { type: 'article', platform: hostname, hostname }
  } catch { return { type: 'article', platform: '未知来源', hostname: '' } }
}

function decodeSubtitleText(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim()
}

export function parseSubtitle(raw) {
  const lines = raw.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n')
  const cues = []
  let previous = ''
  let timestampCount = 0
  let skippingBlock = false
  for (const original of lines) {
    const line = original.trim()
    if (/^(NOTE|STYLE|REGION)\b/i.test(line)) { skippingBlock = true; continue }
    if (skippingBlock) { if (!line) skippingBlock = false; continue }
    if (!line || /^\d+$/.test(line)) continue
    if (/^(?:WEBVTT\b|Kind:|Language:)/i.test(line)) continue
    if (/^(\d{1,2}:)?\d{2}:\d{2}[,.]\d{1,3}\s+-->/i.test(line)) { timestampCount += 1; continue }
    if (/^X-TIMESTAMP-MAP=/i.test(line)) continue
    const text = decodeSubtitleText(line.replace(/<\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}>/g, ''))
    if (text && text !== previous) cues.push(text)
    previous = text
  }
  return { text: cues.join('\n'), cueCount: timestampCount || cues.length }
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatMediaDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '时长未知'
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = String(total % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`
}

function readMediaDuration(file, kind) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const media = document.createElement(kind === 'video' ? 'video' : 'audio')
    let settled = false
    const finish = (duration = null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      media.removeAttribute('src')
      media.load()
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    const timer = setTimeout(() => finish(null), 8000)
    media.preload = 'metadata'
    media.onloadedmetadata = () => finish(Number.isFinite(media.duration) ? media.duration : null)
    media.onerror = () => finish(null)
    media.src = url
  })
}

export async function importSourceFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const isSubtitle = SUBTITLE_EXTENSIONS.has(extension)
  const isVideo = file.type.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'm4v'].includes(extension)
  const isAudio = file.type.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac'].includes(extension)

  if (isSubtitle) {
    if (file.size > MAX_SUBTITLE_SIZE) throw new Error('字幕文件不能超过 10 MB。')
    const parsed = parseSubtitle(await file.text())
    if (parsed.cueCount === 0 || parsed.text.replace(/\s/g, '').length < 20) throw new Error('没有读到足够的字幕文字，请检查文件内容。')
    return { kind: 'subtitle', name: file.name, size: formatFileSize(file.size), duration: '', text: parsed.text, cueCount: parsed.cueCount, sourceType: null }
  }

  if (!isVideo && !isAudio) throw new Error('支持 MP4、MOV、WebM、MP3、M4A、WAV 以及 SRT、VTT、TXT 文件。')
  if (file.size > MAX_MEDIA_SIZE) throw new Error('音视频文件不能超过 2 GB。')
  const kind = isVideo ? 'video' : 'audio'
  const duration = await readMediaDuration(file, kind)
  return { kind, name: file.name, size: formatFileSize(file.size), duration: formatMediaDuration(duration), text: '', cueCount: 0, sourceType: isVideo ? 'video' : 'podcast' }
}
