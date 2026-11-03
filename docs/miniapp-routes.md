# 小程序路由速查

`jumpUrl` 要用的页面路径。这份表是用 `discover.mjs` 从本机 QQ 缓存挖出来的，
不是猜的、也不是文档里抄的。

小程序更新后路径可能变 —— 变了就重跑 `node examples/discover.mjs <appid>`。

---

## B 站 · appId `1109937557`

`versionId`: `cfc5f7b05b44b5956502edaecf9d2240`

| 页面 | 路径 | 参数 |
|---|---|---|
| 首页 | `pages/index/index` | — |
| **视频详情** | `pages/video/video` | `bvid=BVxxx` 或 `aid=xxx` |
| 番剧 | `pages/pgcvideo/pgcvideo` | `epId=` / `seasonId=` |
| 频道 | `pages/channel/channel` | `?` |
| 我的 | `pages/account/account` | — |

**视频页拼法**（`app-service.js` 原文）：

```js
"/pages/video/video?bvid=" + item.bvid
"/pages/video/video?aid=" + item.aid
```

**深链形式**（同文件里的 deeplink 构造函数，走客户端协议不经过签名，用不上）：

```js
case "video": return "bilibili://video/" + id + "?" + params
```

---

## 怎么发现别的小程序

### 第一步：让那个小程序在电脑上跑一次

在 PC QQ 里点开它的卡片，或从「小程序」入口进去逛一圈。
不跑过就没有缓存。

### 第二步：列出缓存

```bash
node -e "
import('./src/discover.mjs').then(m => console.log(m.report()))
"
```

输出会列出缓存目录、所有小程序、各自的 appId 和目录。

### 第三步：看某个小程序的全部页面

```bash
node -e "
import('./src/discover.mjs').then(m => console.log(m.report('1109937557')))
"
```

### 第四步：找路径是怎么拼的

`report()` 会顺带给出 `app-service.js` 里含 `pages/...?...` 的片段。
代码是压缩过的，**需要人眼读** —— 通常长这样：

```js
[[2,"+"],[1,"/pages/video/video?bvid\x3d"],[[6],[[7],[3,"item"]],[3,"bvid"]]]
```

注意 `\x3d` 就是 `=`。翻译过来是 `"/pages/video/video?bvid=" + item.bvid`。

### 第五步：`versionId` 从哪拿

两个地方：

1. 真实分享卡的 `meta.detail_1.versionId`（让人分享一条给你，然后从聊天记录里挖）
2. NapCat 源码里 grep：`grep -n "versionId:" <napcat>/napcat/napcat.mjs`

`appId` 就是缓存目录名前缀。

---

## 已知可用组合

| 小程序 | appId | 状态 |
|---|---|---|
| 哔哩哔哩 | `1109937557` | ✅ 视频页直达已验证（2026-11-03） |

PR 欢迎补充。加新条目时请注明：验证日期、验证方式（真机点开落到哪）、`versionId`。
