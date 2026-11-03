/**
 * 示例：挖出本机缓存的小程序页面路径。
 *
 * 用法：
 *   node examples/discover.mjs              # 列出所有缓存的小程序
 *   node examples/discover.mjs 1109937557   # 看 B 站小程序的全部页面 + 分享路径片段
 */

import { report } from '../src/index.mjs'

console.log(report(process.argv[2]))
