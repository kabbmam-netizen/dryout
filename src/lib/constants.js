import { FileText, Headphones, Video } from 'lucide-react'

// 类型描述的是「内容形态」而不是平台：B 站和 YouTube 都是 video，用 platform 区分
export const SOURCE_TYPES = {
  podcast: { value: 'podcast', label: '播客', short: 'PODCAST', Icon: Headphones, shape: 'circle' },
  video: { value: 'video', label: '视频', short: 'VIDEO', Icon: Video, shape: 'square' },
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

const SAMPLE_VIDEO_TRANSCRIPT = `[00:12] 大家好，这期我们拆一个被说烂了、但很少有人真正做到的东西：视频的节奏。
[00:48] 很多人以为节奏就是剪得快。其实不是。真正决定观众留不留下来的是信息之间的呼吸感。
[01:35] 我剪片子的时候会问自己一句：这一刀剪掉之后，观众会不会更清楚？如果不会，那这一刀就只是装饰，不是节奏。
[02:20] 关键不在于你放了多少素材，而在于每一段素材有没有承担推进的作用。没有推进的镜头，再漂亮也是噪音。
[03:06] 所以我们后来定了一条规矩：任何一段超过三秒的空镜，都必须回答一个问题——它在替观众想什么。
[04:11] 最后给一个反直觉的结论：留白不是浪费时间，留白是让观众有机会把你的内容，变成他自己的判断。`

const SAMPLE_ARTICLE_TRANSCRIPT = `我们这一代人最大的阅读幻觉，是把“读过了”当成了“读懂了”。
真正的问题从来不是阅读速度，而是我们没给理解留下时间。一篇三千字的文章，如果三分钟扫完，你得到的不是观点，只是一份模糊的印象。
慢读不是逐字朗读，而是允许自己在某一段停下来，问一句：这句话在反驳什么。关键的地方往往不在作者说了什么，而在他刻意没有说的地方。
我后来越来越相信，阅读的价值不是积累信息，而是修正判断。读完之后如果什么想法都没有改变，那这篇文章对你来说只是一次消遣。
所以与其一年读一百本，不如认真读十本，并且每本都写下一段不同意作者的地方。因为只有当你开始反驳，你才真正进入了这场对话。`

export const SAMPLES = [
  {
    id: 'sample-podcast',
    label: '样本 1 · 播客',
    short: '播客',
    sourceType: 'podcast',
    title: '信息密度：为什么你的收藏夹越来越满',
    text: SAMPLE_TRANSCRIPT,
  },
  {
    id: 'sample-video',
    label: '样本 2 · 视频',
    short: '视频',
    sourceType: 'video',
    title: '节奏不是快慢，是让人愿意留下来',
    text: SAMPLE_VIDEO_TRANSCRIPT,
  },
  {
    id: 'sample-article',
    label: '样本 3 · 长文',
    short: '长文',
    sourceType: 'article',
    title: '慢读的意义：为什么读得快反而忘得快',
    text: SAMPLE_ARTICLE_TRANSCRIPT,
  },
]

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
