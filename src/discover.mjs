/**
 * 小程序页面路径发现工具 —— 本仓库最有用的部分。
 *
 * ## 为什么需要它
 *
 * 卡片的 `jumpUrl` 要填**页面路径**，而那个路径没有任何公开文档。
 * 但它就在你电脑上：QQ 把跑过的小程序全缓存下来了，里面有完整的路由表。
 *
 * 找到之后，`jumpUrl` 填 `/pages/xxx/xxx?参数=值` 就能让卡片点开直达那一页。
 *
 * ## 缓存目录（Windows）
 *
 * ```
 * %APPDATA%\QQEX\miniapp\temps\miniapp_src\<appid>_<版本>_<哈希>\
 *   ├── app-config.json    ← 路由表（所有 pages 的路径）
 *   ├── app-service.js     ← 业务代码（分享 path 怎么拼的就在这）
 *   ├── app-wxss.js
 *   └── pages/
 * ```
 *
 * macOS / Linux 的路径见 `candidateDirs()`。
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, platform } from 'node:os'

/** 可能存放小程序缓存的目录。 */
export function candidateDirs() {
  const home = homedir()
  const p = platform()
  const out = []
  if (p === 'win32') {
    const roaming = process.env.APPDATA || join(home, 'AppData', 'Roaming')
    out.push(join(roaming, 'QQEX', 'miniapp', 'temps', 'miniapp_src'))
    out.push(join(roaming, 'Tencent', 'QQ', 'miniapp', 'temps', 'miniapp_src'))
  } else if (p === 'darwin') {
    out.push(join(home, 'Library', 'Containers', 'com.tencent.qq', 'Data', 'Library', 'Application Support', 'QQ', 'miniapp', 'temps', 'miniapp_src'))
  } else {
    out.push(join(home, '.config', 'QQ', 'miniapp', 'temps', 'miniapp_src'))
  }
  return out
}

/**
 * 列出本机缓存过的所有小程序。
 * @returns {Array<{appId:string, dir:string, version:string}>}
 */
export function listCachedMiniapps(dirs = candidateDirs()) {
  const found = []
  for (const d of dirs) {
    if (!existsSync(d)) continue
    for (const name of readdirSync(d)) {
      const full = join(d, name)
      if (!existsSync(join(full, 'app-config.json'))) continue
      const m = name.match(/^(\d+)_([^_]+)_/)
      found.push({ appId: m ? m[1] : name, version: m ? m[2] : '', dir: full, name })
    }
  }
  return found
}

/**
 * 读出某个小程序的页面路由表。
 *
 * `app-config.json` 的 `pages` 数组就是全部页面路径，`subpackages` 里还有分包页面。
 *
 * @param {string} appId 例如 B 站 `1109937557`
 * @returns {string[]} 页面路径数组，如 `['pages/index/index', 'pages/video/video', ...]`
 */
export function routesOf(appId, dirs = candidateDirs()) {
  const hit = listCachedMiniapps(dirs).find((x) => x.appId === String(appId))
  if (!hit) return []
  let conf
  try {
    conf = JSON.parse(readFileSync(join(hit.dir, 'app-config.json'), 'utf8'))
  } catch {
    return []
  }
  const pages = Array.isArray(conf.pages) ? [...conf.pages] : []
  for (const sub of conf.subpackages || conf.subPackages || []) {
    const root = String(sub.root || '').replace(/^\/+|\/+$/g, '')
    for (const p of sub.pages || []) {
      // 有的小程序 pages 里给的是相对 root 的路径，有的已经是完整路径 —— 两种都要对
      const rel = String(p).replace(/^\/+/, '')
      const full = root && !rel.startsWith(root + '/') ? `${root}/${rel}` : rel
      pages.push(full.replace(/\/+/g, '/'))
    }
  }
  return pages
}

/**
 * 在业务代码里找「分享路径是怎么拼的」。
 *
 * 小程序里 `onShareAppMessage` 会返回 `{ title, path, imageUrl }`，
 * 那个 `path` 拼出来的形状就是你要的 jumpUrl。
 *
 * 这个函数只是把 `app-service.js` 里含 `path` 的片段捞出来，**需要人眼读**——
 * 代码是压缩过的，正则不可能替你看懂。
 *
 * @param {string} appId
 * @param {object} [opts]
 * @param {number} [opts.limit]  最多返回多少条片段
 * @returns {string[]}
 */
export function sharePathHints(appId, opts = {}, dirs = candidateDirs()) {
  const hit = listCachedMiniapps(dirs).find((x) => x.appId === String(appId))
  if (!hit) return []
  let src
  try {
    src = readFileSync(join(hit.dir, 'app-service.js'), 'utf8')
  } catch {
    return []
  }
  // 只在「出现 pages/ 或 ?xxx= 拼接」的附近取窗口，避免把整个压缩包刷屏
  const re = /["'`][^"'`]{0,40}pages\/[^"'`]{0,80}[?][^"'`]{0,60}["'`]/g
  const hits = new Set()
  let m
  while ((m = re.exec(src)) && hits.size < (opts.limit ?? 20)) {
    hits.add(m[0])
  }
  return [...hits]
}

/** 打印一份人看的报告。 */
export function report(appId, dirs = candidateDirs()) {
  const apps = listCachedMiniapps(dirs)
  const lines = []
  lines.push(`缓存目录：${dirs.filter(existsSync).join('\n          ') || '(一个都没找到)'}`)
  lines.push(`缓存里的小程序：${apps.length} 个`)
  for (const a of apps) lines.push(`  ${a.appId}  v${a.version}  ${a.dir}`)
  if (appId) {
    const routes = routesOf(appId, dirs)
    lines.push('')
    lines.push(`【${appId} 的页面路由】${routes.length} 个`)
    for (const r of routes) lines.push(`  ${r}`)
    const hints = sharePathHints(appId, {}, dirs)
    if (hints.length) {
      lines.push('')
      lines.push('【分享路径片段（人眼读）】')
      for (const h of hints) lines.push(`  ${h}`)
    }
  }
  return lines.join('\n')
}
