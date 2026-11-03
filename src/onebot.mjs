/**
 * 极简 OneBot 11 客户端（WebSocket 正向连接）。
 *
 * 只做两件事：调 action、收 echo。不处理事件分发 —— 你大概率已经有自己的框架了，
 * 这个文件存在的意义是：复制走就能用，零依赖。
 *
 * Node >= 22（内置 WebSocket）。
 */

export function createClient({ wsUrl, token, timeoutMs = 15000 } = {}) {
  if (!wsUrl) throw new Error('createClient: 需要 wsUrl')
  const url = new URL(wsUrl)
  if (token) url.searchParams.set('access_token', token)

  let seq = 0
  const waiting = new Map()
  let ws = null
  let opening = null

  const open = () => {
    if (ws && ws.readyState === 1) return Promise.resolve(ws)
    if (opening) return opening
    opening = new Promise((resolve, reject) => {
      const sock = new WebSocket(url.toString())
      const fail = (err) => {
        opening = null
        reject(err)
      }
      sock.addEventListener('open', () => {
        ws = sock
        opening = null
        resolve(sock)
      })
      sock.addEventListener('error', () => fail(new Error('WebSocket 连接失败')))
      sock.addEventListener('message', (ev) => {
        let d
        try {
          d = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString())
        } catch {
          return
        }
        if (d.echo != null && waiting.has(d.echo)) {
          const done = waiting.get(d.echo)
          waiting.delete(d.echo)
          done(d)
        }
      })
      sock.addEventListener('close', () => {
        if (ws === sock) ws = null
      })
    })
    return opening
  }

  /**
   * 调一个 OneBot action。
   * @returns {Promise<any>} 原始响应（含 status / retcode / data）
   */
  async function call(action, params = {}, opts = {}) {
    const sock = await open()
    const id = ++seq
    const wait = opts.timeoutMs ?? timeoutMs
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (waiting.has(id)) {
          waiting.delete(id)
          reject(new Error(`${action} 超时（${wait}ms）`))
        }
      }, wait)
      waiting.set(id, (d) => {
        clearTimeout(timer)
        resolve(d)
      })
      sock.send(JSON.stringify({ action, params, echo: id }))
    })
  }

  /** 发消息：`kind` 是 `private` 或 `group`，`target` 是 QQ 号或群号。 */
  async function send(kind, target, message) {
    const action = kind === 'group' ? 'send_group_msg' : 'send_private_msg'
    const key = kind === 'group' ? 'group_id' : 'user_id'
    return call(action, { [key]: target, message })
  }

  function close() {
    if (ws) {
      ws.close()
      ws = null
    }
  }

  return { call, send, close, get socket() { return ws } }
}
