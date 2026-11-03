# 怎么把这份代码发出去

本地已经是一个完整的 git 仓库（`2e7cd96`），只差推上去。

---

## 一、建仓库

去 https://github.com/new 建一个空仓库，名字建议 `qq-miniapp-ark`。

**不要**勾选「Add a README / .gitignore / license」——本地已经有了，勾了会冲突。

---

## 二、推

```bash
cd "D:\ASUS\Documents\DeepSeek官方\qq-miniapp-ark"

git remote add origin https://github.com/<你的用户名>/qq-miniapp-ark.git
git branch -M main
git push -u origin main
```

第一次推会让你登录。如果开了两步验证，密码位置要填 **Personal Access Token**（Settings → Developer settings → Personal access tokens → Generate new token，勾 `repo`）。

### 走代理

你机器的 git 已经配了 `http.proxy=127.0.0.1:7890`。推送卡住的话检查代理是否在跑。

---

## 三、发 npm（可选）

包名 `qq-miniapp-ark` 目前没被占用（2026-11-03 查）。

```bash
cd "D:\ASUS\Documents\DeepSeek官方\qq-miniapp-ark"
npm login
npm publish --access public
```

`package.json` 里 `files` 只含 `src` / `docs` / `examples`，不会把 `.git` 之类带上去。

---

## 四、发出去之前建议补的

- [ ] 换个真名：`package.json` 的 `author` 字段现在是空的
- [ ] git 身份：本仓库现在用的是临时身份（`qq-miniapp-ark <noreply@example.com>`），推之前改成你自己的
  ```bash
  git config user.name "你的名字"
  git config user.email "你的邮箱"
  git commit --amend --reset-author --no-edit
  ```
- [ ] 截图：README 顶部那张卡片的 ASCII 图，换成真机截图更有说服力
- [ ] 如果你愿意，加一节「谁在用」写染（QQ 那个机器人），算是实践案例

---

## 五、发布后可以喊话的地方

- NapCat 的 Discussions / Issues（他们文档里没写这条，是空白）
- V2EX「分享创造」
- 少数派 / 即刻
- B 站发个视频 —— 你自己就有号，而且这个发现本身够一条视频的体量：「我让 QQ 机器人发出了点开能直达的小程序卡片」
