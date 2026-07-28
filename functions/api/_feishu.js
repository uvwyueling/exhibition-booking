// functions/api/_feishu.js
// 飞书多维表格共享模块。文件名下划线开头 = 私有模块，不生成路由，仅供其它函数 import。
// 运行环境：EdgeOne Pages 边缘函数（Web 标准 API，只用到 fetch）。

const FEISHU = "https://open.feishu.cn/open-apis";

/* ========== 常量（与飞书表 / 前端保持完全一致，改这里即改全局） ========== */
export const VENUES = ["展厅", "15号楼一楼走廊", "16号楼一楼走廊", "学院一楼花园中庭"];
// 只有这两种「状态」算占用；映射成前端月历颜色。已驳回 / 已取消 / 空 = 不占用（绿）。
export const OCCUPYING = { "已确认": "booked", "审核中": "review" };
export const AUTO_MAX_DAYS = 10; // 展期 ≤ 此天数：自助确认；> 此天数：转人工审核

/* ========== 凭证 ========== */
// 取 tenant_access_token（自建应用）。每次调用取一次；量大时可改用 KV 缓存（见 README）。
export async function getToken(env) {
  const r = await fetch(`${FEISHU}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`取 token 失败(${j.code}): ${j.msg}`);
  return j.tenant_access_token;
}

/* ========== 读 / 写记录 ========== */
// 读取整张表全部记录（自动翻页）。表体量不大（一年几十~上百条），全量读最省心、不易出错。
export async function listAllRecords(env, token) {
  const base = `${FEISHU}/bitable/v1/apps/${env.FEISHU_APP_TOKEN}/tables/${env.FEISHU_TABLE_ID}/records`;
  let items = [], pageToken = "";
  do {
    const url = `${base}?page_size=500${pageToken ? `&page_token=${pageToken}` : ""}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (j.code !== 0) throw new Error(`读取记录失败(${j.code}): ${j.msg}`);
    items = items.concat((j.data && j.data.items) || []);
    pageToken = j.data && j.data.has_more ? j.data.page_token : "";
  } while (pageToken);
  return items;
}

// 新增一条记录。fields 的键必须和飞书列名一字不差；日期=毫秒时间戳，单选=选项字符串，复选框=布尔。
export async function createRecord(env, token, fields) {
  const url = `${FEISHU}/bitable/v1/apps/${env.FEISHU_APP_TOKEN}/tables/${env.FEISHU_TABLE_ID}/records`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ fields }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`写入记录失败(${j.code}): ${j.msg}`);
  return j.data.record;
}

/* ========== 日期工具（统一按北京时间，避免月历差一天） ========== */
const TZ_MS = 8 * 3600 * 1000;
// "YYYY-MM-DD" → 飞书日期字段用的毫秒时间戳（该日北京时间零点）
export function dateStrToTs(s) {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - TZ_MS;
}
// 飞书毫秒时间戳 → 北京日历日 "YYYY-MM-DD"
export function tsToDateStr(ts) {
  const b = new Date(Number(ts) + TZ_MS);
  const p = (n) => String(n).padStart(2, "0");
  return `${b.getUTCFullYear()}-${p(b.getUTCMonth() + 1)}-${p(b.getUTCDate())}`;
}
// "YYYY-MM-DD" → 整数日序号（用于比较 / 判断区间重叠）
export function dayNum(s) {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/* ========== 统一 JSON 响应（带宽松 CORS，同源用不到，方便你单独调 API） ========== */
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
