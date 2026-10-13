# 里程機位搜尋

個人用的里程機位搜尋網站，資料來自 [seats.aero](https://seats.aero) 的 Partner API（Pro 方案，個人非商業使用）。

- `index.html`：網頁本體，放在 GitHub Pages。
- `worker/`：Cloudflare Worker 中繼站。seats.aero 的 API key 存在 Cloudflare 的 secret 裡，不在這個 repo。網頁要先輸入密碼，中繼站才會幫忙查。
