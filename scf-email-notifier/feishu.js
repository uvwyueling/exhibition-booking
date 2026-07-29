// 飞书多维表格：取 token / 全量读表 / 更新单条记录。
// Node 18+ 自带 fetch，无需第三方 http 库。

const FEISHU = "https://open.feishu.cn/open-apis";

async function getToken(env) {
  const r = await fetch(`${FEISHU}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`取 token 失败(${j.code}): ${j.msg}`);
  return j.tenant_access_token;
}

async function listAllRecords(env, token) {
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

async function updateRecord(env, token, recordId, fields) {
  const url = `${FEISHU}/bitable/v1/apps/${env.FEISHU_APP_TOKEN}/tables/${env.FEISHU_TABLE_ID}/records/${recordId}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ fields }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`更新记录失败(${j.code}): ${j.msg}`);
  return j.data.record;
}

// 北京时间毫秒时间戳 → "YYYY-MM-DD"
const TZ_MS = 8 * 3600 * 1000;
function tsToDateStr(ts) {
  if (ts == null || ts === "") return "";
  const b = new Date(Number(ts) + TZ_MS);
  const p = (n) => String(n).padStart(2, "0");
  return `${b.getUTCFullYear()}-${p(b.getUTCMonth() + 1)}-${p(b.getUTCDate())}`;
}

module.exports = { getToken, listAllRecords, updateRecord, tsToDateStr };
