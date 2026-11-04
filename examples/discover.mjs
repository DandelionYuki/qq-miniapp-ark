/**
 * 发现示例：把本机 QQ 缓存里的小程序全部列出来，然后挖出某个 App 的页面路由和分享路径。
 *
 *   node examples/discover.mjs
 *   node examples/discover.mjs 1109937557
 *   node examples/discover.mjs 1109937557 video
 */

import { listCachedMiniapps, routesOf, sharePathHints, report } from '../src/index.mjs'

const appId = process.argv[2]
const keyword = process.argv[3]

if (!appId) {
  console.log(report())
  console.log('\n用法：node examples/discover.mjs <appId> [keyword]')
  process.exit(0)
}

const apps = listCachedMiniapps()
const hit = apps.find((a) => a.appId === appId)
if (!hit) {
  console.error(`缓存里没有 ${appId}。当前有的是：`)
  for (const a of apps) console.error(`  ${a.appId}  ${a.name}`)
  process.exit(1)
}

console.log(`【${hit.name}】${hit.appId}  v${hit.version}  包签名 ${hit.signature}`)
console.log(`目录：${hit.dir}`)

const routes = routesOf(appId)
console.log(`\n=== 页面路由（${routes.length} 个）===`)
for (const r of routes) console.log('  ' + r)

const hints = sharePathHints(appId, keyword ? { keyword } : {})
console.log(`\n=== 分享路径${keyword ? `（含 "${keyword}"）` : ''}（${hints.length} 条）===`)
for (const h of hints) console.log('  ' + h)

if (hints.some((h) => h.includes('?'))) {
  console.log('\n带 ? 的那个形状就是要填进 jumpUrl 的东西，把参数值接上去即可。')
}
