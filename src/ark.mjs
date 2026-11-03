/**
 * `get_mini_app_ark` 的封装 —— 生成一张**带签名、能点开直达页面**的小程序卡片。
 *
 * ## 为什么不能自己搓卡片
 *
 * OneBot 的 `json` 段可以直接塞任意 ark 明文：
 *
 * ```js
 * { type: 'json', data: { data: JSON.stringify({ app: 'com.tencent.miniapp_01', ... }) } }
 * ```
 *
 * 这么发出去，QQ 会显示「**发送者版本过低，无法显示内容**」。
 * 不是字段写错了，是缺 `config.token` —— 那个 token 由腾讯服务端签发，
 * 本地算不出来（试过 19 种 MD5 组合，全不中），并且**给内容签名**：
 * 改任何一个字段再发，会直接 `retcode: 1200`（发送超时，服务端静默拒绝）。
 *
 * 所以必须走 NapCat 的 `get_mini_app_ark`：它内部会调 `AdaptShareInfo`
 * 让服务端把 ark 签好返回。
 *
 * ## 为什么默认走「自定义 schema」那一支
 *
 * `get_mini_app_ark` 的入参是个 union，两支：
 *
 * | 支 | 触发条件 | 特点 |
 * |---|---|---|
 * | 模板支 | 传 `type: 'bili'` / `'weibo'` | NapCat 用内置模板填字段，**`jumpUrl` 会被当成网页地址**，点开只到小程序首页 |
 * | 自定义支 | 不传 `type`，自己给全字段 | `jumpUrl` 原样进签名请求，可以传**页面路径** |
 *
 * 想做「点开直达某个页面」，必须走自定义支。
 *
 * `withShareTicket` 是必填字符串，漏了会报
 * `retcode=1400 Schema compilation error: Expected union value`。
 */

/** 卡片的默认字段值。跟真实分享卡对齐，一般不用改。 */
const DEFAULTS = Object.freeze({
  scene: '1036',
  templateType: '1',
  businessType: '0',
  verType: '3',
  shareType: '0',
  withShareTicket: '0',
  sdkId: 'V1_PC_MINISDK_99.99.99_1_APP_A',
})

/**
 * 生成一张小程序卡片段。
 *
 * @param {object} client  `createClient()` 的返回，或其他带 `call(action, params, opts)` 的对象
 * @param {object} card
 * @param {string} card.appId      小程序 appid，例如 B 站是 `1109937557`
 * @param {string} card.versionId  小程序版本标识（真卡里的 `versionId`，见 docs/miniapp-routes.md）
 * @param {string} card.title      卡片标题
 * @param {string} [card.desc]     卡片描述
 * @param {string} [card.picUrl]   封面图 URL（建议 16:9）
 * @param {string} [card.iconUrl]  小程序图标 URL
 * @param {string} card.jumpUrl    ★ **小程序页面路径**，例如 `/pages/video/video?bvid=BV1xx`
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<object|null>} OneBot 消息段；拿不到签名返回 `null`（调用方应当退回纯文本）
 */
export async function miniappCard(client, card = {}, opts = {}) {
  if (!client || typeof client.call !== 'function') {
    throw new Error('miniappCard: 第一个参数需要一个带 call() 的客户端')
  }
  const { appId, versionId, title, desc = '', picUrl = '', iconUrl = '', jumpUrl } = card
  if (!appId) throw new Error('miniappCard: 缺少 appId')
  if (!versionId) throw new Error('miniappCard: 缺少 versionId')
  if (!jumpUrl) throw new Error('miniappCard: 缺少 jumpUrl')

  const params = {
    title: String(title || '').slice(0, 60),
    desc: String(desc || '').slice(0, 80),
    picUrl: String(picUrl || ''),
    jumpUrl: String(jumpUrl),
    iconUrl: String(iconUrl || ''),
    appId: String(appId),
    versionId: String(versionId),
    ...DEFAULTS,
  }

  let raw
  try {
    raw = await client.call('get_mini_app_ark', params, { timeoutMs: opts.timeoutMs ?? 8000 })
  } catch {
    return null
  }

  // NapCat 不同版本把 ark 放在不同层级，三种都兜一下
  const inner = raw?.data?.data ?? raw?.data ?? raw
  if (!inner || typeof inner !== 'object') return null
  // 没有 token 就是没签上名，发出去照样「版本过低」，别白费一次发送
  if (!inner.config?.token) return null

  return { type: 'json', data: { data: JSON.stringify(inner) } }
}

/**
 * 从一张签名卡里取出关键信息，方便调试。
 * @returns {{app:string, view:string, token:string, title:string, desc:string, jumpUrl:string, qqdocurl:string}}
 */
export function inspectCard(segment) {
  const payload = JSON.parse(segment?.data?.data || '{}')
  const detail =
    payload?.meta?.detail_1 || payload?.meta?.news || Object.values(payload?.meta || {})[0] || {}
  return {
    app: payload.app || '',
    view: payload.view || '',
    token: payload.config?.token || '',
    title: detail.title || '',
    desc: detail.desc || '',
    jumpUrl: detail.jumpUrl || detail.url || '',
    qqdocurl: detail.qqdocurl || '',
  }
}
