import { SOURCE_TYPES } from './constants'

const PALETTES = {
  primary: { bg: '#F4EBD8', ink: '#151515', red: '#EF4B37', blue: '#2454D7', yellow: '#F4C842', footer: '#151515', footerInk: '#F4EBD8' },
  ink: { bg: '#171714', ink: '#F5EFDF', red: '#FF6650', blue: '#6D8FFF', yellow: '#F4C842', footer: '#F4C842', footerInk: '#171714' },
  blue: { bg: '#164C63', ink: '#F7F0DE', red: '#EF684C', blue: '#8DB9C5', yellow: '#F0B84C', footer: '#F7F0DE', footerInk: '#164C63' },
}

function wrapText(ctx, text, maxWidth) {
  const lines = []
  let line = ''
  for (const char of text) {
    const test = line + char
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = char }
    else line = test
  }
  if (line) lines.push(line)
  return lines
}

export async function downloadQuotePoster(card, theme) {
  const p = PALETTES[theme] || PALETTES.primary
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1440
  const ctx = canvas.getContext('2d')
  const source = SOURCE_TYPES[card.sourceType] || SOURCE_TYPES.article
  const date = new Date(card.createdAt)
  const dateText = Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`

  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, 1080, 1440)
  ctx.fillStyle = p.red
  ctx.beginPath(); ctx.arc(965, 190, 220, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = p.blue
  ctx.fillRect(0, 930, 170, 170)
  ctx.fillStyle = p.yellow
  ctx.beginPath(); ctx.arc(890, 1030, 165, Math.PI, 0); ctx.fill()
  ctx.strokeStyle = p.ink
  ctx.lineWidth = 7
  ctx.strokeRect(34, 34, 1012, 1372)

  ctx.fillStyle = p.ink
  ctx.font = '900 48px Arial, sans-serif'
  ctx.fillText('DRYOUT®', 82, 120)
  ctx.font = '24px Consolas, monospace'
  ctx.textAlign = 'right'; ctx.fillText(dateText, 990, 115); ctx.textAlign = 'left'
  ctx.fillRect(82, 158, 915, 4)
  ctx.font = '25px Consolas, monospace'
  ctx.fillText(`${source.short} / THOUGHT ARCHIVE`, 82, 220)

  const quoteSize = card.golden_quote.length > 42 ? 66 : 76
  ctx.font = `900 ${quoteSize}px "Microsoft YaHei", "PingFang SC", sans-serif`
  const lines = wrapText(ctx, `“${card.golden_quote}”`, 845)
  const lineHeight = quoteSize * 1.48
  const startY = Math.max(350, 630 - ((lines.length - 1) * lineHeight) / 2)
  lines.slice(0, 7).forEach((line, index) => ctx.fillText(line, 82, startY + index * lineHeight))

  ctx.fillStyle = p.footer
  ctx.fillRect(35, 1160, 1010, 245)
  ctx.fillStyle = p.footerInk
  ctx.font = '22px Consolas, monospace'
  ctx.fillText(`${source.short} — ${card.sourceName}`.slice(0, 55), 82, 1220)
  ctx.font = '700 34px "Microsoft YaHei", sans-serif'
  const titleLines = wrapText(ctx, card.title, 760)
  ctx.fillText(titleLines[0] || '', 82, 1285)
  ctx.font = '22px Consolas, monospace'
  ctx.fillText(card.tags.slice(0, 2).map((tag) => `#${tag}`).join('  '), 82, 1350)
  ctx.textAlign = 'right'; ctx.fillText(`DRY / ${card.id.slice(-3).toUpperCase()}`, 990, 1350)

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1))
  if (!blob) throw new Error('PNG export failed')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `DRYOUT-${card.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 24)}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}
