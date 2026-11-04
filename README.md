# qq-miniapp-ark

让第三方 QQ 机器人发出的小程序卡片 **点开直达某一页**，而不是落回首页。

```
普通链接        https://www.bilibili.com/video/BV1RExs64ELB   → 聊天里一条网址
卡片但不填对    jumpUrl: "https://..."                        → 卡片好看，点开落首页
这个仓库        jumpUrl: "/pages/video/video?bvid=BV1RExs64ELB" → 点开就是那个视频
```

零依赖，Node ≥ 22，通过 OneBot 11 对接 NapCat（已实测）。

---

## 先说清楚一件事

**NapCat 已经有发卡的 API 了。** `get_mini_app_ark` / `send_ark_share` 都在，所以
「怎么把卡片发出去」不是这个仓库解决的问题。

真正卡住所有人的是另一件事：

> `jumpUrl` 要填的是**小程序页面路径**，不是网址。而这个路径**没有任何公开文档**。

更糟的是它**填错不报错**。服务端只负责签名，完全不校验跳转路径 —— 你填
`/pages/nonexist/xxx` 它照样返回 `retcode: 0`、照样给 token，卡片长得一模一样，
**点开落首页**。你从接口层看不出来。

所以本仓库的主体不是「封装 API」，是 **`discover`：从你自己的电脑上把路径挖出来。**

那条路径一直就在那儿 —— QQ 把跑过的小程序全缓存了，里面有：

- `app-config.json` — 完整的页面路由表
- `app-service.js` — 业务代码，**里面写着这个 App 自己是怎么拼分享链接的**

---

## 装

```bash
npm i qq-miniapp-ark
```

需要一个跑着的 NapCat（开了 WebSocket 服务端，默认 3001）。

---

## 一、先挖路径（这是重点）

```js
import { listCachedMiniapps, routesOf, sharePathHints, verifyPath } from 'qq-miniapp-ark'

// 1. 本机缓存过哪些小程序
listCachedMiniapps()
// [ { appId: '1109937557', name: '哔哩哔哩', version: '3', signature: '42e9ad9d…', dir: '…' },
//   { appId: '1109561335', name: '金山文档', version: '3', signature: '2c4c11a1…', dir: '…' } ]

// 2. 它有哪些页面
routesOf('1109937557')
// [ 'pages/index/index', 'pages/video/video', 'pages/pgcvideo/pgcvideo', … ]

// 3. ★ 它自己是怎么拼分享路径的（直接就是答案）
sharePathHints('1109937557')
// [ '/pages/video/video?bvid=',
//   '/pages/video/video?aid=',
//   '/pages/pgcvideo/pgcvideo?epid=',
//   '/pages/packages/common/search/search?kw=', … ]

// 4. 这条路径现在还活着吗
verifyPath('1109937557', '/pages/video/video?bvid=BV1RExs64ELB')
// { ok: true, page: 'pages/video/video' }
```

第 3 步是关键。别人的 App 不会告诉你它的分享链接长什么样，**但它的代码里写着**。

---

## 二、发一张卡

```js
import { createClient, bilibiliCard, findBvid } from 'qq-miniapp-ark'

const client = await createClient({ wsUrl: 'ws://127.0.0.1:3001' })

const seg = await bilibiliCard(client, {
  bvid: 'BV1RExs64ELB',
  title: '炸鸡腿就挺好',
  desc: 'UP 主名',
  pic: 'https://i0.hdslb.com/bfs/archive/xxx.jpg',
  verify: true,        // 发之前对一次路由表，路径没了就不发（而不是发一张落首页的卡）
})

await client.send('private', 123456789, [seg])
```

`verify: true` 是我强烈建议打开的。**它是这套东西里唯一能对抗「静默失效」的开关** ——
B 站哪天改版把 `pages/video/video` 删了，服务端不会告诉你，只有路由表会。

---

## 三、B 站配方（可复现）

`jumpUrl` 的那条路径不是猜的，是从 `app-service.js` 里挖出来的原文：

```js
"/pages/video/video?bvid=" + n
```

同文件里还有（`sharePathHints('1109937557')` 可复现出来）：

| 用途 | 路径 |
|---|---|
| 普通视频 | `/pages/video/video?bvid=BV…` |
| 普通视频（数字 id） | `/pages/video/video?aid=…` |
| 番剧（ep id） | `/pages/pgcvideo/pgcvideo?epid=ep…` |
| 番剧（season id） | `/pages/pgcvideo/pgcvideo?ssid=…` |
| 搜索 | `/pages/packages/common/search/search?kw=…` |
| 收藏夹 | `/pages/packages/tab2/favorite/favorite?media_id=…` |

`bilibiliCard()` 已经把这些封好了。想自己拼：

