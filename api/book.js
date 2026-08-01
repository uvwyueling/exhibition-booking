// api/book.js  →  Vercel Function: POST /api/book
// 校验 → 写入前查冲突 → 按天数分级 → 写入飞书。
// 请求体：{ venue, start:"YYYY-MM-DD", end:"YYYY-MM-DD", exhibitionName, className, contactName, phone, email, teacher }

import {
  getToken, listAllRecords, createRecord,
  tsToDateStr, dateStrToTs, dayNum, json,
  VENUES, OCCUPYING, AUTO_MAX_DAYS,
} from "../lib/feishu.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  try {
    const b = await request.json().catch(() => null);
    if (!b) return json({ ok: false, error: "请求体解析失败" }, 400);

    const { venue, start, end,
            exhibitionName, className, contactName, phone, email, teacher } = b;

    // ---- 基本校验（前端已校一遍，这里再兜一层） ----
    if (!VENUES.includes(venue))            return json({ ok: false, error: "无效的场地" }, 400);
    if (!ISO.test(start) || !ISO.test(end)) return json({ ok: false, error: "日期格式不对" }, 400);
    if (dayNum(end) < dayNum(start))        return json({ ok: false, error: "结束日不能早于开始日" }, 400);
    for (const [label, v] of [
      ["展览名称", exhibitionName], ["班级", className], ["联系人姓名", contactName],
      ["电话", phone], ["邮箱", email], ["指导教师", teacher],
    ]) {
      if (!v || !String(v).trim()) return json({ ok: false, error: `请填写${label}` }, 400);
    }
    if (!EMAIL.test(String(email).trim())) return json({ ok: false, error: "邮箱格式不对" }, 400);

    const reqS = dayNum(start), reqE = dayNum(end);
    const days = reqE - reqS + 1;

    const token = await getToken(process.env);

    // ---- 写入前查冲突：重新拉一次该场地占用，逐条判断区间重叠 ----
    const records = await listAllRecords(process.env, token);
    for (const rec of records) {
      const f = rec.fields || {};
      if (f["场地"] !== venue) continue;
      const color = OCCUPYING[f["状态"]];
      if (!color) continue;
      const s = f["布展日期"], e = f["撤展日期"];
      if (!s || !e) continue;
      const rS = dayNum(tsToDateStr(s)), rE = dayNum(tsToDateStr(e));
      if (reqS <= rE && reqE >= rS) {              // 区间重叠
        return json({
          ok: false,
          conflict: color,                          // "booked" | "review"
          error: color === "review" ? "该档期正在审核中" : "该时段已被预约",
        }, 409);
      }
    }

    // ---- 分级：≤10 天自助确认；>10 天转人工审核 ----
    const status = days <= AUTO_MAX_DAYS ? "已确认" : "审核中";

    // ---- 写入（字段名必须与飞书列名完全一致） ----
    const record = await createRecord(process.env, token, {
      "展览名称": String(exhibitionName).trim(),
      "场地": venue,
      "布展日期": dateStrToTs(start),   // 毫秒时间戳
      "撤展日期": dateStrToTs(end),
      "展出天数": days,                 // 数字
      "状态": status,                   // 单选
      "班级": String(className).trim(),
      "联系人姓名": String(contactName).trim(),
      "电话": String(phone).trim(),
      "邮箱": String(email).trim(),
      "指导教师": String(teacher).trim(),
      "来源": "师生自助",               // 单选
      "前三天邮件已发": false,           // 复选框
      "审批邮件已发": false,
    });

    return json({ ok: true, status, recordId: record.record_id });
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) }, 500);
  }
}

export function OPTIONS() {
  return json({ ok: true });
}
