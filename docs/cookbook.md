# 怎么给一个 NapCat 没内置的 App 做直达卡片

NapCat 的 `get_mini_app_ark` 只有 `bili` 和 `weibo` 两个内置模板。
别的 App（小红书、网易云、知乎、闲鱼、公众号……）得自己给那 9 个参数。

其中 8 个都是软的（见 README 那张表），**真正决定成败的只有一个：`jumpUrl` 里的页面路径**。

这份文档就是教你怎么把那条路径挖出来。

---

## 第 0 步：先在 QQ 里打开它一次

QQ 只有**跑过**的小程序才会缓存。所以：

> 找到一个这个 App 的分享卡（别人转发的、群里看到的），**点开它**，进到你想分享的那一页，随便逛两下。

没做过这一步，后面什么都挖不到。

---

## 第 1 步：认出它的 appId

```js
import { listCachedMiniapps } from 'qq-miniapp-ark'

listCachedMiniapps()
```

输出大概长这样：

```
1109561335  金山文档  v3  签名 2c4c11a1…
1109937557  哔哩哔哩  v3  签名 42e9ad9d…
```

**name 是工具猜的**（从 `app-config.json` 的 `navigationBarTitleText`，或
`app-service.js` 里第一个短中文串）。猜不准不要紧，你可以按「刚打开过哪个」对时间。

如果列表里没有你要的 App，说明缓存没写进来。检查：

- QQ 是不是这个 Windows 账号下跑的（`%APPDATA%\QQEX\miniapp\temps\miniapp_src`）
- 是不是点了卡片但没真正进到小程序里
- 有的版本 QQ 会清理缓存，重新打开一次

---

## 第 2 步：看它有哪些页面

```js
import { routesOf } from 'qq-miniapp-ark'
routesOf('1109937557')
```

```
pages/index/index
pages/video/video
pages/pgcvideo/pgcvideo
pages/packages/common/search/search
pages/packages/tab2/favorite/favorite
…
```

主包和分包都在里面（分包已经在 `routesOf` 里拼好完整路径了）。

**这一步能让你排除掉一大批猜法。** 比如 B 站，你会看到只有 `pages/video/video`，
没有 `pages/video/index` —— 而这两者猜错的代价是「静默落首页」。

---

## 第 3 步：★ 挖它的分享路径长什么样

这是最关键的一步。

```js
import { sharePathHints } from 'qq-miniapp-ark'
sharePathHints('1109937557')
```

```
/pages/video/video?bvid=
/pages/video/video?aid=
/pages/pgcvideo/pgcvideo?epid=
/pages/pgcvideo/pgcvideo?ssid=
/pages/packages/common/search/search?kw=
/pages/packages/tab2/favorite/favorite?media_id=
/pages/packages/fallback/webview/webview?url=
```

**原理**：小程序分享时调 `onShareAppMessage()`，它返回 `{title, path, imageUrl}`。
那个 `path` 拼出来的形状**就是你要的 jumpUrl**。而这段拼法写在 `app-service.js` 里 ——
只是被压成一行了，所以要按「引号包着的、含 `pages/` 的字符串」去捞。

**为什么这是最可靠的办法**：这是开发者自己写的代码，不是外部观察推断的。
B 站的原文就是：

```js
"/pages/video/video?bvid=" + n
```

照抄这个形状，比猜一百次都准。

### 用 keyword 收窄

小程序有几十个页面时，输出会很长。按业务关键词过滤：

```js
sharePathHints('xxxx', { keyword: 'share' })
sharePathHints('xxxx', { keyword: 'detail' })
sharePathHints('xxxx', { keyword: 'video' })
```

### 挖不到怎么办

`app-service.js` 被压得比较狠时，正则可能捞不到。三个退路：

1. **在 `app-service.js` 里直接搜关键词**（文件几百 KB 到几 MB）：
   ```bash
   grep -o '"[^"]*pages/[^"]*?[^"]*"' app-service.js | sort -u | head -40
   ```
2. **看 `app-config.json` 的 `entryPagePath`** —— 至少知道默认首页是哪个
3. **翻 `pages/` 目录结构** —— 目录名通常就说明了功能（`video`、`detail`、`search`）
4. **最笨但有效**：在 QQ 里打开那一页，然后从「分享」按钮走一遍，**同时**录屏/截图看 QQ
   生成的分享卡链接（有些 App 分享出来是 `m.q.qq.com/a/s/<hash>`，那个 hash 里没有信息，
   但**分享对话框里如果能显示小程序页面路径**就直接拿到了）

---

## 第 4 步：凑齐那 9 个参数

```js
import { miniappCard, inspectCard } from 'qq-miniapp-ark'

// 先只看服务端返回什么，不真的发
const preview = await inspectCard(client, {
  appId: '你的appId',
  sdkId: 'V1_PC_MINISDK_99.99.99_1_APP_A',
  title: '标题',
  desc: '简介',
  picUrl: '封面URL',
  jumpUrl: '/pages/xxx/xxx?id=123',   // ← 第 3 步挖到的形状
  versionId: '',                       // 软参数，先留空
  scene: '1036',
  templateType: '1',
  businessType: '0',
  verType: '3',
  shareType: '0',
})
```

**`appId` 和 `sdkId` 是硬的**，缺了报 `retcode: 1200`。其余全软 —— 实测
`versionId` 传空串/乱码/全零都能拿到 token，`scene=0/1/1036` 都一样。

拿到 `config.token` 就说明签名这一环通了。

---

## 第 5 步：校验，然后发

```js
import { verifyPath } from 'qq-miniapp-ark'

verifyPath('你的appId', '/pages/xxx/xxx?id=123')
// { ok: true }
```

然后：

```js
const seg = await miniappCard(client, { …第 4 步那些参数… })
await client.send('private', 你的QQ号, [seg])
```

点开看是不是那一页。

---

## 出问题怎么排查

| 现象 | 最可能的原因 |
|---|---|
| `retcode: 1200` + `jsonContent` 报错 | `appId` 或 `sdkId` 空/错 |
| `retcode: 0` 但点开落首页 | **`jumpUrl` 路径不对**（这就是静默失效）。用 `verifyPath` 对一遍路由表 |
| 卡片根本不显示 | `title` / `picUrl` 空，或者用错了 `type` 分支 |
| 之前好使，现在落首页 | App 改版了。重跑第 2、3 步，看 `pages/` 有没有改名 |
| 提示「发送者版本过低」 | 你在手搓 ark，没走 NapCat 的签名接口 |

**记住：`retcode: 0` 不代表「点开能到」，只代表「签名拿到了」。**
这两件事之间隔着一条路径，而服务端不校验它。

---

## 已知的坑

1. **`jumpUrl` 和 `webUrl` 是两个字段。** `jumpUrl` 填小程序页面路径，`webUrl` 填 https 网址。
   填反了就是落首页。（这个坑我踩了很久 —— schema 里两行挨着，我只读了第一行的描述。）
2. **改 NapCat 源码通常没用。** `jumpUrl` 本来就透传到服务端，不需要打补丁。
3. **`type: 'bili'` 用的也是同一条路。** 它跟自定义 schema 在服务端产出的东西完全一样，
   区别只是模板写死了 9 个参数。所以「内置模板 vs 自己填」不是成败关键，`jumpUrl` 才是。
4. **包签名变了 = App 发新版了。** `listCachedMiniapps()` 返回的 `signature` 就是目录名里那段
   32 位十六进制。它一变，就该重跑一次第 2、3 步。
