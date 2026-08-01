// lib/feishu.js
// 飞书多维表格共享模块（供 Vercel Functions import）。只用到 Web 标准 fetch / Response。

const FEISHU = "https://open.feishu.cn/open-apis";

/* ========== 常量（与飞书表 / 前端保持完全一致，改这里即改全局） ========== */
export const VENUES = ["展厅", "15号楼一楼走廊", "16号楼一楼走廊", "学院一楼花园中庭"];
// 只有这两种「状态」算占用；映射成前端月历颜色。已驳回 / 已取消 / 空 = 不占用（绿）。
export const OCCUPYING = { "已确认": "booked", "审核中": "review" };
export const AUTO_MAX_DAYS = 10; // 展期 ≤ 此天数：自助确认；> 此天数：转人工审核

/* ========== 凭证 ========== */
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
export function dateStrToTs(s) {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - TZ_MS;
}
export function tsToDateStr(ts) {
  const b = new Date(Number(ts) + TZ_MS);
  const p = (n) => String(n).padStart(2, "0");
  return `${b.getUTCFullYear()}-${p(b.getUTCMonth() + 1)}-${p(b.getUTCDate())}`;
}
export function dayNum(s) {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/* ========== 统一 JSON 响应（带宽松 CORS） ========== */
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
