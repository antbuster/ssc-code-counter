/**
 * 浏览器演示模式 Mock：
 * 脱离 Electron 直接用浏览器访问前端时（pnpm dev 后打开 http://localhost:8080），
 * 以演示数据驱动完整界面，便于预览与调试；应用内运行时不会走此文件。
 */
import { DEFAULT_EXCLUDE_DIRS, DEFAULT_ESTIMATION } from './defaults';

const LS_KEY = 'scc-demo-config-v1';

function delay(ms = 200) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------- 伪随机（固定种子，保证演示数据稳定） ----------
let seed = 20260202;
function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
function randInt(min, max) {
  return Math.floor(min + rand() * (max - min + 1));
}

const LANGS = [
  { name: 'JavaScript', ext: 'js', weight: 26 },
  { name: 'TypeScript', ext: 'ts', weight: 18 },
  { name: 'Vue', ext: 'vue', weight: 14 },
  { name: 'Go', ext: 'go', weight: 12 },
  { name: 'Python', ext: 'py', weight: 8 },
  { name: 'Java', ext: 'java', weight: 6 },
  { name: 'SCSS', ext: 'scss', weight: 4 },
  { name: 'HTML', ext: 'html', weight: 3 },
  { name: 'JSON', ext: 'json', weight: 4 },
  { name: 'Markdown', ext: 'md', weight: 3 },
  { name: 'YAML', ext: 'yaml', weight: 1 },
  { name: 'Shell', ext: 'sh', weight: 1 }
];

const DIRS = [
  'D:/workspace/demo-project/src/components',
  'D:/workspace/demo-project/src/views',
  'D:/workspace/demo-project/src/api',
  'D:/workspace/demo-project/src/utils',
  'D:/workspace/demo-project/server/internal',
  'D:/workspace/demo-project/server/cmd',
  'D:/workspace/demo-project/scripts',
  'D:/workspace/demo-project/docs'
];

const BASENAMES = ['index', 'main', 'app', 'service', 'controller', 'handler', 'model', 'store', 'router', 'config', 'helper', 'chart', 'table', 'form', 'panel', 'editor', 'list', 'detail', 'api', 'types'];

function buildMockResult(engine = 'scc') {
  seed = 20260202;
  const isCloc = engine === 'cloc';
  const files = [];
  LANGS.forEach((lang, li) => {
    const count = Math.max(2, Math.round(lang.weight * 3.2));
    for (let i = 0; i < count; i++) {
      const dir = DIRS[randInt(0, DIRS.length - 1)];
      const base = BASENAMES[randInt(0, BASENAMES.length - 1)];
      const suffix = i > 0 ? `-${i}` : '';
      const filename = `${base}${suffix}.${lang.ext}`;
      const code = randInt(20, 900);
      const comment = Math.round(code * (0.05 + rand() * 0.3));
      const blank = Math.round(code * (0.1 + rand() * 0.2));
      const complexity = isCloc ? 0 : Math.round(code * (0.02 + rand() * 0.12));
      files.push({
        filename,
        extension: lang.ext,
        location: `${dir}/${filename}`,
        language: lang.name,
        lines: code + comment + blank,
        code,
        comment,
        blank,
        complexity,
        bytes: isCloc ? 0 : code * randInt(18, 42),
        uloc: isCloc ? 0 : Math.round(code * 0.8),
        binary: false,
        minified: false,
        generated: false
      });
    }
  });
  files.sort((a, b) => b.code - a.code);

  const byLang = new Map();
  files.forEach(f => {
    const cur = byLang.get(f.language) || { name: f.language, lines: 0, code: 0, comment: 0, blank: 0, complexity: 0, bytes: 0, count: 0, uloc: 0 };
    cur.lines += f.lines; cur.code += f.code; cur.comment += f.comment;
    cur.blank += f.blank; cur.complexity += f.complexity; cur.bytes += f.bytes;
    cur.count += 1; cur.uloc += f.uloc;
    byLang.set(f.language, cur);
  });
  const languages = [...byLang.values()].sort((a, b) => b.code - a.code);
  const summary = languages.reduce((a, l) => ({
    lines: a.lines + l.lines, code: a.code + l.code, comment: a.comment + l.comment,
    blank: a.blank + l.blank, complexity: a.complexity + l.complexity, bytes: a.bytes + l.bytes,
    count: a.count + l.count, uloc: a.uloc + l.uloc
  }), { lines: 0, code: 0, comment: 0, blank: 0, complexity: 0, bytes: 0, count: 0, uloc: 0 });

  const rootDirs = DIRS.slice(0, 5).map(p => {
    const sub = files.filter(f => f.location.startsWith(p));
    const s = sub.reduce((a, f) => ({
      lines: a.lines + f.lines, code: a.code + f.code, comment: a.comment + f.comment,
      blank: a.blank + f.blank, complexity: a.complexity + f.complexity, bytes: a.bytes + f.bytes,
      count: a.count + 1, uloc: a.uloc + f.uloc
    }), { lines: 0, code: 0, comment: 0, blank: 0, complexity: 0, bytes: 0, count: 0, uloc: 0 });
    return { path: p, label: p.split('/').pop(), summary: s };
  }).filter(d => d.summary.count > 0);

  return {
    ok: true,
    engine,
    source: 'scc',
    cmd: isCloc
      ? 'cloc.exe --csv --by-file --exclude-dir=.git,.hg,.svn,node_modules,dist,... D:/workspace/demo-project（演示数据）'
      : 'D:/apps/scc/scc.exe --by-file --format json --exclude-dir .git,.hg,.svn,node_modules,dist,... D:/workspace/demo-project',
    sccPath: isCloc ? 'D:/apps/cloc/cloc.exe（演示数据）' : 'D:/apps/scc/scc.exe（演示数据）',
    isBuiltin: true,
    sccVersion: '2.10',
    durationMs: 1830,
    dirs: ['D:/workspace/demo-project'],
    summary,
    languages,
    files,
    rootDirs,
    warnings: '',
    generatedAt: new Date().toISOString()
  };
}

