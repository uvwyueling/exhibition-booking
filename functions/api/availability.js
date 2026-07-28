// functions/api/availability.js  →  路由 GET /api/availability?venue=展厅
// 读取某场地的占用档期，返回给前端月历上色。

import { getToken, listAllRecords, tsToDateStr, json, VENUES, OCCUPYING } from "./_feishu.js";

export async function onRequestGet({ request, env }) {
  try {
    const venue = new URL(request.url).searchParams.get("venue");
    if (!venue || !VENUES.includes(venue)) {
      return json({ ok: false, error: "无效的场地" }, 400);
    }

    const token = await getToken(env);
    const records = await listAllRecords(env, token);

    const ranges = [];
    for (const rec of records) {
      const f = rec.fields || {};
      if (f["场地"] !== venue) continue;          // 只看这个场地
      const color = OCCUPYING[f["状态"]];          // 已确认→booked / 审核中→review
      if (!color) continue;                        // 其它状态不占用
      const s = f["布展日期"], e = f["撤展日期"];
      if (!s || !e) continue;
      ranges.push({ start: tsToDateStr(s), end: tsToDateStr(e), status: color });
    }

    return json({ ok: true, venue, ranges });
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) }, 500);
  }
}

// 预检请求（跨源调试时用；同源可忽略）
export function onRequestOptions() {
  return json({ ok: true });
}
