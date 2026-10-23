# MAX 教育理念島 🏝️

一座島，一個教育信念。用 3D 互動地圖呈現我的教育理念：14 座六角島拼成一所學校，
學生、老師、家長、小農、漁民……在島與島之間搬運資源；四季每三個月自動輪替，也可以手動切換。

**網站**：https://maxchin18.github.io/max-edu-island/
**後台**：https://maxchin18.github.io/max-edu-island/admin/

靈感來自 [HEART 政策島](https://puma.taipei/heart-island)，再往前進化。

## 功能

### 前台
- **3D 理念島**：14 座六角島，各有地標建築（學校、農場、漁港、圖書館、天文台、跑道、廟宇、涼亭、溫室、藝廊、積木、地球儀…），點島就飛過去並打開詳情卡。
- **沿海風景**：北邊與東邊是台江沿海陸地（沙灘、椰子樹、木麻黃防風林、魚塭與水車、漁村、廟、鹽山、遠山），外海有機場島、燈塔島、沙洲、礁石、箱網養殖與離岸風機。
- **海與天空**：近岸淺綠到外海深藍的漸層、一圈圈往岸邊推的浪花、緩慢起伏的海面；會飄的雲、海鷗群、白鷺鷥（冬天換成黑面琵鷺）、帆船與漁船、沿海公路上的車。
- **國際教育**：交流班機在機場島起降並飛越島群，高空客機拉出凝結尾；每次降落，日誌會記下哪國夥伴帶來什麼。
- **四季**：自動依月份換季（3–5 春、6–8 夏、9–11 秋、12–2 冬），或用左上角手動切換。換季會改變介面主色、草地與樹色、落葉與積雪、花瓣／螢火蟲／落葉／雪花、雪人與南瓜等小物，以及「本季焦點島」。
- **一天的光線**：清晨、白天、黃昏、夜晚（窗燈、路燈、燈籠、燈塔光束、星空），時間會自己流動，也可以鎖定時段或暫停。
- **人物類型**：小人沿著協作連結搬運東西，點小人看他從哪來、去哪、搬什麼；「人物」分頁可以只看某一種人。小人有表情：走路微笑、會眨眼，抵達時開心地跳一下、抬頭看你，頭上冒出 😊✨💗；老師、耆老、大學夥伴戴眼鏡。小人有手臂會擺動揮手，並分年齡層：兒童小一號、背書包、綁雙馬尾；長者白髮、微駝、拄拐杖、走得慢。
- **工具列**：名牌、搬運物、協作連結線、暫停、鳥瞰、島嶼日誌（即時事件＋概況統計）。
- **清單與搜尋**：理念主題、協作連結、人物三個分頁，全文搜尋並標示關鍵字。
- **分享連結**：`#island=food`、`#island=food&item=food-2`、`#link=C2`、`#person=farmer`。
- **畫質**：高畫質（陰影、輝光、高解析）、標準、省電三段，會依裝置自動降級。
- **手機版**：底部抽屜清單、詳情卡從下方滑出。

### 後台（`/admin/`）
- **三種模式**：本機模式（`node server.js` 時直接寫檔，含自動備份）、GitHub 模式（用你自己的 Token 直接 commit 到 repo，網站約 1 分鐘更新）、離線編輯（只匯出 JSON）。
- **可管理**：網站文字與導覽、理念島（含六角格位置挑選器、細項、圖片上傳）、協作連結、**人物類型（可新增）**、國際航線、價值面向、四季（月份、主色、焦點島、粒子）、選項清單。
- **安全網**：每次修改自動存草稿、預覽前台、資料檢查（重複 id、位置重疊、失效參照、月份沒分好…）、刪除可復原、發布衝突處理。

### 方便 AI 經營
- 內容與程式完全分離：**只改 `data/site.json`**。
- `AGENTS.md`／`CLAUDE.md`：給 AI 的操作手冊；`data/site.schema.json`：資料格式；`llms.txt`。
- `tools/site.mjs`：驗證、列出、新增、修改、刪除、匯出 Markdown 的命令列工具。
- GitHub Actions 每次推送自動驗證資料。
- `tests/ui-test.js`：前台 72 項自動化測試。

## 用 GitHub 模式在線上後台編輯

1. 到 GitHub → 右上頭像 → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**。
2. **Repository access** 選 *Only select repositories* → `max-edu-island`。
3. **Permissions** → **Contents** 設為 **Read and write**。
4. 產生後複製 Token（`github_pat_…`），打開後台選「GitHub 模式」貼上即可。Token 只存在你自己的瀏覽器。

## 本機開發

```bash
node server.js                 # 前台 http://localhost:5173/，後台 http://localhost:5173/admin/
node tools/site.mjs validate   # 驗證資料
node tools/site.mjs help       # 所有內容管理指令
```

不需要安裝任何套件（Node 18 以上）。3D 使用 [three.js](https://threejs.org/) r168（CDN 載入）。

## 檔案

| 路徑 | 說明 |
|---|---|
| `index.html`、`assets/` | 前台 |
| `admin/` | 後台 |
| `data/site.json` | ★ 全部內容 |
| `data/site.schema.json` | 資料格式 |
| `tools/site.mjs` | 內容管理 CLI |
| `tests/ui-test.js` | 前台自動化測試 |
| `server.js` | 本機伺服器 |
| `docs/CONTENT.md` | 全文（`node tools/site.mjs export-md` 產生） |
