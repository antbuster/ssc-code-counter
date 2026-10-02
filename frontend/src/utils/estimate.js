/**
 * 生产力与成本估算模型
 *
 * 参数：
 *  codingProductivity   编码生产率（代码行/人日）
 *  personDaysPerMonth   人月折算人日数
 *  laborCostPerMonth    人力成本单价（元/人月）
 *  teamSize             团队人数
 *  workHoursPerDay      每日工时（小时）
 *  testCaseDensity      测试用例密度（个/千行代码）
 *  defectDensity        缺陷密度（个/千行代码）
 *  designCodingRatio    设计编码占比（设计与编码工作量占总工作量比例，0-1）
 */
export function computeEstimation(params, codeLines) {
  const p = { ...params };
  const loc = Number(codeLines) || 0;

  const codingEffortDays = p.codingProductivity > 0 ? loc / p.codingProductivity : 0;
  const codingEffortHours = codingEffortDays * p.workHoursPerDay;
  // 设计编码占比：编码工作量 / 占比 = 全周期总工作量（含需求、设计、测试、项目管理等）
  const ratio = p.designCodingRatio > 0 ? p.designCodingRatio : 0.4;
  const totalEffortDays = codingEffortDays / ratio;
  const totalEffortHours = totalEffortDays * p.workHoursPerDay;
  const personDaysPerMonth = p.personDaysPerMonth > 0 ? p.personDaysPerMonth : 21.75;
  const totalEffortMonths = totalEffortDays / personDaysPerMonth;
  const teamSize = p.teamSize > 0 ? p.teamSize : 1;
  const durationDays = totalEffortDays / teamSize;
  const durationMonths = durationDays / personDaysPerMonth;
  const testCases = (loc / 1000) * p.testCaseDensity;
  const defects = (loc / 1000) * p.defectDensity;
  const totalCost = totalEffortMonths * p.laborCostPerMonth;

  return {
    params: p,
    metrics: {
      codeLines: loc,
      codingEffortDays,
      codingEffortHours,
      totalEffortDays,
      totalEffortHours,
      totalEffortMonths,
      durationDays,
      durationMonths,
      testCases,
      defects,
      totalCost
    }
  };
}
