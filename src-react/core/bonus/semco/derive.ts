// core/bonus/semco/derive.ts — 삼성전기 계산 입력 파생·상수 (React-free).
//
// 2026-09-07 S5b: core/semco-derive.js를 옮기고 경계에 타입을 붙였다. 파생값 무변경 — calc-bridge 골든([4b])이 같은 값을 낸다.
// 옛 경로 core/semco-derive.js는 이 파일을 re-export하는 shim(gen-salary-pages·check-calc-drift가 그대로 돈다).
// 연도 키·근무개월·연도별 연봉은 하이닉스와 같은 규칙이라 hynix/derive.ts의 함수를 이름만 바꿔 내보낸다 — 두 벌을 두지 않는다.
//
// 이 파일이 아는 것: 연도별 영업이익 키와 기본값, 그리고 calc-bridge.calcSemco를 **첫해 조건으로 정규화해** 부르는 calcSemcoResult.
// 이 파일이 모르는 것: 화면. 재배열·합산은 result-view.ts가.
import { calcSemco } from '../../calc-bridge.js';
import { HYNIX_YEARS, getActiveHynixYears, getHynixOp, getHynixWorkMonths, getHynixYearSalary, hynixOpKey } from '../hynix/derive.ts';
import type { SemcoInputs, SemcoResult } from './types.ts';

export type { SemcoInputs, SemcoOpKey, SemcoResult, SemcoGrade } from './types.ts';

export const SEMCO_YEARS: number[] = HYNIX_YEARS;

/** 연도별 영업이익 기본 가정(조) — 2026 1.64 … 장기 가정 */
export const SEMCO_OP_DEFAULTS: Record<number, number> = {
  2026: 1.64, 2027: 1.85, 2028: 2.05, 2029: 2.15, 2030: 2.25,
  2031: 2.35, 2032: 2.45, 2033: 2.55, 2034: 2.65, 2035: 2.75,
};

export const SEMCO_DEFAULTS: SemcoInputs = {
  grade: 'cl4-low',
  salary: 5600,
  avgSalary: 7000,
  headcount: 12000,
  months: 12,
  h1: 75,
  h2: 75,
  taxRate: null,
  accumGrowth: 5,
  accumYears: 5,   // 기본 5개년(사용자 2026-09-10)
  accumSalaryOverrides: {},
  workMonthsByYear: {},
  ...Object.fromEntries(SEMCO_YEARS.map(year => [hynixOpKey(year), SEMCO_OP_DEFAULTS[year] ?? SEMCO_OP_DEFAULTS[2028]])),
  opTril: SEMCO_OP_DEFAULTS[2026],
};

export {
  getActiveHynixYears as getActiveSemcoYears,
  getHynixWorkMonths as getSemcoWorkMonths,
  getHynixOp as getSemcoOp,
  getHynixYearSalary as getSemcoYearSalary,
  hynixOpKey as semcoOpKey,
};

/**
 * 한 해 결과 — calcSemco를 **첫해 조건으로 정규화해** 부른다(하이닉스 calcHynixResult와 같은 이유).
 * 연도별 표(accumSalaryOverrides[첫해] · workMonthsByYear[첫해])가 salary·months와 어긋나지 않게 해서
 * "히어로 = 3개년 표 첫 행"이 구성으로 성립한다.
 */
export function calcSemcoResult(inputs: SemcoInputs): SemcoResult {
  const first = getActiveHynixYears(inputs)[0] ?? SEMCO_YEARS[0];
  return calcSemco({
    ...inputs,
    salary: getHynixYearSalary(inputs, first),
    months: getHynixWorkMonths(inputs, first),
    opTril: getHynixOp(inputs, first),
  } as unknown as Parameters<typeof calcSemco>[0]) as SemcoResult;
}
