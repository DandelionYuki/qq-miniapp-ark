/**
 * qq-miniapp-ark
 *
 * 让第三方 QQ 机器人发出「点开直达具体页面」的小程序卡片。
 *
 * 三句话版本：
 *   1. 别自己搓 ark —— 没签名，QQ 会说「发送者版本过低」；
 *   2. 问 NapCat 要 `get_mini_app_ark`，走**自定义 schema** 那一支；
 *   3. `jumpUrl` 填**小程序页面路径**（`/pages/video/video?bvid=BVxxx`），不是网址。
 *
 * 路径从哪来：你电脑上的 QQ 小程序缓存里有完整路由表，`discover.mjs` 能读。
 */

export { createClient } from './onebot.mjs'
export { miniappCard, inspectCard } from './ark.mjs'
export {
  BILI_APP_ID,
  BILI_VERSION_ID,
  BILI_ICON,
  videoPath,
  bilibiliCard,
  findBvid,
} from './bilibili.mjs'
export {
  candidateDirs,
  listCachedMiniapps,
  routesOf,
  sharePathHints,
  report,
} from './discover.mjs'
