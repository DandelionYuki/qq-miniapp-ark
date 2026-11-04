/**
 * qq-miniapp-ark
 *
 * 让第三方 QQ 机器人发出的小程序卡片**点开直达某一页**，而不是落首页。
 *
 * ## 这个仓库到底解决什么
 *
 * NapCat 已经内置了发卡的 API（`get_mini_app_ark`），所以「怎么发」不是问题。
 *
 * **问题是 `jumpUrl` 该填什么。** 它要的不是网址，是**小程序页面路径**，
 * 形如 `/pages/video/video?bvid=BV1xx411c7mD`。这个东西**没有任何公开文档**，
 * 填错了服务端也不报错 —— 卡片长得一模一样，点开落首页。
 *
 * 而这条路径一直就在你电脑上：QQ 把跑过的小程序缓存下来了，
 * 里面有路由表、有业务代码、还有这个 App **自己拼分享链接的写法**。
 *
 * 所以本仓库的主体是 `discover` —— **从本机缓存里把路径挖出来**。
 * 发卡只是把挖到的东西填对位置。
 *
 * ```js
 * import { listCachedMiniapps, routesOf, sharePathHints, verifyPath } from 'qq-miniapp-ark'
 *
 * listCachedMiniapps()        // 本机缓存过哪些小程序
 * routesOf('1109937557')      // 它的全部页面路由
 * sharePathHints('1109937557')// 它自己怎么拼分享路径（这就是答案）
 * verifyPath('1109937557', '/pages/video/video?bvid=BVxxx')  // 这条路径还活着吗
 * ```
 *
 * ## 已知能用的配方
 *
 * B 站（`docs/cookbook.md` 里有完整可复现过程）：
 *
 * ```js
 * import { createClient, bilibiliCard, findBvid } from 'qq-miniapp-ark'
 * const client = await createClient({ wsUrl: 'ws://127.0.0.1:3001' })
 * const seg = await bilibiliCard(client, { bvid: 'BV1RExs64ELB', title: '...', verify: true })
 * await client.send('private', 123456789, [seg])
 * ```
 */

export { createClient } from './onebot.mjs'
export { miniappCard, inspectCard } from './ark.mjs'
export {
  BILI_APP_ID,
  BILI_VERSION_ID,
  BILI_ICON,
  videoPath,
  bangumiPath,
  searchPath,
  verifyBilibiliPath,
  bilibiliCard,
  findBvid,
} from './bilibili.mjs'
export {
  candidateDirs,
  listCachedMiniapps,
  routesOf,
  sharePathHints,
  verifyPath,
  report,
} from './discover.mjs'
