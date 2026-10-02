import fs from 'fs';
import * as XLSX from 'xlsx';
import { logger } from 'ee-core/log';

/**
 * 导出服务：将统计结果与生产力估算导出为 JSON / Excel / HTML
 */
class ExportService {
  /**
   * 保存导出文件
   * @param {string} filePath 目标文件路径
   * @param {object} payload {format, result, estimation, sections}
   */
  save(filePath: string, payload: any): { ok: boolean; filePath: string; message: string } {
    const format = (payload.format || '').toLowerCase();
    try {
      if (!filePath) {
        return { ok: false, filePath: '', message: '未指定保存路径' };
      }
      if (format === 'json') {
        this.saveJson(filePath, payload);
      } else if (format === 'excel' || format === 'xlsx') {
        this.saveExcel(filePath, payload);
      } else if (format === 'html') {
        this.saveHtml(filePath, payload);
      } else {
        return { ok: false, filePath: '', message: `不支持的导出格式：${format}` };
      }
      return { ok: true, filePath, message: '导出成功' };
    } catch (e: any) {
      logger.error('[export] failed:', e && e.message ? e.message : e);
      return { ok: false, filePath: '', message: `导出失败：${e && e.message ? e.message : e}` };
    }
  }

  /** JSON 导出：完整数据（摘要 + 明细 + 估算） */
  saveJson(filePath: string, payload: any): void {
    const result = payload.result || {};
    const estimation = payload.estimation || null;
    const doc = {
      meta: {
        type: 'scc-code-counter-export',
        version: '1.0',
        app: 'SCC 代码统计',
        engine: result.engine === 'cloc' ? 'cloc' : 'scc',
        sccVersion: result.sccVersion || '',
        cmd: result.cmd || '',
        dirs: result.dirs || [],
        generatedAt: result.generatedAt || new Date().toISOString()
      },
      result,
      estimation
    };
    fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf-8');
  }

  /** Excel 导出：摘要 / 语言统计 / 目录汇总 / 文件明细 / 生产力估算 多工作表 */
  saveExcel(filePath: string, payload: any): void {
    const result = payload.result || {};
    const wb = XLSX.utils.book_new();
    const sections = payload.sections || {};
    const now = new Date().toLocaleString('zh-CN');

    // 摘要
    const s = result.summary || {};
    const summaryAoa: any[][] = [
      ['SCC 代码统计报告'],
      ['生成时间', now],
      ['引擎版本', result.sccVersion || '-'],
      ['统计引擎', result.source === 'import' ? ('导入数据（' + engineName(result.engine) + '）') : engineName(result.engine)],
      ['统计目录', (result.dirs || []).join(' ; ') || '-'],
      ['执行命令', result.cmd || '-'],
      [],
      ['指标', '数值'],
      ['文件总数', s.count ?? 0],
      ['总行数', s.lines ?? 0],
      ['代码行数', s.code ?? 0],
      ['注释行数', s.comment ?? 0],
      ['空白行数', s.blank ?? 0],
      ['圈复杂度', s.complexity ?? 0],
      ['代码量（字节）', s.bytes ?? 0]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryAoa), '摘要');

    // 语言统计
    if (sections.languages !== false) {
      const header = ['语言', '文件数', '代码行', '注释行', '空白行', '总行数', '圈复杂度', '字节', '代码占比(%)'];
      const totalCode = (result.summary && result.summary.code) || 1;
      const rows = (result.languages || []).map((l: any) => [
        l.name, l.count, l.code, l.comment, l.blank, l.lines, l.complexity, l.bytes,
        round2(l.code * 100 / totalCode)
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), '语言统计');
    }

    // 目录汇总
    if (sections.dirs !== false && (result.rootDirs || []).length) {
      const header = ['目录', '文件数', '代码行', '注释行', '空白行', '总行数', '圈复杂度', '字节'];
      const rows = (result.rootDirs || []).map((d: any) => [
        d.path, d.summary.count, d.summary.code, d.summary.comment, d.summary.blank,
        d.summary.lines, d.summary.complexity, d.summary.bytes
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), '目录汇总');
    }

