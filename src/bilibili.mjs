/**
 * B 站预设 —— 一张能点开直达视频页的小程序卡片。
 *
 * 这是本仓库唯一一处「知道具体业务」的代码，其余都是通用机制。
 * 想接别的小程序，看 docs/miniapp-routes.md 最后那节「怎么发现新路径」。
 */

import { miniappCard } from './ark.mjs'

/** B 站小程序在 QQ 里的 appid。 */
export const BILI_APP_ID = '1109937557'

/**
 * 小程序版本标识。
 *
 * 这个值来自 NapCat 内置的 `type:'bili'` 模板，也跟真实分享卡一致。
 * 小程序的版本号变了它可能会变 —— 卡片突然不显示时先核对这个：
 *
 * ```bash
 * grep -o "cfc5f7b05b44b5956502edaecf9d2240" <napcat>/napcat/napcat.mjs | head -1
 * ```
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
 * 这个字符串是**从小程序包里挖出来的**，不是猜的：
 * `app-service.js` 里拼分享 path 的代码是
 *
 * ```js
 * "/pages/video/video?bvid=" + n
 * ```
 *
 * 猜 `pages/video/index` / `pages/index?id=` 之类全部会落回首页。
 *
 * @param {string} bvid
 * @returns {string|null}
 */
export function videoPath(bvid) {
  const b = String(bvid || '').trim()
  if (!BV_RE.test(b)) return null
  return `/pages/video/video?bvid=${b}`
}

/**
 * 给一个 B 站视频生成卡片段。
 *
 * @param {object} client  带 `call()` 的客户端
 * @param {object} video
 * @param {string} video.bvid
 * @param {string} [video.title]   留空时卡片标题会是「哔哩哔哩」+ 描述为空，不好看，尽量给
 * @param {string} [video.desc]    UP 主名字或一句话简介
 * @param {string} [video.pic]     封面 URL（B 站封面 URL 支持 `?x-oss-process=` 后缀改尺寸）
 * @returns {Promise<object|null>}
 *
 * @example
 * const seg = await bilibiliCard(client, {
 *   bvid: 'BV1RExs64ELB',
 *   title: '炸鸡腿就挺好',
 *   desc: 'UP 主名',
 *   pic: 'https://i0.hdslb.com/bfs/archive/xxx.jpg',
 * })
 * await client.send('private', 123456, [seg])
 */
export async function bilibiliCard(client, video = {}) {
  const jumpUrl = videoPath(video.bvid)
  if (!jumpUrl) return null
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
