/**
 * 小程序页面路径发现 —— 本仓库的核心。
 *
 * ## 为什么需要它
 *
 * 卡片要让「点开直达某一页」，`jumpUrl` 就得填**小程序页面路径**，形如
 * `/pages/video/video?bvid=BV1xx411c7mD`。而这个路径**没有任何公开文档**。
 *
 * 但它一直就在你电脑上：QQ 把跑过的小程序全缓存下来了，里面有完整的路由表
 * 和业务代码。业务代码里还写着这个 App **自己是怎么拼分享链接的**。
 *
 * ## 缓存长什么样（Windows）
 *
 * ```
 * %APPDATA%\QQEX\miniapp\temps\miniapp_src\<appId>_<版本>_<包签名>\
 *   ├── app-config.json     ← 路由表：pages 数组
 *   ├── app-service.js      ← 业务代码：onShareAppMessage 的 path 拼法在这
 *   ├── app-wxss.js
 *   └── pages/
 * ```
 *
 * 目录名里那段 32 位十六进制是**包签名**。App 发新版它就变 ——
 * 这是「该重新发现一次」的信号。
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
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
    out.push(
      join(
        home,
        'Library', 'Containers', 'com.tencent.qq', 'Data',
        'Library', 'Application Support', 'QQ',
        'miniapp', 'temps', 'miniapp_src'
      )
    )
  } else {
    out.push(join(home, '.config', 'QQ', 'miniapp', 'temps', 'miniapp_src'))
  }
  return out
}

/** 压缩代码里的转义还原：`\x3d` → `=`，`\u0026` → `&`。 */
function unescapeJs(s) {
  return String(s)
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

/**
 * 列出本机缓存过的所有小程序。
 *
 * 同一个 App 可能有多个版本目录，按包签名去重只留最新的那个。
 *
 * @returns {Array<{appId:string, name:string, version:string, signature:string, dir:string}>}
 */
export function listCachedMiniapps(dirs = candidateDirs()) {
  const seen = new Map()
  for (const d of dirs) {
    if (!existsSync(d)) continue
    for (const entry of readdirSync(d)) {
      const full = join(d, entry)
      if (!existsSync(join(full, 'app-config.json'))) continue
      const m = entry.match(/^(\d+)_([^_]+)_([0-9a-f]{16,})/i)
      const appId = m ? m[1] : entry
      let mtime = 0
      try {
        mtime = statSync(full).mtimeMs
      } catch {}
      const rec = {
        appId,
        version: m ? m[2] : '',
        signature: m ? m[3] : '',
        dir: full,
        name: '',
      }
      const prev = seen.get(appId)
      if (!prev || mtime > prev._mtime) seen.set(appId, { ...rec, _mtime: mtime })
    }
  }
  const out = []
  for (const rec of seen.values()) {
    const { _mtime, ...rest } = rec
    out.push({ ...rest, name: appNameFromDir(rest.dir, rest.appId) })
  }
  return out.sort((a, b) => a.appId.localeCompare(b.appId))
}

/** 从小程序包里读它的显示名。读不到就返回 appId。 */
function appNameFromDir(dir, appId) {
  try {
    const conf = JSON.parse(readFileSync(join(dir, 'app-config.json'), 'utf8'))
    const w = conf.window || {}
    const cand =
      w.navigationBarTitleText ||
      conf.navigationBarTitleText ||
      conf.entryPagePath ||
      ''
    if (cand && !/^pages\//.test(cand)) return String(cand).trim()
  } catch {}
  // 退路：在 app-service.js 里找第一个 App({...}) 附近的短中文串
  try {
    const src = readFileSync(join(dir, 'app-service.js'), 'utf8').slice(0, 400_000)
    const m = src.match(/["']([\u4e00-\u9fa5][\u4e00-\u9fa5A-Za-z0-9·]{1,15})["']/)
    if (m) return m[1]
  } catch {}
  return appId
}

/** 找到某个 appId 对应的缓存目录。 */
function findApp(appId, dirs) {
  return listCachedMiniapps(dirs).find((x) => x.appId === String(appId)) || null
}

/**
 * 读页面路由表。
 *
 * 主包 `pages` + 分包 `subpackages`，**去重后**返回。
 *
 * @param {string} appId
 * @returns {string[]} 形如 `['pages/index/index', 'pages/video/video', ...]`
 */
export function routesOf(appId, dirs = candidateDirs()) {
  const hit = findApp(appId, dirs)
  if (!hit) return []
  let conf
  try {
    conf = JSON.parse(readFileSync(join(hit.dir, 'app-config.json'), 'utf8'))
  } catch {
    return []
  }
  const out = []
  const push = (p) => {
    const v = String(p || '').replace(/^\/+/, '').replace(/\/+/g, '/')
    if (v && !out.includes(v)) out.push(v)
  }
  for (const p of conf.pages || []) push(p)
  for (const sub of conf.subpackages || conf.subPackages || []) {
    const root = String(sub.root || '').replace(/^\/+|\/+$/g, '')
    for (const p of sub.pages || []) {
      const rel = String(p).replace(/^\/+/, '')
      push(root && !rel.startsWith(root + '/') ? `${root}/${rel}` : rel)
    }
  }
  return out
}

/**
 * 在业务代码里挖「这个 App 是怎么拼分享链接的」。
 *
 * 小程序分享时 `onShareAppMessage()` 返回 `{ title, path, imageUrl }`，
 * 那个 `path` 的形状**就是你要的 jumpUrl**。这段拼法写在 `app-service.js` 里，
 * 只是被压成一行了 —— 所以要按「引号包着的、含 pages/ 的字符串」去捞。
 *
 * 代码是压缩过的，正则只能捞片段、不能替你理解。但通常一看就懂，
 * 因为形如 `"/pages/video/video?bvid="` 已经直接给出答案了。
 *
 * @param {string} appId
 * @param {object} [opts]
 * @param {string} [opts.keyword]  只看包含这个词的（如 `video`、`search`）
 * @param {number} [opts.limit]    最多返回多少条，默认 40
 * @returns {string[]} 形如 `['/pages/video/video?bvid=', '/pages/pgcvideo/pgcvideo?epid=']`
 */
export function sharePathHints(appId, opts = {}, dirs = candidateDirs()) {
  const hit = findApp(appId, dirs)
  if (!hit) return []
  let src
  try {
    src = readFileSync(join(hit.dir, 'app-service.js'), 'utf8')
  } catch {
    return []
  }
  const kw = opts.keyword ? String(opts.keyword) : ''
  const limit = opts.limit ?? 40

  // 引号内、含 pages/ 的字符串。允许 \x3d 这类转义，先按原样捞再解码。
  const re = /["'`]((?:\/)?(?:pages|packages)\/[^"'`\\]*(?:\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4})?[^"'`]{0,120})["'`]/g
  const found = new Map()
  let m
  while ((m = re.exec(src))) {
    const raw = unescapeJs(m[1]).trim()
    if (!raw.startsWith('/')) continue
    if (kw && !raw.includes(kw)) continue
    // 只保留「带参数」的（那才是分享路径），但纯页面路径也留着备用
    const key = raw
    if (!found.has(key)) found.set(key, 0)
    found.set(key, found.get(key) + 1)
  }

  const list = [...found.entries()]
    // 出现次数多的、带 ? 的排前面（分享路径几乎都带参数）
    .sort((a, b) => {
      const qa = a[0].includes('?') ? 1 : 0
      const qb = b[0].includes('?') ? 1 : 0
      if (qa !== qb) return qb - qa
      return b[1] - a[1]
    })
    .map(([p]) => p)

  return list.slice(0, limit)
}

/**
 * 校验一个页面路径在当前路由表里还在不在。
 *
 * **这是本仓库最实用的一个函数。**
 *
 * 原因：发卡片时服务端**只负责签名，完全不校验跳转路径**。
 * 路径写错、或者 App 改版把页面删了，`get_mini_app_ark` 照样 `retcode: 0`
 * 照样给 token —— 卡片长得一模一样，但点开落首页。**从接口层看不出来。**
 *
 * 所以在发之前用它对一次路由表，能把「静默失效」变成「明确报错」。
 *
 * @param {string} appId
 * @param {string} path  形如 `/pages/video/video?bvid=BV1xx411c7mD`
 * @returns {{ok:boolean, page:string, reason?:string, suggestions?:string[]}}
 */
export function verifyPath(appId, path, dirs = candidateDirs()) {
  const clean = String(path || '').replace(/^\/+/, '')
  const page = clean.split('?')[0]
  const routes = routesOf(appId, dirs)
  if (!routes.length) {
    return { ok: false, page, reason: `没有 ${appId} 的缓存（可能没在这台机器上打开过）` }
  }
  if (routes.includes(page)) return { ok: true, page }
  // 没命中就给最像的几个，方便看出是不是改名了
  const base = page.split('/').pop()
  const suggestions = routes.filter((r) => r.includes(base) || base.includes(r.split('/').pop())).slice(0, 5)
  return {
    ok: false,
    page,
    reason: `路由表里没有 ${page}`,
    suggestions,
  }
}

/** 一份人看的报告。 */
export function report(appId, dirs = candidateDirs()) {
  const lines = []
  const apps = listCachedMiniapps(dirs)
  const live = dirs.filter(existsSync)
  lines.push(`缓存目录：${live.length ? live.join('\n          ') : '(一个都没找到)'}`)
  lines.push(`缓存里的小程序：${apps.length} 个`)
  for (const a of apps) {
    lines.push(`  ${a.appId}  ${a.name}  v${a.version}  包签名 ${a.signature.slice(0, 8)}…`)
  }
  if (appId) {
    const routes = routesOf(appId, dirs)
    lines.push('')
    lines.push(`【${appId} 的页面路由】${routes.length} 个`)
    for (const r of routes) lines.push(`  ${r}`)
    const hints = sharePathHints(appId, {}, dirs)
    if (hints.length) {
      lines.push('')
      lines.push('【分享路径（从 app-service.js 挖出来的）】')
      for (const h of hints) lines.push(`  ${h}`)
    }
  }
  return lines.join('\n')
}
