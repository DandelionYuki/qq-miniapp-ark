/**
 * 示例：给一个 B 站视频发一张能点开直达的小程序卡片。
 *
 * 用法：
 *   set QQ_WS=ws://127.0.0.1:3001
 *   set QQ_TOKEN=你的 OneBot access_token
 *   node examples/bilibili.mjs <QQ号> <BV号>
 */

import { createClient, bilibiliCard, inspectCard } from '../src/index.mjs'

const [, , targetQQ, bvid] = process.argv
if (!targetQQ || !bvid) {
  console.error('用法：node examples/bilibili.mjs <QQ号> <BV号>')
  process.exit(1)
}

const client = createClient({
  wsUrl: process.env.QQ_WS || 'ws://127.0.0.1:3001',
  token: process.env.QQ_TOKEN || '',
})

const seg = await bilibiliCard(client, {
  bvid,
  title: '这个标题要你自己填（留空会显示成「哔哩哔哩」）',
  desc: 'UP 主名字或一句话简介',
  pic: '', // 封面 URL
})

if (!seg) {
  console.error('没拿到签名卡。检查：NapCat 在跑吗？token 对吗？BV 号格式对吗？')
  process.exit(2)
}

console.log('卡片信息：', inspectCard(seg))

const r = await client.send('private', Number(targetQQ), [seg])
console.log('发送结果：', r?.status, r?.retcode)

client.close()