function demoConfig() {
  let cfg = null;
  try {
    cfg = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
  } catch (e) { /* ignore */ }
  if (!cfg) {
    cfg = {
      engine: 'scc',
      scc: { useBuiltin: true, customPath: '' },
      cloc: { useBuiltin: true, customPath: '' },
      commonDirs: [
        { path: 'D:/workspace/demo-project', label: '演示项目', note: '浏览器演示数据', lastUsedAt: new Date().toISOString() },
        { path: 'D:/workspace/scc-front', label: 'SCC 桌面应用', note: '', lastUsedAt: new Date(Date.now() - 86400000).toISOString() }
      ],
      defaultExcludeDirs: [...DEFAULT_EXCLUDE_DIRS],
      defaultExcludeExts: [],
      options: { byFile: true, noIgnore: false, noGitignore: false, noDuplicates: false },
      estimation: { ...DEFAULT_ESTIMATION },
      lastResult: null
    };
  }
  return cfg;
}

let cachedResult = null;

export async function mockInvoke(route, args = {}) {
  await delay(route === 'runStats' ? 600 : 120);
  switch (route) {
    case 'controller/common/ping':
      return { ok: true, message: 'pong', appVersion: '1.0.0-demo', electron: '-', platform: 'browser', arch: '-', hasBuiltinScc: true };
    case 'controller/common/selectDirectory': {
      const base = 'D:/workspace/demo-project';
      return {
        ok: true,
        canceled: false,
        paths: args.multi
          ? [base, base + '/server', base + '/scripts']
          : [base + '/module-' + randInt(1, 9)]
      };
    }
    case 'controller/common/selectFile':
      return { ok: true, canceled: false, path: args.filters && args.filters[0] && args.filters[0].extensions.includes('exe') ? 'D:/apps/scc/scc.exe' : 'D:/downloads/scc-stats.json' };
    case 'controller/common/selectSaveFile':
      return { ok: true, canceled: false, path: 'D:/downloads/' + (args.defaultName || 'export.dat') };
    case 'controller/common/openPath':
    case 'controller/common/revealItem':
      return { ok: true };
    case 'controller/codestats/run':
      cachedResult = buildMockResult(args.engine === 'cloc' ? 'cloc' : 'scc');
      return JSON.parse(JSON.stringify(cachedResult));
    case 'controller/codestats/cancel':
      return { ok: true, canceled: false };
    case 'controller/codestats/checkScc':
      return {
        ok: true,
        resolvedPath: args.engine === 'cloc' ? 'D:/apps/cloc/cloc.exe（演示）' : 'D:/apps/scc/scc.exe（演示）',
        isBuiltin: args.useBuiltin !== false,
        version: args.engine === 'cloc' ? '2.10' : '4.1.0',
        message: '校验通过（演示数据）'
      };
    case 'controller/codestats/resolveScc':
      return {
        ok: true,
        path: args.engine === 'cloc' ? 'D:/apps/cloc/cloc.exe（演示）' : 'D:/apps/scc/scc.exe（演示）',
        runner: 'exe',
        isBuiltin: true,
        error: '',
        engine: args.engine === 'cloc' ? 'cloc' : 'scc',
        hasBuiltin: true
      };
    case 'controller/codestats/importSupport':
      return { ok: true, extensions: ['json', 'csv'] };
    case 'controller/codestats/parseImportFile':
      return { ok: false, message: '演示模式下不支持导入，请在桌面应用内使用' };
    case 'controller/storage/get':
      return { ok: true, config: { ...demoConfig(), lastResult: cachedResult ? JSON.parse(JSON.stringify(cachedResult)) : demoConfig().lastResult } };
    case 'controller/storage/save': {
      const patch = args.patch || args;
      const cur = demoConfig();
      const next = { ...cur, ...patch };
      try { localStorage.setItem(LS_KEY, JSON.stringify({ ...next, lastResult: null })); } catch (e) { /* ignore */ }
      return { ok: true, config: { ...next, lastResult: cachedResult ? JSON.parse(JSON.stringify(cachedResult)) : next.lastResult } };
    }
    case 'controller/exporter/save':
      return { ok: true, filePath: args.filePath || 'D:/downloads/export.dat', message: '导出成功（演示模式，未实际写文件）' };
    default:
      return { ok: false, message: `演示模式未实现：${route}` };
  }
}
