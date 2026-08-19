# 艺术学院展厅预约

给师生的自助预约网页 + 接飞书多维表格的后端。部署在 Vercel，域名 `www.ysxy-exhibition.cloud`。

## 目录结构

```
.
├── index.html                    # 前端（选场地 / 月历 / 填信息 / 确认）
├── demo/index.html               # 演示版：index.html 的逐字节副本，见「演示版」一节
├── scripts/build-demo.sh         # 同步演示版（npm run build:demo）
├── lib/feishu.js                 # 共享模块（取 token、读写表、日期换算）
├── api/
│   ├── availability.js           # GET  /api/availability?venue=展厅   读某场地档期
│   └── book.js                   # POST /api/book                      写预约（含冲突校验、分级）
└── functions/                    # 旧 EdgeOne 版接口，已停用，待删（见 TODO.md C 节）
```

Vercel 按 `api/` 目录自动生成路由，前端与接口同源，**不需要处理跨域**。

## 两个接口

**GET `/api/availability?venue=<场地名>`**
读取该场地所有「已确认 / 审核中」的记录，返回占用档期：
```json
{ "ok": true, "venue": "展厅",
  "ranges": [ { "start":"2026-08-02","end":"2026-08-08","status":"booked" },
              { "start":"2026-08-20","end":"2026-09-02","status":"review" } ] }
```
`status`：`booked`=已约(浅红)、`review`=审核中(黄)。已驳回/已取消不返回=可约(绿)。

**POST `/api/book`**
请求体：`{ venue, start, end, exhibitionName, className, contactName, phone, email, teacher }`（日期为 `YYYY-MM-DD`）。
后端会：① 兜底校验 → ② **写入前重新查一次冲突**，重叠则返回 `409 {conflict:"booked"|"review"}` → ③ 按天数分级（≤10 天写 `已确认`，>10 天写 `审核中`）→ ④ 写入飞书。
成功返回：`{ "ok": true, "status": "已确认" | "审核中", "recordId": "..." }`。

## 环境变量（在 Vercel 控制台 → 项目 → Settings → Environment Variables 里填）

| 变量名 | 值 | 说明 |
|---|---|---|
| `FEISHU_APP_ID` | `cli_xxx` | 飞书自建应用 App ID |
| `FEISHU_APP_SECRET` | （你的） | 飞书 App Secret |
| `FEISHU_APP_TOKEN` | （你的） | 多维表格 app_token（表 URL `/base/` 后那串） |
| `FEISHU_TABLE_ID` | `tblxxx` | 数据表 table_id（表 URL `table=` 后那串） |

> 这四个只填在平台里，代码按名字读，不出现在仓库中。

**前提**：飞书表的列名与单选选项要和约定完全一致——
- 列：`展览名称 / 场地 / 布展日期 / 撤展日期 / 展出天数 / 状态 / 班级 / 联系人姓名 / 电话 / 邮箱 / 指导教师 / 来源 / 前三天邮件已发 / 审批邮件已发 / 驳回邮件已发 / 备注`
  - `前三天邮件已发 / 审批邮件已发 / 驳回邮件已发` 均为**复选框**字段，供邮件 SCF 回写幂等标记。
- `场地` 单选：`展厅 / 15号楼一楼走廊 / 16号楼一楼走廊 / 学院一楼花园中庭`
- `状态` 单选：`审核中 / 已确认 / 已驳回 / 已取消`
- `来源` 单选：`师生自助 / 管理员手动`
- 应用要作为该表的「可编辑」协作者（否则读不到表）。

## 演示版（`/demo`）

对外展示（作品集、简历）用的地址是 `https://www.ysxy-exhibition.cloud/demo/`，**不是站点根地址**。
访客能完整走完「选场地 → 选档期 → 填信息 → 确认页」，但不会碰到飞书，也不会触发任何邮件。

实现上只有一份代码：`index.html` 顶部的 `DEMO_MODE` 按 `location.pathname` 自己判断，
`CONFIG.useBackend = !DEMO_MODE`。`demo/index.html` 是它的**逐字节副本**，不做任何改动。

| 地址 | 模式 | 数据来源 |
|---|---|---|
| `/` | 真实 | `/api` → 飞书多维表格 |
| `/demo/` | 演示 | 文件内 `MOCK` 假档期 |
| `/?demo=1` | 演示 | 同上（临时预览用） |
| 本地 `file://` 双击打开 | 演示 | 同上（没有 `/api` 可调） |

演示模式下额外做三件事：顶部显示「演示版」提示条、标题加「（演示版）」后缀、确认页把真实的展厅管理邮箱替换掉。

**改完 `index.html` 一定要跑一次同步**，否则演示版停留在旧版本：

```bash
npm run build:demo
```

`MOCK` 的档期是特意排的：每个场地最近十来天内同时有浅红和黄、中间留出绿，
保证月历第一屏三色齐全；`review`（审核中）段一律 >10 天，与「≤10 天自助确认」的规则自洽。

## 部署

1. 把本目录推到 GitHub 仓库。
2. Vercel → 导入该仓库。框架预设「Other」，构建命令留空，根目录即输出目录。
3. 填上面 4 个环境变量。
4. 部署后访问 `/api/availability?venue=展厅` 应返回 JSON，站点根地址即接上真数据。
5. 绑定自定义域名 `www.ysxy-exhibition.cloud`（Vercel 预览域名会随部署变，别拿去对外发）。
6. 之后改代码 → `npm run build:demo` → commit → push → 自动重新部署。

> 为什么不是腾讯云 EdgeOne：其 Pages 国内版绑自定义域名硬性要求备案，而 `.cloud` 后缀不在可备案名单。
> 迁 Vercel 免备案、内地能访问，代价是走境外节点、速度稍慢。

## 已知取舍（都不影响先用起来）

- **token 每次现取**：低频足够；量大可加一层缓存（省一次请求）。
- **并发极小概率撞车**：查冲突和写入之间有极短空窗，两人同一秒约同一档才可能撞。已用「写前重查」压到很低；真撞了你能在飞书里一眼看到、手动理。
- **时区**：日期统一按北京时间存取。若你在飞书里**手填**的大展日期，月历显示差了一天，改 `lib/feishu.js` 里 `TZ_MS` 一个常量即可。
- **邮件不在这里**：确认信（附《布展申请表》PDF）与驳回重约信由腾讯云 SCF 每 5 分钟扫表发送，见 `scf-email-notifier/`。这里只负责「读档期 / 写预约」。
