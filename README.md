# qq-miniapp-ark

让第三方 QQ 机器人发出**点开直达具体页面**的小程序卡片。

不是「能显示个卡片」——是**点开就到你想要的那一页**。

```
这个你肯定喜欢

┌──────────────────────────────┐
│ [封面]  哔哩哔哩             │
│         炸鸡腿就挺好          │
│         哔哩哔哩 · 短视频     │  ← 点这里，直接播
└──────────────────────────────┘
```

零依赖，Node ≥ 22，基于 OneBot 11 协议（NapCat 已验证）。

---

## 装上就能发

```bash
npm i qq-miniapp-ark
```

```js
import { createClient, bilibiliCard } from 'qq-miniapp-ark'

const client = createClient({
  wsUrl: 'ws://127.0.0.1:3001',
  token: process.env.QQ_TOKEN, // OneBot 的 access_token
})

const seg = await bilibiliCard(client, {
  bvid: 'BV1RExs64ELB',
  title: '炸鸡腿就挺好',
  desc: 'UP 主名',
  pic: 'https://i0.hdslb.com/bfs/archive/xxx.jpg',
})

await client.send('private', 123456789, [seg])
```

三步：拿客户端 → 造卡片 → 发。`seg` 是普通 OneBot 消息段，可以跟文字拼在一起：

```js
await client.send('private', qq, [
  { type: 'text', data: { text: '这个你肯定喜欢' } },
  seg,
])
```

---

## 关键的三件事

### 1. 别自己搓 ark

手搓的 `json` 段没有 `config.token`，QQ 会显示「**发送者版本过低，无法显示内容**」。

那个 token 由腾讯服务端签发，本地算不出来，而且**给整份内容签名**——改任何字段都会 `retcode: 1200`。

### 2. `jumpUrl` 填的是**小程序页面路径**

不是网址。

```js
jumpUrl: '/pages/video/video?bvid=BV1RExs64ELB'  // ✅ 点开直达
jumpUrl: 'https://www.bilibili.com/video/BVxxx'  // ❌ 点开是首页
```

### 3. 必须走「自定义 schema」分支

`get_mini_app_ark` 的入参是个 union。传 `type: 'bili'` 会用内置模板，那个模板把 `jumpUrl` 当网页地址处理，到不了页面。

不传 `type`、所有字段自己给，`jumpUrl` 才会原样进签名请求。

`miniappCard()` 已经处理好了。

---

## 页面路径从哪来

没有任何公开文档。**但它在你电脑上**——QQ 把跑过的小程序全缓存了，里面有完整路由表。

```bash
node examples/discover.mjs 1109937557
```

```
【1109937557 的页面路由】18 个
  pages/index/index
  pages/video/video          ← 就是它
  pages/pgcvideo/pgcvideo
  ...

【分享路径片段（人眼读）】
  "/pages/video/video?bvid="
```

详见 [docs/miniapp-routes.md](docs/miniapp-routes.md)。

---

## API

### `createClient({ wsUrl, token, timeoutMs })`

极简 OneBot 11 客户端。`call(action, params, opts)` / `send(kind, target, message)` / `close()`。

如果你已经有自己的协议层，不需要这个 —— 只要有个带 `call()` 的对象就行。

### `miniappCard(client, card, opts)`

| 字段 | 必填 | 说明 |
|---|---|---|
| `appId` | ✅ | 小程序 appid |
| `versionId` | ✅ | 小程序版本标识 |
| `jumpUrl` | ✅ | **页面路径** |
| `title` | | 卡片标题 |
| `desc` | | 描述 |
| `picUrl` | | 封面（建议 16:9） |
| `iconUrl` | | 小程序图标 |

返回 OneBot 消息段；**拿不到签名返回 `null`** —— 调用方应该退回纯文本，别硬发。

### `bilibiliCard(client, video)`

B 站预设。`{ bvid, title, desc, pic }`。

### `inspectCard(seg)`

调试用，打印卡片里的 `app` / `token` / `title` / `jumpUrl`。**`token` 有值就是签名成功**。

### `report(appId)` / `routesOf(appId)` / `sharePathHints(appId)`

路径发现工具，见 `src/discover.mjs`。

---

## 踩坑记录

完整的实验过程（包括十几种失败的路）写在 [docs/how-it-works.md](docs/how-it-works.md)。

挑三条最值得知道的：

- **`withShareTicket` 是必填字符串**，漏了报 `retcode=1400 Schema compilation error: Expected union value`。别以为缺的是 `sdkId`
- **`qqdocurl` 是空的完全不影响直达**，别盯着它调
- **改真实卡的 token 会 `retcode: 1200`**，token 跟内容绑死，一分钟就能验证完，别在这上面花时间

---

## 限制

- 只验证过 **B 站**（`1109937557`）。别的小程序照同样方法挖路径，`appId` / `versionId` 要自己找
- `versionId` 会随小程序版本变。卡片突然不显示了，先核对它
- 小程序更新后页面路径可能改名，重跑 `discover` 就行
- 这是对 QQ 协议的非公开用法，**随时可能失效**。自己承担风险，别拿去做骚扰或营销

---

## 环境

- Node ≥ 22（用了内置 `WebSocket`）
- NapCat 4.18.x 已验证（`get_mini_app_ark` 是 NapCat 的扩展 action，标准 OneBot 11 没有）
- 理论上任何实现了 `get_mini_app_ark` 的 OneBot 实现都行

---

## License

MIT
