# 原理：为什么这么做，以及我踩过的坑

这份文档记录的是**实验过程**，不是结论摘要。如果你要做类似的东西，看这页能省掉两周。

---

## 一、问题的形状

目标：在 QQ 里发一条**卡片**，上面有封面、标题、UP 主，**点开直接进那个视频**。

现成的路都走不通：

| 方式 | 结果 |
|---|---|
| 发一段文字带 `https://www.bilibili.com/video/BVxxx` | QQ 不自动出预览，就是一串蓝字 |
| 发 `https://b23.tv/BVxxx` | 同上 |
| 手搓 `json` 段（`com.tencent.structmsg` / `com.tencent.miniapp_01`） | QQ 显示「**发送者版本过低，无法显示内容**」 |
| 用 `type:'bili'` 模板要签名卡 | 卡片能显示，**点开是小程序首页**，不是视频 |
| 改真实卡的字段 | `retcode: 1200`（发送超时，服务端静默拒绝） |
| `xml` 段 | 必被风控 |

---

## 二、为什么手搓的卡显示「发送者版本过低」

这句话很有误导性 —— 它听起来像是 QQ 版本太旧。实际是**你发的 ark 里没有 `config.token`**。

真实卡片长这样（从历史消息里挖出来的）：

```json
{
  "app": "com.tencent.miniapp_01",
  "view": "view_8C8E89B49BE609866298ADDFF2DBABA4",
  "ver": "1.0.0.19",
  "config": {
    "type": "normal",
    "ctime": 1793689759,
    "token": "21a593fc678be3d20b82f54617bf78c4"
  },
  "meta": { "detail_1": { ... } }
}
```

那个 `token` 是腾讯服务端签发的。我试过：

- 用 19 种字段组合算 MD5 —— 全不中
- 把真实卡的 token 嫁接到我们生成的卡上（只改 url/qqdocurl）—— `retcode: 1200`

第二条是决定性的：**token 给整份内容签名**。改一个字都不行。

所以唯一的路是让服务端自己签 —— 也就是 NapCat 的 `get_mini_app_ark`，它内部会调 `AdaptShareInfo` 走一遍服务端。

---

## 三、`get_mini_app_ark` 有两个分支

看 `napcat.mjs` 的 schema 定义，入参是个 union：

### 分支 A：模板支（传 `type`）

```js
{ type: 'bili', title, desc, picUrl, jumpUrl, webUrl?, rawArkData? }
```

NapCat 内置模板会补全其余字段：

```js
{
  appId: '1109937557',
  scene: 1,
  templateType: 1,
  businessType: 0,
  verType: 3,
  shareType: 0,
  versionId: 'cfc5f7b05b44b5956502edaecf9d2240',
  sdkId: 'V1_PC_MINISDK_99.99.99_1_APP_A',
  withShareTicket: 0,
}
```

**⚠️ 这里我原本写错了一条，2026-11-04 实测更正：**

原话是「这个模板把 `jumpUrl` 当成**网页地址**处理，点开就是首页」。**这是错的。**

我拿同一个 `jumpUrl`（`/pages/video/video?bvid=BV…`）分别走两支发了两次：

| | `type: 'bili'`（内置模板） | 不传 `type`（自定义） |
|---|---|---|
| retcode | 0 | 0 |
| `config.token` | 有 | 有 |
| `view` | `view_8C8E89B49BE609866298ADDFF2DBABA4` | 同 |
| **点开** | **直达视频** | **直达视频** |

两支在服务端产出**完全一样**。`scene` 传 1 还是 1036 也无所谓（服务端回显永远是 0）。

**结论：`jumpUrl` 是不是页面路径，才是唯一的区别。走哪一支 schema 无关。**

这个错误是怎么来的：11-03 那晚我同时改了三处（`type` → 不传、jumpUrl → 路径、`scene` → 1036），成功后把三个都当成了原因，还给它编了句「type 分支会把 jumpUrl 当网页地址」的注释 —— **从没测过**。违反最基础的对照原则。

所以如果你只想发 B 站卡，用 `type: 'bili'` 那一支**就行**，参数还更少。

### 分支 B：自定义支（不传 `type`）

```js
{
  title, desc, picUrl, jumpUrl, iconUrl,
  appId, scene, templateType, businessType, verType,
  shareType, versionId, sdkId, withShareTicket
}
```

所有字段自己给。`jumpUrl` **原样**进签名请求。

**这就是钥匙**：`jumpUrl` 可以不是网址，而是**小程序页面路径**。