    // 文件明细
    if (sections.files !== false && (result.files || []).length) {
      const header = ['文件名', '扩展名', '路径', '语言', '代码行', '注释行', '空白行', '总行数', '圈复杂度', '字节'];
      const rows = (result.files || []).map((f: any) => [
        f.filename, f.extension, f.location, f.language, f.code, f.comment, f.blank, f.lines, f.complexity, f.bytes
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), '文件明细');
    }

    // 生产力估算
    if (sections.estimation !== false && payload.estimation) {
      const est = payload.estimation;
      const params = est.params || {};
      const metrics = est.metrics || {};
      const aoa: any[][] = [
        ['生产力与成本估算'],
        [],
        ['参数', '数值', '单位'],
        ['编码生产率', fmt2(params.codingProductivity), '代码行/人日'],
        ['人月折算人日', fmt2(params.personDaysPerMonth), '人日/人月'],
        ['人力成本单价', fmt2(params.laborCostPerMonth), '元/人月'],
        ['团队人数', fmt2(params.teamSize), '人'],
        ['每日工时', fmt2(params.workHoursPerDay), '小时/人日'],
        ['测试用例密度', fmt2(params.testCaseDensity), '个/千行代码'],
        ['缺陷密度', fmt2(params.defectDensity), '个/千行代码'],
        ['设计编码占比', fmt2(params.designCodingRatio * 100), '%'],
        [],
        ['估算项', '数值', '单位'],
        ['有效代码行数', fmt0(metrics.codeLines), '行'],
        ['编码工作量', fmt2(metrics.codingEffortDays), '人日'],
        ['编码工时', fmt2(metrics.codingEffortHours), '小时'],
        ['总工作量', fmt2(metrics.totalEffortDays), '人日'],
        ['总工时', fmt2(metrics.totalEffortHours), '小时'],
        ['总工作量（人月）', fmt2(metrics.totalEffortMonths), '人月'],
        ['项目工期', fmt2(metrics.durationMonths), '月'],
        ['测试用例数', fmt2(metrics.testCases), '个'],
        ['预计缺陷数', fmt2(metrics.defects), '个'],
        ['预估人力成本', fmt2(metrics.totalCost), '元']
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), '生产力估算');
    }

    XLSX.writeFile(wb, filePath);
  }

  /** HTML 导出：自包含单文件报告（内联样式，离线可开，无外部请求） */
  saveHtml(filePath: string, payload: any): void {
    fs.writeFileSync(filePath, this.buildHtml(payload), 'utf-8');
  }

  buildHtml(payload: any): string {
    const result = payload.result || {};
    const sections = payload.sections || {};
    const s = result.summary || {};
    const est = payload.estimation || null;
    const totalCode = Math.max(1, s.code || 0);
    const now = new Date().toLocaleString('zh-CN');

    const esc = (v: any) => String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const summaryCards = [
      ['文件总数', fmt0(s.count), ''],
      ['代码行', fmt0(s.code), 'SLOC'],
      ['注释行', fmt0(s.comment), ''],
      ['空白行', fmt0(s.blank), ''],
      ['总行数', fmt0(s.lines), ''],
      ['圈复杂度', fmt0(s.complexity), ''],
      ['注释率', fmt2((s.comment || 0) * 100 / Math.max(1, (s.code || 0) + (s.comment || 0))), '%']
    ].map(([k, v, u]) => `
      <div class="card"><div class="card-k">${esc(k)}</div><div class="card-v">${esc(v)}<span class="card-u">${esc(u)}</span></div></div>`).join('');

    let languageSection = '';
    if (sections.languages !== false && (result.languages || []).length) {
      const maxCode = Math.max(1, (result.languages[0] && result.languages[0].code) || 1);
      const rows = (result.languages || []).map((l: any, i: number) => {
        const pct = l.code * 100 / totalCode;
        return `<tr>
          <td class="num">${i + 1}</td>
          <td><span class="dot" style="background:${chartColor(i)}"></span>${esc(l.name)}</td>
          <td class="num">${fmt0(l.count)}</td>
          <td class="num">${fmt0(l.code)}</td>
          <td class="num">${fmt0(l.comment)}</td>
          <td class="num">${fmt0(l.blank)}</td>
          <td class="num">${fmt0(l.complexity)}</td>
          <td class="num">${fmt2(pct)}%</td>
          <td class="bar-cell"><div class="bar" style="width:${fmt2(l.code * 100 / maxCode)}%;background:${chartColor(i)}"></div></td>
        </tr>`;
      }).join('');
      languageSection = `
      <h2>语言分布</h2>
      <table>
        <thead><tr><th>#</th><th>语言</th><th>文件数</th><th>代码行</th><th>注释行</th><th>空白行</th><th>圈复杂度</th><th>代码占比</th><th style="width:220px">分布</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    }

    let dirsSection = '';
    if (sections.dirs !== false && (result.rootDirs || []).length) {
      const rows = (result.rootDirs || []).map((d: any) => `<tr>
          <td>${esc(d.path)}</td>
          <td class="num">${fmt0(d.summary.count)}</td>
          <td class="num">${fmt0(d.summary.code)}</td>
          <td class="num">${fmt0(d.summary.comment)}</td>
          <td class="num">${fmt0(d.summary.blank)}</td>
          <td class="num">${fmt0(d.summary.lines)}</td>
          <td class="num">${fmt0(d.summary.complexity)}</td>
        </tr>`).join('');
      dirsSection = `
      <h2>目录汇总</h2>
      <table>
        <thead><tr><th>目录</th><th>文件数</th><th>代码行</th><th>注释行</th><th>空白行</th><th>总行数</th><th>圈复杂度</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    }

    let filesSection = '';
    if (sections.files !== false && (result.files || []).length) {
      const top = (result.files || []).slice(0, 100);
      const rows = top.map((f: any, i: number) => `<tr>
          <td class="num">${i + 1}</td>
          <td>${esc(f.filename)}</td>
          <td>${esc(f.extension)}</td>
          <td>${esc(f.language)}</td>
          <td class="num">${fmt0(f.code)}</td>
          <td class="num">${fmt0(f.comment)}</td>
          <td class="num">${fmt0(f.lines)}</td>
          <td class="num">${fmt0(f.complexity)}</td>
        </tr>`).join('');
      const note = (result.files || []).length > top.length
        ? `<p class="note">仅展示代码行 Top ${top.length}（共 ${fmt0(result.files.length)} 个文件）</p>` : '';
      filesSection = `
      <h2>文件排行</h2>
      ${note}
      <table>
        <thead><tr><th>#</th><th>文件名</th><th>扩展名</th><th>语言</th><th>代码行</th><th>注释行</th><th>总行数</th><th>圈复杂度</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    }

    let estSection = '';
    if (sections.estimation !== false && est) {
      const params = est.params || {};
      const m = est.metrics || {};
      const paramRows = [
        ['编码生产率', fmt2(params.codingProductivity), '代码行/人日'],
        ['人月折算人日', fmt2(params.personDaysPerMonth), '人日/人月'],
        ['人力成本单价', fmt2(params.laborCostPerMonth), '元/人月'],
        ['团队人数', fmt2(params.teamSize), '人'],
        ['每日工时', fmt2(params.workHoursPerDay), '小时/人日'],
        ['测试用例密度', fmt2(params.testCaseDensity), '个/千行代码'],
        ['缺陷密度', fmt2(params.defectDensity), '个/千行代码'],
        ['设计编码占比', fmt2(params.designCodingRatio * 100), '%']
      ].map(r => `<tr><td>${esc(r[0])}</td><td class="num">${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('');
      const metricRows = [
        ['有效代码行数', fmt0(m.codeLines), '行'],
        ['编码工作量', fmt2(m.codingEffortDays), '人日'],
        ['编码工时', fmt2(m.codingEffortHours), '小时'],
        ['总工作量', fmt2(m.totalEffortDays), '人日'],
        ['总工时', fmt2(m.totalEffortHours), '小时'],
        ['总工作量（人月）', fmt2(m.totalEffortMonths), '人月'],
        ['项目工期', fmt2(m.durationMonths), '月'],
        ['测试用例数', fmt2(m.testCases), '个'],
        ['预计缺陷数', fmt2(m.defects), '个'],
        ['预估人力成本', fmt2(m.totalCost), '元']
      ].map(r => `<tr><td>${esc(r[0])}</td><td class="num">${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('');
      estSection = `
      <h2>生产力与成本估算</h2>
      <div class="est-grid">
        <div><h3>估算参数</h3><table><thead><tr><th>参数</th><th>数值</th><th>单位</th></tr></thead><tbody>${paramRows}</tbody></table></div>
        <div><h3>估算结果</h3><table><thead><tr><th>估算项</th><th>数值</th><th>单位</th></tr></thead><tbody>${metricRows}</tbody></table></div>
      </div>
      <p class="note">估算模型基于参数化经验值（生产率 / 密度 / 占比），结果仅供决策参考。</p>`;
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SCC 代码统计报告</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #f4f6fa; color: #1f2937; padding: 32px 24px; }
  .wrap { max-width: 1080px; margin: 0 auto; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 18px; margin: 28px 0 12px; padding-left: 10px; border-left: 4px solid #2563eb; }
  h3 { font-size: 14px; margin: 12px 0 8px; color: #475569; }
  .meta { color: #64748b; font-size: 12px; line-height: 1.8; margin-bottom: 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 16px; }
  .card { background: #fff; border-radius: 10px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(15,23,42,.08); }
  .card-k { font-size: 12px; color: #64748b; }
  .card-v { font-size: 22px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .card-u { font-size: 11px; color: #94a3b8; margin-left: 4px; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(15,23,42,.08); font-size: 13px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eef2f7; }
  thead th { background: #f8fafc; color: #475569; font-weight: 600; white-space: nowrap; }
  tbody tr:hover { background: #f8fbff; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  th.num { text-align: right; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; vertical-align: middle; }
  .bar-cell { min-width: 180px; }
  .bar { height: 10px; border-radius: 5px; min-width: 2px; }
  .note { color: #94a3b8; font-size: 12px; margin: 8px 0; }
  .est-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media print { body { background: #fff; padding: 0; } .card { box-shadow: none; border: 1px solid #e2e8f0; } table { box-shadow: none; border: 1px solid #e2e8f0; } }
</style>
</head>
<body>
<div class="wrap">
  <h1>SCC 代码统计报告</h1>
  <div class="meta">
    生成时间：${esc(now)}<br>
    数据来源：${result.source === 'import' ? '导入的统计文件' : (engineName(result.engine) + ' 统计引擎' + (result.isBuiltin ? '（内置）' : '（自定义路径）'))}
    ${result.sccVersion ? ' · SCC 版本：' + esc(result.sccVersion) : ''}<br>
    统计目录：${esc((result.dirs || []).join(' ； ')) || '-'}<br>
    ${result.cmd ? '执行命令：<code>' + esc(result.cmd) + '</code>' : ''}
  </div>
  <div class="cards">${summaryCards}</div>
  ${languageSection}
  ${dirsSection}
  ${filesSection}
  ${estSection}
</div>
</body>
</html>`;
  }
}

function engineName(engine: any): string {
  return engine === 'cloc' ? 'CLOC' : 'SCC';
}

function fmt2(v: any): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function fmt0(v: any): string {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n)) : '0';
}

function round2(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function chartColor(i: number): string {
  const palette = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'];
  return palette[i % palette.length];
}

export const exportService = new ExportService();
