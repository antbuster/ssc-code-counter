/**
 * 数值格式化工具
 */

/** 整数（千分位） */
export function fmt0(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('zh-CN');
}

/** 保留2位小数 */
export function fmt2(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

/** 千字节可读格式 */
export function fmtBytes(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
  return `${i === 0 ? Math.round(x) : x.toFixed(1)} ${units[i]}`;
}

/** 百分比（2位小数） */
export function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00%';
  return `${n.toFixed(2)}%`;
}

/** 时间戳 → 本地时间字符串 */
export function fmtTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString('zh-CN', { hour12: false });
}

/** 文件大小格式化用于图表 */
export function shortName(p, max = 42) {
  const s = String(p || '');
  if (s.length <= max) return s;
  return '...' + s.slice(s.length - max);
}
