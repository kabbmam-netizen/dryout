import { Component } from 'react'

/**
 * 兜底渲染错误：组件树抛异常时不让整页白屏，而是给出可复制的错误信息。
 * 只捕获渲染 / 生命周期错误，不捕获事件处理器与异步错误（那些仍走 toast）。
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[DRYOUT] 渲染出错', error, info?.componentStack)
    this.setState({ info })
  }

  handleCopy = async () => {
    const { error, info } = this.state
    const text = [error?.stack || String(error), info?.componentStack || ''].join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      this.setState({ copied: true })
    } catch {
      this.setState({ copied: false })
    }
  }

  render() {
    const { error, info, copied } = this.state
    if (!error) return this.props.children

    return (
      <div className="error-fallback" role="alert">
        <div className="error-panel">
          <span className="eyebrow">RENDER FAILURE / 渲染中断</span>
          <h1>界面没能画出来</h1>
          <p>页面组件抛了异常，数据本身没有被修改。刷新可以重试；如果反复出现，把下面的信息复制给开发者。</p>
          <pre>{[error?.message || String(error), info?.componentStack || ''].join('\n').trim()}</pre>
          <div className="error-actions">
            <button type="button" onClick={() => window.location.reload()}>刷新页面</button>
            <button type="button" onClick={this.handleCopy}>{copied ? '已复制' : '复制错误信息'}</button>
          </div>
        </div>
      </div>
    )
  }
}