> ⚠️ `withShareTicket` 是必填的 `String`。漏了会报
> `retcode=1400 Schema compilation error: Expected union value`。
> 我一开始以为缺的是 `sdkId`，绕了半天。

---

## 四、页面路径从哪来（本仓库的核心发现）

`jumpUrl` 该填什么？没有任何公开文档说 B 站小程序的视频页路径。

**但它就在你电脑上。**

QQ 跑过的小程序全部缓存在本地：

```
%APPDATA%\QQEX\miniapp\temps\miniapp_src\1109937557_3_42e9ad9d8d5267ab0bee8967be6ebf92\
├── app-config.json    12.8 KB   ← 路由表
├── app-service.js    1109 KB   ← 业务代码
├── app-wxss.js        433 KB
└── pages/
```

`app-config.json` 里 `pages` 数组直接列出 18 个页面：

```json
["pages/index/index", "pages/channel/channel", "pages/account/account",
 "pages/video/video", "pages/pgcvideo/pgcvideo", ...]
```

然后 `app-service.js` 里找分享 path 是怎么拼的：

```js
[[2,"+"],[1,"/pages/video/video?bvid\x3d"],[[6],[[7],[3,"item"]],[3,"bvid"]]]
```

就是 `"/pages/video/video?bvid=" + item.bvid`。

**所以 `jumpUrl = /pages/video/video?bvid=BV1RExs64ELB`。**

### 猜是没有用的

在挖到之前我猜过：`pages/video/index`、`pages/index?id=`、`pages/index/index?bvid=`、`pages/detail/detail`…… 名字差一个字就回首页，而且**没有任何报错** —— 卡片正常显示，只是点开落错页。

这就是为什么 `discover.mjs` 存在：别猜，去读。

---

## 五、走错的路（都试过，都失败）

按时间顺序，给你省时间：

1. **把路径塞进 `vidUrl`** ——`vidUrl` 是 `AdaptShareInfo` 里的字段（默认硬编码空串），补丁打开后能透传，但落地页仍由签名载荷决定，改了没用
2. **塞进 `templateData` / `field20` / `appidRich` / `extField2`** —— 服务端返回的 `shareTemplateData` 永远是 `{}`
3. **改 `scene` 成 1036** —— 服务端返回里永远是 0（PC 协议签的），但 `scene` 跟直达无关
4. **换 `sdkId` 成 `V1_AND_MINISDK_...`** —— 没用
5. **`webUrl`** —— 会生成 `qqdocurl`，但点卡片主体还是走小程序
6. **嫁接真实卡 token** —— `retcode: 1200`
7. **算 token** —— 试了 19 种 MD5 组合，全不中
8. **`share` 段** —— 收✅发❌
9. **`xml` 段** —— 必风控
10. **升级内嵌 QQ** —— NapCat 只是包装层，内嵌 QQ 版本号写在 `qqpt.json` 里，升级 NapCat 不变
11. **`forward_friend_single_msg` 转发** —— 这个能用（原样转发真实卡 100% 保真），但前提是你手上有一条真卡，不能凭空生成

第 11 条是正经的备选方案，只是不能自动化。

---

## 六、怎么确认自己成功了

发出去之后：

```js
import { inspectCard } from 'qq-miniapp-ark'
console.log(inspectCard(seg))
// { app: 'com.tencent.miniapp_01', token: '3567016ecc...', title: '哔哩哔哩', ... }
```

**`token` 有值**说明签名成功。然后自己用手机点一下那条消息 —— 能进视频页就是对了。

`qqdocurl` 是空的**不影响**直达，别被它带偏。

---

## 七、已知限制

- **只测过 B 站**。别的小程序照同样的方法挖路径，但 `appId` / `versionId` 要自己找
- **`versionId` 服务端不校验**（2026-11-04 实测：空串 / 乱码 / 全零都能拿到 `config.token`）。填着它只是「跟官方模板一致」，填错不会导致失败。**卡片坏了别去查它，方向是错的。**
- **只有 `appId` 和 `sdkId` 是硬的**：空 → `retcode: 1200`。其余（`scene` / `templateType` / `businessType` / `verType` / `shareType` / `withShareTicket` 的值）服务端都不校验
- **「卡片显示了，但点开落首页」只有一个原因：`jumpUrl` 的路径不对或已失效。** 服务端不校验路径，`retcode` 照样 0 —— 这是静默失效，只能用 `verifyPath` 对着本机路由表查
- **小程序更新后路径可能变**（比如 `/pages/video/video` 改名）。重新跑一遍 `discover` 就行
- 这是对 QQ 协议的非公开用法，**行为可能随时变**。自己承担风险，别拿去做骚扰或营销
