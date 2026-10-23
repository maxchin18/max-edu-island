# AGENTS.md — 給 AI 助理的操作手冊

這個專案是「MAX 教育理念島」：一張 3D 互動地圖，每座六角島是一個教育理念。
**網站的全部內容都在 `data/site.json`**；程式碼只負責把它畫出來。
日後請 AI 幫忙經營時，99% 的工作只需要改這一個檔案。

## 黃金規則

1. **只改 `data/site.json` 就能改內容。** 不要把文字寫死在 `index.html` 或 JS 裡。
2. **改完一定要驗證**：`node tools/site.mjs validate`。有 ❌ 就不能提交。CI（`.github/workflows/validate.yml`）也會擋。
3. **id 一旦發布就不要改**（分享連結 `#island=food` 依賴它）。要改名字改 `name` 就好。
4. 優先用 `tools/site.mjs` 的指令新增或刪除，它會自動編號、找空位、清掉失效的參照，並在 `data/backups/` 留備份。
5. 新增島嶼時，`q`、`r` 要和既有島**相鄰**（六角格），小人才走得過去；不確定就讓工具自動找位置。
6. 文字用台灣正體中文。
7. 不要提交 `data/backups/`（已在 `.gitignore`）。

## 常用指令

```bash
node tools/site.mjs validate          # 驗證
node tools/site.mjs stats             # 統計 + 今天是哪一季
node tools/site.mjs list islands      # 也可以 links / people / values / seasons
node tools/site.mjs show food         # 看一座島的完整 JSON
node tools/site.mjs export-md         # 匯出全文到 docs/CONTENT.md（方便閱讀、校稿、餵給 AI）

# 新增
node tools/site.mjs add-island --name "閱讀推廣" --en reading-plus --icon 📖 --color "#A787D9" --landmark library --tagline "..." --values M,X
node tools/site.mjs add-item food --name "校園堆肥" --phase 中期 --target 中年級 --summary "..." --points "廚餘分類|堆肥觀察|回到菜園"
node tools/site.mjs add-person --name "營養師" --en dietitian --emoji 🥗 --color "#76C267" --count 2 --carry "🥗:營養菜單,🍎:水果" --homes food,sport --desc "..."
node tools/site.mjs add-link --from food --to sport,sel --title "..." --basis 校本理念

# 修改任一欄位（陣列可用 id 定位）
node tools/site.mjs set site.headline "讓每個孩子，都被看見。"
node tools/site.mjs set islands.food.tagline "從產地到餐桌"
node tools/site.mjs set seasons.mode '"winter"'      # 值會先嘗試 JSON 解析

# 刪除（會連帶清掉指向它的連結、焦點、常去島）
node tools/site.mjs remove item food-3
node tools/site.mjs remove person volunteer

# 任何寫入指令都可以先加 --dry-run 試跑
```

## 資料結構速查（完整定義見 `data/site.schema.json`）

| 區塊 | 內容 | 重點欄位 |
|---|---|---|
| `site` | 網站文字、導覽步驟、時鐘設定、後台倉庫 | `headline`、`tutorial[]`、`timeMode`、`adminRepo` |
| `values` | 價值面向（M / A / X…） | `id` 一個字母、`color` |
| `islands[]` | 理念島，順序 = 編號 | `id`、`name`、`icon`、`color`、`landmark`、`q`/`r`、`values[]`、`items[]` |
| `islands[].items[]` | 實踐細項 | `id`（全站唯一）、`phase`、`target`、`summary`、`points[]`、`schedule`、`image`、`link` |
| `links[]` | 協作連結（一對多） | `id`（C1…）、`from`、`to[]`、`title`、`basis` |
| `personTypes[]` | 人物類型（地圖上走來走去的小人） | `id`、`emoji`、`color`、`count`（0–30）、`homes[]`、`carry[]` |
| `seasons` | 四季 | `mode`（auto/spring/…）、`list[].months`（每月剛好一季）、`accent`、`focus[]`、`particle` |
| `airport` | 國際教育交流航班 | `enabled`、`island`、`planes`（0–4）、`partners[]` |

`landmark` 可用：school 學校、farm 農場、harbor 漁港、library 圖書館、tech 科技、sports 運動場、temple 廟宇、heart 心靈涼亭、hall 會議廳、home 家屋、garden 溫室、art 藝廊、puzzle 積木、globe 地球儀。

## 四季如何運作

- `seasons.mode = "auto"`：依今天的月份找出 `list[].months` 包含它的那一季（預設 3–5 春、6–8 夏、9–11 秋、12–2 冬，每三個月換一次）。
- 訪客可以用左上角按鈕手動切換，選擇存在他自己的瀏覽器（不影響別人）。
- 換季會改變：介面主色（`accent`）、草地與樹的顏色、落葉／積雪、粒子（花瓣、螢火蟲、落葉、雪）、海色、白鷺鷥↔黑面琵鷺、本季焦點島（`focus`）。

## 專案結構

```
index.html              前台頁面骨架
assets/css/style.css    前台樣式（清新玻璃感、手機版底部抽屜）
assets/js/app.js        介面：清單、詳情卡、日誌、季節、導覽、網址路由
assets/js/world.js      3D 場景總管：相機、光線、日夜、季節、畫質、點選
assets/js/terrain.js    理念島與 14 種地標建築
assets/js/coast.js      沿海陸地、魚塭、漁村、鹽山、小離島、機場島
assets/js/water.js      海面 shader（深淺漸層、近岸浪花）
assets/js/life.js       小人、海鷗、白鷺鷥、雲、季節粒子、船、飛機、車、風機
assets/js/flora.js      樹、花、燈、長椅與四季小物
assets/js/vehicles.js   船、飛機、汽車、風機、水車模型
assets/js/palette.js    一天的光線與四季配色
admin/                  後台（本機模式／GitHub 模式／離線匯出）
data/site.json          ★ 全部內容
data/site.schema.json   資料格式說明
tools/site.mjs          內容管理 CLI（驗證、新增、修改、刪除、匯出）
server.js               本機開發伺服器（含後台寫檔 API）
docs/CONTENT.md         由 export-md 產生的全文（可重新產生）
```

## 本機預覽

```bash
node server.js      # http://localhost:5173/ 前台，/admin/ 後台（本機模式直接存檔）
```

- 預覽後台尚未發布的草稿：`/?preview=1`
- 分享連結格式：`#island=food`、`#island=food&item=food-2`、`#link=C2`、`#person=farmer`
- 除錯：瀏覽器主控台有 `window.maxIsland.state`（含 `world`）

## 發布

推到 `main` 分支後，GitHub Pages 約 1 分鐘更新（CDN 快取最多約 10 分鐘）。
後台的「GitHub 模式」也是直接把 `data/site.json` commit 到 `main`。
