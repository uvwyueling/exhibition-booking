# 艺术学院展厅预约

给师生的自助预约网页 + 接飞书多维表格的后端。部署在腾讯云 EdgeOne Pages。

## 目录结构

```
.
├── index.html                    # 前端（选场地 / 月历 / 填信息 / 确认）
└── functions/
    └── api/
        ├── _feishu.js            # 私有共享模块（取 token、读写表、日期换算）；下划线开头=不生成路由
        ├── availability.js       # GET  /api/availability?venue=展厅   读某场地档期
        └── book.js               # POST /api/book                      写预约（含冲突校验、分级）
```

EdgeOne Pages 按 `/functions` 目录自动生成路由，前端与接口同源，**不需要处理跨域**。

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

## 环境变量（在 EdgeOne 控制台 → 项目 → 环境变量里填）

| 变量名 | 值 | 说明 |
|---|---|---|
| `FEISHU_APP_ID` | `cli_xxx` | 飞书自建应用 App ID |
| `FEISHU_APP_SECRET` | （你的） | 飞书 App Secret |
| `FEISHU_APP_TOKEN` | （你的） | 多维表格 app_token（表 URL `/base/` 后那串） |
| `FEISHU_TABLE_ID` | `tblxxx` | 数据表 table_id（表 URL `table=` 后那串） |

> 这四个只填在平台里，代码按名字读，不出现在仓库中。

**前提**：飞书表的列名与单选选项要和约定完全一致——
- 列：`展览名称 / 场地 / 布展日期 / 撤展日期 / 展出天数 / 状态 / 班级 / 联系人姓名 / 电话 / 邮箱 / 指导教师 / 来源 / 前三天邮件已发 / 审批邮件已发 / 备注`
- `场地` 单选：`展厅 / 15号楼一楼走廊 / 16号楼一楼走廊 / 学院一楼花园中庭`
- `状态` 单选：`审核中 / 已确认 / 已驳回 / 已取消`
- `来源` 单选：`师生自助 / 管理员手动`
- 应用要作为该表的「可编辑」协作者（否则读不到表）。

## 切到真实数据

`index.html` 顶部 `CONFIG.useBackend`：
- `false`（默认）：用内置 MOCK 假数据，纯本地演示，不碰飞书 —— 现在验证「国内能打开」用这个即可。
- `true`：调 `/api` 真接口。**等 EdgeOne 部署好、环境变量填好、飞书表建好，把它改成 `true` 再 push。**

## 部署

1. 把本目录推到 GitHub 仓库。
2. EdgeOne Pages → 创建项目 → 导入该 Git 仓库。
3. 构建设置：框架预设「无 / 静态」，构建命令留空，输出目录根目录（`/`）。纯静态站点无需 `edgeone.json`。
4. 填上面 4 个环境变量。
5. 部署后访问 `/api/availability?venue=展厅` 应返回 JSON；页面把 `useBackend` 改 `true` 即接上真数据。
6. 之后改代码 → commit → push → 自动重新部署。

## 已知取舍（都不影响先用起来）

- **token 每次现取**：低频足够；量大可用 EdgeOne KV 缓存 token（省一次请求）。
- **并发极小概率撞车**：查冲突和写入之间有极短空窗，两人同一秒约同一档才可能撞。已用「写前重查」压到很低；真撞了你能在飞书里一眼看到、手动理。
- **时区**：日期统一按北京时间存取。若你在飞书里**手填**的大展日期，月历显示差了一天，告诉我，改 `_feishu.js` 里 `TZ_MS` 一个常量即可。
- **邮件不在这里**：确认信、成约通知、前三天《登记表》要用 Node 运行时发 SMTP，放在腾讯云云函数 SCF，属于下一步。这里只负责「读档期 / 写预约」。
