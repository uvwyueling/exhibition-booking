# 展厅预约系统 · 待办清单

## 已跑通（背景）

- 前端 `useBackend: true`，运行在真后端上
- 接口 `api/availability`（读档期）/ `api/book`（写预约）：写入前查冲突；≤10 天自助确认、>10 天转审核。**现托管在 Vercel Functions**（`api/` + 共享模块 `lib/feishu.js`）
- 飞书自动化：预约 >10 天 → 通知我进表人工审核
- SCF 定时（每 5 分钟）：状态=已确认 → 发确认信给班长 + 回写「审批邮件已发」（≤10 天自助确认的也一并覆盖）
- **确认信现在附带填好的《布展申请表》PDF** ✅（本轮完成）
  - `formpdf.js` 用 pdfkit **直接生成 PDF**（不经 docx→pdf，SCF 里没有排版引擎），内嵌开源 Noto 中文字体（`assets/NotoSansSC.ttf`，OFL 可分发）
  - 字段来自飞书记录：展览名称 / 班级 / 指导教师 / 布展日期 / 撤展日期 / 联系人姓名 / 电话 / 邮箱
  - 场地按单选自动打勾；日期/邮箱过长自动缩字号不溢出；PDF 不可编辑，班长打印给指导教师手写签名
- SCF 部署形态：`Nodejs 18`、256MB / 60s、定时触发 cron `0 */5 * * * ? *`、环境变量含飞书四项 + `SMTP_HOST/PORT/USER/PASS`（网易企业邮 `smtp.qiye.163.com:465`）
- **界面文案上线化** ✅（本轮完成）：删除顶部「原型演示 · 档期为模拟数据 · 未接后台」徽章与底部「交互原型…」提示；校名全站统一为「湖州师范大学」；标签页标题去掉「（原型）」；footer 改为正式落款「湖州师范大学艺术学院 · 展厅预约系统 / 如遇问题请联系管理员 ☎️ 0572-2321967」（两行）；清理无用 `.demo-tag` CSS
- **迁移到 Vercel + 正式上线** ✅（本轮完成）
  - 弃用 EdgeOne：其 Pages 国内版绑自定义域名**硬性要求备案**，且买的 `.cloud` 后缀**不在可备案名单**，此路不通；`.edgeone.cool` 预览链接匿名 401 关不掉
  - 接口从 EdgeOne `onRequest({env})` 格式移植为 Vercel `GET/POST(request)` + `process.env`（`api/availability.js`、`api/book.js`），逻辑未变；共享模块复制为 `lib/feishu.js`；根 `package.json` 加 `type:module`
  - Vercel 环境变量填飞书四项；同源 `/api` 免跨域
  - 已绑定域名 **`www.ysxy-exhibition.cloud`**（腾讯云买、DNSPod 解析、Vercel 自动签发 HTTPS）；**免备案**（走 Vercel 境外节点，内地能访问、稍慢——这是不备案的取舍）
  - 线上可公开访问（前端 + `/api` 均 200）

---

## A. 核心功能（已建，待部署）

- [x] **前三天《登记表》邮件** ✅（本轮完成，代码就绪）— 新增 `scf-email-notifier/daily.js`（独立 handler）：扫「布展日 = 今天+3(北京时间) 且 状态=已确认 且 前三天邮件已发≠true 且 有邮箱」→ 复用 `formpdf.js` 生成 PDF → 发给班长（联系人邮箱，可 `NOTIFY_CC` 抄送）→ 回写「前三天邮件已发=true」。日期用 `feishu.tsToDateStr(Date.now()+3*86400000)` 算目标日，与记录 `布展日期` 字符串比对。
  - **待你做**：在腾讯云新建**第二个 SCF 函数**，同一份 `scf-email-notifier` zip，handler 入口填 `daily.main_handler`，定时触发器 cron `0 0 9 * * ? *`（北京时间每天 9 点），环境变量与现有函数相同（飞书四项 + SMTP 五项 + 可选 `NOTIFY_CC`）。「前三天邮件已发」字段表里已有，无需新增。
  - *取舍：窗口只有「布展日−3」当天，靠每天准点触发 + 回写幂等把漏发压到很低；真漏了飞书里一眼可见、可手补。*
