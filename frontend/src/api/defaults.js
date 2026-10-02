/**
 * 与主进程 electron/types.ts 保持一致的默认配置
 */

export const DEFAULT_EXCLUDE_DIRS = [
  'node_modules', 'dist', 'build', 'out', '.git', '.hg', '.svn',
  '.idea', '.vscode', 'vendor', 'target', '__pycache__', '.next',
  '.nuxt', 'coverage', 'venv', '.venv', 'bin', 'obj'
];

export const DEFAULT_ESTIMATION = {
  codingProductivity: 300,
  personDaysPerMonth: 21.75,
  laborCostPerMonth: 20000,
  teamSize: 5,
  workHoursPerDay: 8,
  testCaseDensity: 10,
  defectDensity: 5,
  designCodingRatio: 0.4
};

export function defaultLocalConfig() {
  return {
    engine: 'scc',
    scc: { useBuiltin: true, customPath: '' },
    cloc: { useBuiltin: true, customPath: '' },
    commonDirs: [],
    defaultExcludeDirs: [...DEFAULT_EXCLUDE_DIRS],
    defaultExcludeExts: [],
    options: { byFile: true, noIgnore: false, noGitignore: false, noDuplicates: false },
    estimation: { ...DEFAULT_ESTIMATION },
    lastResult: null
  };
}
