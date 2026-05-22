const BILIBILI_BV_RE = /^BV[a-zA-Z0-9]+$/;

/** 追踪参数白名单——这些参数不影响视频唯一性，应移除 */
const TRACKING_PARAMS = new Set([
  "spm_id_from",
  "vd_source",
  "share_source",
  "share_medium",
  "bbid",
  "ts",
  "unique_k",
  "p",
  "vd_source_2",
]);

export function normalizeMediaUrl(raw: string): string {
  let s = raw.trim();

  // ① 纯 BV 号 → 拼完整 B站 URL
  if (BILIBILI_BV_RE.test(s)) {
    s = `https://www.bilibili.com/video/${s}`;
  }

  // ② 缺 scheme（没有任何 :// 的才补 https://）
  if (!s.includes("://")) {
    s = `https://${s}`;
  }

  // ③ 解析 URL，清掉追踪参数 + 去掉尾斜杠
  try {
    const u = new URL(s);
    const removals: string[] = [];
    for (const k of u.searchParams.keys()) {
      if (TRACKING_PARAMS.has(k)) removals.push(k);
    }
    for (const k of removals) u.searchParams.delete(k);
    // 保留 query（如有非追踪参数），去掉 fragment + 尾斜杠
    const clean = u.origin + u.pathname.replace(/\/+$/, "") + u.search;
    return clean;
  } catch {
    // URL 解析失败（极少见），返回补了 scheme 的版本
    return s.replace(/\/+$/, "");
  }
}