```js
import { miniappCard, BILI_APP_ID, videoPath } from 'qq-miniapp-ark'
const seg = await miniappCard(client, {
  appId: BILI_APP_ID,
  title: '标题',
  desc: '简介',
  picUrl: '封面',
  jumpUrl: videoPath('BV1RExs64ELB'),   // /pages/video/video?bvid=BV1RExs64ELB
})
```

### 那九个参数里，哪些是真的

`get_mini_app_ark` 自定义 schema 要 9 个参数。实测下来：

| 参数 | 硬度 | 说明 |
|---|---|---|
| `appId` | **硬** | 空 → `retcode 1200` |
| `sdkId` | **硬** | 空 → `retcode 1200`。目前 `V1_PC_MINISDK_99.99.99_1_APP_A` 可用 |
| `jumpUrl` | **决定一切** | 填小程序页面路径。**填错不报错** |
| `title` / `desc` / `picUrl` / `iconUrl` | 软 | 只影响外观 |
| `versionId` | 软 | 实测空串/乱码/全零都能拿到 token |
| `scene` / `templateType` / `businessType` / `verType` / `shareType` | 软 | 服务端不校验，回显也都是 0 |

**别在这上面花时间**（我花过，白花）：往 `vidUrl` / `templateData` / `field20` /
`appidRich` 里塞页面路径全部无效，还得改 NapCat 源码才传得进去 —— 而 `jumpUrl`
本来就能透传。

---

## 四、接别的小程序

NapCat 的 `type` 只有 `bili` 和 `weibo` 两个内置模板。**别的 App 得你自己给那 9 个参数。**

好消息是不难，因为真正难的那一步 —— 找路径 —— 有工具。

完整步骤写在 **[`docs/cookbook.md`](docs/cookbook.md)**，大致是：

1. 先在 QQ 里打开目标小程序（必须打开过一次，缓存才有）
2. `listCachedMiniapps()` 认出它的 appId
3. `sharePathHints(appId, { keyword: 'share' })` 看它怎么拼路径
4. 照抄那个形状，填进 `jumpUrl`
5. `verifyPath()` 确认，然后发

---

## ⚠️ 这个项目天然有寿命

三件事得先说清楚：

1. **它解决不了「App 改版导致路径失效」，只能让你早点知道。** 这是可观测性，不是稳定性。
2. **服务端现在不校验路径，不代表以后也不校验。** 腾讯随时可以补上。
3. **`sdkId` 是猜的通用值**，现在能用，不保证永远。

**这是对当前 QQ 客户端行为的记录与工具化，不是官方支持的接口，随时可能失效。**

如果哪天它不能用了，`verifyPath()` 会是第一个告诉你的地方。

---

## 为什么不能自己搓 ark

手搓 ark 发出去，QQ 会显示「**发送者版本过低**」。

因为真实卡片里带一个 `config.token`，那是**腾讯服务端签发的**，而签名接口藏在
QQ 客户端内部（`LightAppSvc.mini_app_share.AdaptShareInfo`），没有公开入口。
NapCat 是把自己塞进 QQ 进程、拿到它内部的 packet 接口才调通的。

所以正确姿势只有一个：**借 QQ 自己的签名能力**，也就是 NapCat 的 API。

（这条路我试过：19 种 MD5 猜 token、嫁接真实卡的 token、六种模板组合 —— 全失败。
详见 `docs/how-it-works.md`。）

---

## API

<details>
<summary>完整导出</summary>

**发现**

- `candidateDirs()` — 可能存放缓存的位置
- `listCachedMiniapps(dirs?)` — 本机缓存的小程序 `{appId, name, version, signature, dir}`
- `routesOf(appId, dirs?)` — 页面路由数组（主包 + 分包，去重）
- `sharePathHints(appId, {keyword, limit}, dirs?)` — 从业务代码里挖分享路径
- `verifyPath(appId, path, dirs?)` — `{ok, page, reason?, suggestions?}`
- `report(appId?, dirs?)` — 一份人看的报告

**发卡**

- `createClient({wsUrl, token, timeoutMs})` — OneBot 11 客户端
- `miniappCard(client, card, opts?)` — 底层，返回一个消息段
- `inspectCard(client, fields)` — 只看服务端返回什么，不发送

**B 站**

- `BILI_APP_ID` / `BILI_VERSION_ID` / `BILI_ICON`
- `videoPath(bvid)` / `bangumiPath(epId)` / `searchPath(keyword)`
- `verifyBilibiliPath(path)`
- `bilibiliCard(client, {bvid, title, desc, pic, verify})`
- `findBvid(text)` — 从文本/短链里抠 BV 号

</details>

---

## License

MIT
