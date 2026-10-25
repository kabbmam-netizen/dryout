import { FileText, Headphones, Video } from 'lucide-react'

export const SOURCE_TYPES = {
  podcast: { value: 'podcast', label: '播客', short: 'PODCAST', Icon: Headphones, shape: 'circle' },
  bilibili: { value: 'bilibili', label: '视频', short: 'VIDEO', Icon: Video, shape: 'square' },
  article: { value: 'article', label: '深度长文', short: 'ARTICLE', Icon: FileText, shape: 'half' },
}

export const SOURCE_OPTIONS = Object.values(SOURCE_TYPES)

export const APP_THEMES = [
  { value: 'primary', label: '原色构成', short: '原色' },
  { value: 'blueprint', label: '蓝图纸版', short: '蓝图' },
  { value: 'night', label: '夜间展厅', short: '夜间' },
]

export const POSTER_THEMES = [
  { value: 'primary', label: '原色印刷' },
  { value: 'ink', label: '墨色展厅' },
  { value: 'blue', label: '蓝晒样张' },
]

export const SAMPLE_TRANSCRIPT = `这期节目，我们想聊一个有点反直觉的话题：为什么你收藏了那么多长视频，却一部都没有看完。
先讲一个我自己的观察。过去两年，我的收藏夹从 40 个视频涨到了 600 多个，但我真正看完的，不到十分之一。不是因为我变懒了，而是因为内容的生产速度，已经远远超过了我们消化的速度。
我们总以为是观众没有耐心，其实是内容没有给出让人留下来的理由。一条视频真正稀缺的东西，从来不是信息量，而是判断力——它有没有帮你把混乱的经验，整理成一个可以带走的结论。
所以我后来越来越相信一句话：信息密度不是把话说满，而是每一分钟都值得被留下。你把三个小时里最有价值的那五分钟找出来，比再录三个小时更有意义。
还有一个变化是，我开始用脱水的方式对待所有长内容。听完一期播客，我不再写大段的笔记，而是只留下三句话：它反驳了我什么，它让我想做什么，以及我不同意它的地方。这三句话，才是这期节目真正进入我身体的部分。
最后留一个小建议：下次你打开一个两小时的视频之前，先问自己一句——我想从里面带走什么。如果答不上来，那可能不是内容的问题，是你还没有准备好。`

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
