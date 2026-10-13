# 里程機位搜尋

個人用的里程機位搜尋網站，資料來自 [seats.aero](https://seats.aero) 的 Partner API（Pro 方案，個人非商業使用）。所有帳號都用同一把 seats.aero key，所以只給自己的帳號用，不開放給別人。

## 架構

```
iPhone Safari
   │  網頁：GitHub Pages（index.html）
   │  每次呼叫都帶「通行證」（Authorization: Bearer ...）
   ▼
Cloudflare Worker  award-relay（worker/src/index.js）
   ├─ D1 資料庫 award-auth：帳號、登入中的裝置、邀請碼、重設連結
   ├─ KV：登入失敗次數、頻率限制（會自己過期）
   └─ seats.aero API（key 存在 Cloudflare 的 secret，不在這個 repo）
```

## 帳號系統（第一階段：不寄信）

| 功能 | 怎麼做 |
|---|---|
| 註冊 | Email + 密碼 + 邀請碼。邀請碼由管理員在「管理」頁產生，每個碼只能用一次，7 天後失效 |
| 密碼 | 不存密碼本身，只存 PBKDF2-SHA256 雜湊（10 萬次，每個密碼有自己的鹽）。至少 10 個字，並用 Have I Been Pwned 檢查是不是外洩過的密碼 |
| 登入 | 錯誤訊息一律是「Email 或密碼不對」，不透露 Email 有沒有註冊。同一個帳號錯 5 次鎖 15 分鐘 |
| 通行證 | 登入後拿到一組隨機字串，瀏覽器保存，資料庫只存它的 SHA-256。「記住我」30 天，不勾 1 天 |
| 忘記密碼 | 管理員產生一次性的重設連結（30 分鐘內有效） |
| 管理員 | 看所有帳號、產生邀請碼、停用或刪除帳號、產生重設連結 |

通行證、邀請碼、重設連結在資料庫裡都只有雜湊，所以資料庫就算被偷，也沒有能直接拿來登入的東西。

## 檔案

| 檔案 | 內容 |
|---|---|
| `index.html` | 整個網頁：搜尋、登入、註冊、我的帳號、管理頁 |
| `worker/src/index.js` | Worker：註冊、登入、通行證、管理員 API，以及轉送 seats.aero |
| `worker/migrations/0001_auth.sql` | 資料表結構（先看這個，最容易懂整個系統） |
| `worker/wrangler.toml` | Worker 設定：正式環境和測試環境（staging） |
| `worker/scripts/owner-invite.py` | 產生管理員邀請碼 |
| `worker/scripts/reset-link.py` | 管理員自己忘記密碼時，產生重設連結 |

## 指令（在 `worker/` 裡面執行）

```
# 測試環境：獨立的 Worker、資料庫、KV，先在這裡測再上正式
npx wrangler deploy --env staging
python scripts/owner-invite.py --staging

# 正式環境
npx wrangler d1 migrations apply award-auth --remote   # 資料表有改時
npx wrangler deploy
python scripts/owner-invite.py                         # 產生管理員邀請碼
python scripts/reset-link.py you@example.com           # 管理員忘記密碼

# 看 Worker 即時的紀錄
npx wrangler tail
```

網頁的部分，push 到 GitHub 之後，GitHub Pages 會自動更新。
