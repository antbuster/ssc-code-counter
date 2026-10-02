/**
 * 主进程自检脚本：electron . --env=prod --selftest
 * 依次验证 SCC 校验 → SCC 统计 → 存储读写 → 导入解析 → 三格式导出，输出到日志后退出
 */
import { app } from 'electron';
import { logger } from 'ee-core/log';
import path from 'path';
import fs from 'fs';
import { sccService } from './service/scc';
import { clocService } from './service/cloc';
import { storageService } from './service/storage';
import { importService } from './service/import';
import { exportService } from './service/export';
import CodestatsController from './controller/codestats';

export async function runSelfTest(): Promise<void> {
  const results = [];
  const log = (name: string, ok: boolean, detail = '') => {
    results.push({ name, ok });
    logger.info(`[selftest] ${ok ? 'PASS' : 'FAIL'} - ${name} ${detail}`);
  };

  try {
    const sampleDir = path.join(app.getAppPath(), 'build', 'selftest-sample');
    const baseOpts = {
      dirs: [sampleDir],
      excludeDirs: [],
      excludeExts: [],
      includeExts: [],
      byFile: true,
      noIgnore: false,
      noGitignore: false,
      noDuplicates: false
    };

    // 1. SCC 校验 + 运行
    const check = await sccService.check('', true);
    log('scc.check', check.ok, `version=${check.version} path=${check.resolvedPath}`);
    const run = await sccService.run({ ...baseOpts }, '', true);
    log('scc.run', run.ok && run.engine === 'scc' && run.files.length === 3, run.ok
      ? `engine=${run.engine} langs=${run.languages.length} files=${run.files.length} code=${run.summary.code} duration=${run.durationMs}ms`
      : `message=${run.message}`);

    // 2. CLOC 校验 + 运行（Windows 内置 exe 会漏计非 ASCII 文件名，期望文件数按平台区分）
    const clocCheck = await clocService.check('', true);
    log('cloc.check', clocCheck.ok, `version=${clocCheck.version} path=${clocCheck.resolvedPath}`);
    const clocRun = await clocService.run({ ...baseOpts }, '', true);
    const expectFiles = process.platform === 'win32' ? 2 : 3;
    log('cloc.run', clocRun.ok && clocRun.engine === 'cloc' && clocRun.files.length === expectFiles && clocRun.languages.every(l => l.complexity === 0), clocRun.ok
      ? `engine=${clocRun.engine} langs=${clocRun.languages.length} files=${clocRun.files.length} code=${clocRun.summary.code} duration=${clocRun.durationMs}ms`
      : `message=${clocRun.message}`);

    // 3. CLOC 参数拼装（include-ext / exclude-ext）
    const clocArgs = clocService.buildArgs(
      { ...baseOpts, includeExts: ['go'], excludeExts: ['exe'] },
      ['D:/a', 'D:/b']
    );
    log('cloc.args', clocArgs.includes('--include-ext=go') && clocArgs.includes('--exclude-ext=exe') && clocArgs.includes('--csv'), clocArgs.join(' '));

    // 4. 存储读写（含引擎切换字段）
    let storeOk = true;
    let storeDetail = '';
    try {
      const cfg = storageService.get();
      cfg.estimation.teamSize = 7;
      storageService.save({ estimation: cfg.estimation, engine: 'cloc' });
      const reloaded = storageService.get();
      storeOk = reloaded.estimation.teamSize === 7 && reloaded.engine === 'cloc';
      storeDetail = `teamSize=${reloaded.estimation.teamSize} engine=${reloaded.engine}`;
      // 还原
      reloaded.estimation.teamSize = 5;
      storageService.save({ estimation: reloaded.estimation, engine: 'scc' });
    } catch (e: any) {
      storeOk = false;
      storeDetail = e && e.message ? e.message : String(e);
    }
    log('storage.roundtrip', storeOk, storeDetail);

    // 5. 导入解析（CSV：模拟 scc --format csv 导出文件）
    const outDir = path.join(app.getPath('temp'), 'scc-selftest');
    fs.mkdirSync(outDir, { recursive: true });
    const csvFile = path.join(outDir, 'scc-export.csv');
    fs.writeFileSync(csvFile, 'Language,Lines,Code,Comments,Blanks,Complexity,Bytes,Files,ULOC\nGo,3,2,1,0,0,39,1,0\nPython,3,2,1,0,0,30,1,0\n', 'utf-8');
    const impCsv = importService.parse(csvFile);
    log('import.csv', impCsv.ok && impCsv.languages.length === 2, impCsv.ok ? `langs=${impCsv.languages.length}` : impCsv.message);

    // 6. 导出 JSON / Excel / HTML（使用 CLOC 结果，验证引擎字段透传）
    const payload = {
      format: 'json',
      result: clocRun,
      estimation: null,
      sections: { languages: true, dirs: true, files: true, estimation: false }
    };
    const rJson = exportService.save(path.join(outDir, 'report.json'), payload);
    log('export.json', rJson.ok, rJson.filePath);
    const rExcel = exportService.save(path.join(outDir, 'report.xlsx'), { ...payload, format: 'excel' });
    log('export.excel', rExcel.ok, rExcel.filePath);
    const rHtml = exportService.save(path.join(outDir, 'report.html'), { ...payload, format: 'html' });
    log('export.html', rHtml.ok, rHtml.filePath);

    // 7. 重新导入本应用导出的 JSON（应保留 cloc 引擎标记）
    const reImp = importService.parse(path.join(outDir, 'report.json'));
    log('import.exported', reImp.ok && reImp.engine === 'cloc', reImp.ok ? `engine=${reImp.engine} langs=${reImp.languages.length}` : reImp.message);

    // 8. Controller 层引擎分发（IPC 实际入口）
    const ctrl = new CodestatsController();
    const ctrlRun = await ctrl.run({ engine: 'cloc', ...baseOpts });
    const ctrlCheck = await ctrl.checkScc({ engine: 'cloc' });
    const ctrlResolve = await ctrl.resolveScc({ engine: 'scc' });
    log('controller.engine-dispatch',
      ctrlRun.ok && ctrlRun.engine === 'cloc' && ctrlCheck.ok && ctrlResolve.engine === 'scc',
      `run.engine=${ctrlRun.engine} check.version=${ctrlCheck.version} resolve.engine=${ctrlResolve.engine}`);
  } catch (e: any) {
    logger.error('[selftest] unexpected:', e && e.message ? e.message : e);
    log('unexpected', false, e && e.message ? e.message : String(e));
  }

  const failed = results.filter(r => !r.ok);
  logger.info(`[selftest] done: ${results.length - failed.length}/${results.length} passed${failed.length ? ' -> ' + failed.map(f => f.name).join(', ') : ''}`);
  setTimeout(() => app.exit(0), 300);
}
