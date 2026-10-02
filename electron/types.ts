/**
 * 公共类型定义
 */

/** 单语言统计 */
export interface LangStat {
  name: string;
  lines: number;
  code: number;
  comment: number;
  blank: number;
  complexity: number;
  bytes: number;
  count: number;
  uloc: number;
}

/** 单文件统计 */
export interface FileStat {
  filename: string;
  extension: string;
  location: string;
  language: string;
  lines: number;
  code: number;
  comment: number;
  blank: number;
  complexity: number;
  bytes: number;
  uloc: number;
  binary: boolean;
  minified: boolean;
  generated: boolean;
}

/** 汇总统计 */
export interface SummaryStat {
  lines: number;
  code: number;
  comment: number;
  blank: number;
  complexity: number;
  bytes: number;
  count: number;
  uloc: number;
}

/** 选中目录的统计（多目录时） */
export interface DirStat {
  path: string;
  label: string;
  summary: SummaryStat;
}

/** 统计引擎 */
export type StatsEngine = 'scc' | 'cloc';

/** SCC 运行选项 */
export interface RunOptions {
  dirs: string[];
  excludeDirs: string[];
  excludeExts: string[];
  includeExts: string[];
  byFile: boolean;
  noIgnore: boolean;
  noGitignore: boolean;
  noDuplicates: boolean;
}

/** 归一化统计结果（运行引擎 / 导入文件共用） */
export interface StatsResult {
  ok: boolean;
  /** 统计引擎：scc / cloc（导入数据沿用来源引擎或 scc） */
  engine: StatsEngine;
  source: 'scc' | 'import';
  cmd: string;
  /** 引擎可执行文件路径（scc 或 cloc） */
  sccPath: string;
  isBuiltin: boolean;
  /** 引擎版本 */
  sccVersion: string;
  durationMs: number;
  dirs: string[];
  summary: SummaryStat;
  languages: LangStat[];
  files: FileStat[];
  rootDirs: DirStat[];
  warnings: string;
  message?: string;
  generatedAt: string;
}

/** SCC 校验结果 */
export interface SccCheckResult {
  ok: boolean;
  resolvedPath: string;
  isBuiltin: boolean;
  version: string;
  message: string;
}

/** 生产力估算参数 */
export interface EstimationParams {
  /** 编码生产率：代码行/人日 */
  codingProductivity: number;
  /** 人月折算人日数 */
  personDaysPerMonth: number;
  /** 人力成本：元/人月 */
  laborCostPerMonth: number;
  /** 团队人数 */
  teamSize: number;
  /** 每日工作时长（小时） */
  workHoursPerDay: number;
  /** 测试用例密度：个/千行代码 */
  testCaseDensity: number;
  /** 缺陷密度：个/千行代码 */
  defectDensity: number;
  /** 设计编码占比：设计与编码工作占总工作量比例（0-1） */
  designCodingRatio: number;
}

/** 常用目录 */
export interface CommonDir {
  path: string;
  label: string;
  note: string;
  lastUsedAt: string;
}

/** 持久化配置 */
export interface AppConfig {
  /** 默认统计引擎 */
  engine: StatsEngine;
  scc: {
    useBuiltin: boolean;
    customPath: string;
  };
  cloc: {
    useBuiltin: boolean;
    customPath: string;
  };
  commonDirs: CommonDir[];
  defaultExcludeDirs: string[];
  defaultExcludeExts: string[];
  options: {
    byFile: boolean;
    noIgnore: boolean;
    noGitignore: boolean;
    noDuplicates: boolean;
  };
  estimation: EstimationParams;
  lastResult: StatsResult | null;
}

export const DEFAULT_EXCLUDE_DIRS = [
  'node_modules', 'dist', 'build', 'out', '.git', '.hg', '.svn',
  '.idea', '.vscode', 'vendor', 'target', '__pycache__', '.next',
  '.nuxt', 'coverage', 'venv', '.venv', 'bin', 'obj'
];

export const DEFAULT_ESTIMATION: EstimationParams = {
  codingProductivity: 300,
  personDaysPerMonth: 21.75,
  laborCostPerMonth: 20000,
  teamSize: 5,
  workHoursPerDay: 8,
  testCaseDensity: 10,
  defectDensity: 5,
  designCodingRatio: 0.4
};

export function defaultConfig(): AppConfig {
  return {
    engine: 'scc',
    scc: {
      useBuiltin: true,
      customPath: ''
    },
    cloc: {
      useBuiltin: true,
      customPath: ''
    },
    commonDirs: [],
    defaultExcludeDirs: [...DEFAULT_EXCLUDE_DIRS],
    defaultExcludeExts: [],
    options: {
      byFile: true,
      noIgnore: false,
      noGitignore: false,
      noDuplicates: false
    },
    estimation: { ...DEFAULT_ESTIMATION },
    lastResult: null
  };
}
