/**
 * B 站预设 —— 一张能点开直达视频页的小程序卡片。
 *
 * 这是本仓库唯一一处「知道具体业务」的代码，其余都是通用机制。
 * 想接别的小程序，看 `docs/cookbook.md`。
 */

import { miniappCard } from './ark.mjs'
import { verifyPath } from './discover.mjs'

/** B 站小程序在 QQ 里的 appid。 */
export const BILI_APP_ID = '1109937557'

/**
 * 小程序模板版本标识。
 *
 * 这个值来自 NapCat 内置的 `type:'bili'` 模板，也跟真实分享卡一致。
 *
 * **好消息：服务端不校验它。** 实测传空串、乱码、全零都能拿到 token。
 * 留着只是因为「跟真实卡一致」看起来最稳。
 */
export const BILI_VERSION_ID = 'cfc5f7b05b44b5956502edaecf9d2240'

/** B 站小程序图标（取自真实分享卡）。 */
export const BILI_ICON =
  'https://miniapp.gtimg.cn/public/appicon/51f90239b78a2e4994c11215f4c4ba15_200.jpg'

/** BV 号格式。小程序路由只认这个，传 aid 走另一条路。 */
const BV_RE = /^BV[0-9A-Za-z]{10}$/

/**
 * 把 BV 号变成 B 站小程序的视频页路径。
 *
 * 这个字符串是**从小程序包里挖出来的**，不是猜的。`app-service.js` 里
 * 拼分享 path 的代码原文就是：
 *
 * ```js
 * "/pages/video/video?bvid=" + n
 * ```
 *
 * 猜 `pages/video/index` / `pages/index?id=` / `pages/index/index?bvid=` 之类
 * 全部会落回首页 —— 而且**服务端不会报错**，卡片长得一样。
 *
 * 同文件里还挖到这些（`sharePathHints('1109937557')` 可复现）：
 *
 * ```
 * /pages/video/video?bvid=           ← 普通视频（本函数）
 * /pages/video/video?aid=            ← 用 aid 的数字 id
 * /pages/video/video?avid=
 * /pages/pgcvideo/pgcvideo?epid=     ← 番剧（用 ep id）
 * /pages/pgcvideo/pgcvideo?ssid=     ← 番剧（用 season id）
 * /pages/packages/common/search/search?kw=   ← 搜索结果页
 * /pages/packages/tab2/favorite/favorite?media_id=  ← 收藏夹
 * /pages/packages/fallback/webview/webview?url=     ← 兜底网页容器
 * ```
 *
 * @param {string} bvid
 * @returns {string|null}
 */
export function videoPath(bvid) {
  const b = String(bvid || '').trim()
  if (!BV_RE.test(b)) return null
  return `/pages/video/video?bvid=${b}`
}

/** 番剧页路径（用 ep id，形如 `ep123456`）。 */
export function bangumiPath(epId) {
  const s = String(epId || '').trim()
  if (!/^ep\d+$/i.test(s)) return null
  return `/pages/pgcvideo/pgcvideo?epid=${s}`
}

/** B 站小程序里的搜索页路径。 */
export function searchPath(keyword) {
  const k = String(keyword || '').trim()
  if (!k) return null
  return `/pages/packages/common/search/search?kw=${encodeURIComponent(k)}`
}

/**
 * 校验路径在本机缓存的 B 站小程序路由表里还在不在。
 *
 * 建议**每次发卡片前调一次**。服务端不校验路径，只有这张路由表能告诉你
 * 「B 站是不是又改版了」。
 *
 * @param {string} path
 * @returns {{ok:boolean, page:string, reason?:string, suggestions?:string[]}}
 */
export function verifyBilibiliPath(path) {
  return verifyPath(BILI_APP_ID, path)
}

/**
 * 给一个 B 站视频生成卡片段。
 *
 * @param {object} client  带 `call()` 的客户端
 * @param {object} video
 * @param {string} video.bvid
 * @param {string} [video.title]   留空时卡片标题会是「哔哩哔哩」+ 描述为空，不好看，尽量给
 * @param {string} [video.desc]    UP 主名字或一句话简介
 * @param {string} [video.pic]     封面 URL（B 站封面支持 `?x-oss-process=` 后缀改尺寸）
 * @param {boolean} [video.verify] 传 true 时先校验路由表，不在就返回 null
 * @returns {Promise<object|null>}
 *
 * @example
 * const seg = await bilibiliCard(client, {
 *   bvid: 'BV1RExs64ELB',
 *   title: '炸鸡腿就挺好',
 *   desc: 'UP 主名',
 *   pic: 'https://i0.hdslb.com/bfs/archive/xxx.jpg',
 *   verify: true,
 * })
 * await client.send('private', 123456, [seg])
 */
export async function bilibiliCard(client, video = {}) {
  const jumpUrl = videoPath(video.bvid)
  if (!jumpUrl) return null
  if (video.verify) {
    const v = verifyBilibiliPath(jumpUrl)
    if (!v.ok) return null
  }
  return miniappCard(
    client,
    {
      appId: BILI_APP_ID,
      versionId: BILI_VERSION_ID,
      title: video.title || '哔哩哔哩',
      desc: video.desc || '',
      picUrl: video.pic || '',
      iconUrl: BILI_ICON,
      jumpUrl,
    },
    video.opts || {},
  )
}

/**
 * 从视频链接里抠出 BV 号。支持完整链接和 b23 短链。
 * @param {string} text
 * @returns {string|null}
 */
export function findBvid(text) {
  const s = String(text || '')
  const direct = s.match(/BV[0-9A-Za-z]{10}/)
  if (direct) return direct[0]
  const short = s.match(/b23\.tv\/([0-9A-Za-z]+)/)
  return short ? short[1] : null
}