- [x] **驳回邮件** ✅（本轮完成，代码就绪）— 扩展现有 5 分钟 SCF（`index.js` 第二趟扫描）：扫「状态=已驳回 且 驳回邮件已发≠true 且 有邮箱」→ 发重约信（无附件）→ 回写「驳回邮件已发=true」。档期转绿由 availability 接口按状态自动生效，无需额外处理。
  - **待你做**：① 在飞书表**新增复选框字段「驳回邮件已发」**（不加则回写会失败、每轮重发）；② 重新打包 `scf-email-notifier` 上传更新现有 5 分钟函数。

## B. 待确认 / 待提供

- [x] **正式域名 / 公开访问** — 已解决：迁 Vercel + 绑 `www.ysxy-exhibition.cloud`（详见上方「已跑通」）。免备案、公开可访问。取舍：走境外节点，内地速度不如备案国内加速。
- [x] **场地照片** — 四张照片（展厅 / 15号楼 / 16号楼 / 花园中庭）已放入 `img/` 并填进 `CONFIG.venueImages`。顺带修了 `.vphoto img` 裁切 bug（加 `position:absolute;inset:0`，让横竖不同比例的照片统一裁成 16:10，卡片高度一致）。

## C. 打磨（可选）

- [ ] **确认信文案** — 现写「已通过管理员审核」；≤10 天自助确认并未经人工审核，措辞略不准。可改中性（「你的预约已确认」）或按是否人工审核分两版。
- [ ] **抄送自己** — 给 SCF 配环境变量 `NOTIFY_CC=03024@huznu.edu.cn`，每封确认信抄送一份，实时掌握每一单成约。（代码已支持，填变量即生效。）
- [ ] **git 清理** — `.gitignore` 加 `scf-email-notifier/node_modules/` 和 `scf-email-notifier.zip`（可再生产物，别入库）；但 `assets/NotoSansSC.ttf` 是部署必需资源，**要保留提交**。
- [ ] **删旧 EdgeOne 函数** — 确认 Vercel 稳定运行几天后，删掉 `functions/` 整个目录（Vercel 不路由、已是死文件）；届时 `lib/feishu.js` 成为 Feishu 逻辑唯一来源，消除与 `functions/api/_feishu.js` 的重复。

## D. 验证

- [x] ≤10 天的自助预约，学生**是否真收到确认信**？—— 已验证：申请次日起 ≤10 天展览，收到邮件 + PDF 附件，字段/勾选均正确。
- [ ] **>10 天人工审核路径**端到端：把飞书里一条「审核中」改为「已确认」，确认班长同样收到带 PDF 的邮件。（与自助路径共用最后一环，理论必通，未实测。）
- [ ] 飞书里**手填**的大展日期，月历显示**是否对得上、没差一天**？（差则调 `lib/feishu.js` 里的 `TZ_MS`。）
- [ ] **内地手机流量实测** `www.ysxy-exhibition.cloud` 加载速度可接受？（境外节点的已知取舍）
- [ ] **根域** `ysxy-exhibition.cloud`（不带 www）能否打开/跳转？不行则补 DNSPod 的 `@` A 记录。

---

**现状**：已正式上线（Vercel + `www.ysxy-exhibition.cloud`，公开可访问）。后端读写档期在 Vercel、邮件/PDF 在腾讯 SCF，两套独立运行。A 两块功能（前三天登记表邮件、驳回邮件）**代码已就绪**，待部署（见 A 节「待你做」）。
**下一步优先级**：把 A 两块部署上线 —— ① 飞书表加复选框「驳回邮件已发」+ 更新现有 5 分钟函数；② 新建每日 9 点 SCF，handler 填 `daily.main_handler`。之后跑 D 节端到端验证。
