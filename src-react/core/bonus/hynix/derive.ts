// core/bonus/hynix/derive.ts — 하이닉스 계산 입력 파생·상수 (React-free).
//
// 2026-09-07 S5a: core/hynix-derive.js를 그대로 옮기고 경계에 타입만 붙였다. 파생값은 한 줄도 바꾸지 않았다 —
// 골든(tests/calc-bridge.test.mjs [4])이 같은 값을 내야 한다. 옛 경로 core/hynix-derive.js는 이 파일을
// re-export하는 shim으로 남아 cashflow.js·semco-derive.js·gen-salary-pages·check-calc-drift가 그대로 돈다.
//
// 이 파일이 아는 것: 연도별 영업이익 키·근무개월·누적 연수와 기본값, 그리고 calc-bridge.calcHynix를
// **첫해 조건으로 정규화해** 부르는 calcHynixResult. 이 파일이 모르는 것: 화면. 재배열·합산은 result-view.ts가.
import { calcHynix } from '../../calc-bridge.js';
import ASSUMPTIONS_SCHEMA from '../../../../data/assumptions-schema.json' with { type: 'json' };
import type { HynixInputs, HynixOpKey, HynixResult } from './types.ts';

export type { HynixInputs, HynixOpKey, HynixResult, HynixPayoutPlan } from './types.ts';

export const HYNIX_YEARS: number[] = Array.from({ length: 10 }, (_, i) => 2026 + i);

// opTril(2026)·opTril2027·… 키로 저장 (2026만 레거시 호환 위해 opTril)
export function hynixOpKey(year: number): HynixOpKey {
  return year === 2026 ? 'opTril' : `opTril${year}`;
}

const SCHEMA_HYNIX = ASSUMPTIONS_SCHEMA.hynix as unknown as Record<string, { default?: number } | undefined>;

// 기본값을 assumptions-schema.json 단일 소스에서 파생
export const HYNIX_OP_DEFAULTS: Record<number, number> = Object.fromEntries(
  HYNIX_YEARS.map(year => [year, SCHEMA_HYNIX[hynixOpKey(year)]?.default ?? 380])
);

export function getActiveHynixYears(inputs: Pick<HynixInputs, 'accumYears'> = HYNIX_DEFAULTS): number[] {
  const count = Math.max(3, Math.min(10, Number(inputs.accumYears) || 3));
  return HYNIX_YEARS.slice(0, count);
}

// 삼성 getWorkMonths와 동일한 패턴 — 연도별 근무개월 override, 없으면 전역 months(기본 12)
export function getHynixWorkMonths(inputs: Partial<HynixInputs> | null | undefined, year: number): number {
  const byYear = inputs?.workMonthsByYear || {};
  const raw = byYear[year] ?? inputs?.months ?? 12;
  const n = Number(raw);
  return Math.max(0, Math.min(12, Number.isFinite(n) ? n : 12));
}

/** 그 해의 영업이익(조) — 키가 없으면 2026 값, 중간 입력('-'·'')은 0 */
export function getHynixOp(inputs: Partial<HynixInputs>, year: number): number {
  const raw = Number(inputs[hynixOpKey(year)] ?? inputs.opTril ?? 0);
  return Number.isFinite(raw) ? raw : 0;
}

/** 그 해의 계약연봉(만원) — 직접 입력(accumSalaryOverrides)이 있으면 그 값, 없으면 첫해는 salary, 뒤 해는 인상률 복리 */
export function getHynixYearSalary(inputs: Partial<HynixInputs>, year: number): number {
  const years = getActiveHynixYears(inputs as HynixInputs);
  const grow = 1 + (Number(inputs.accumGrowth) || 0) / 100;
  const overrides = inputs.accumSalaryOverrides || {};
  let prev = Number(inputs.salary) || 0;
  for (const y of years) {
    const auto = y === years[0] ? prev : Math.round(prev * grow);
    const ov = Number(overrides[y]);
    const s = ov > 0 ? ov : auto;
    if (y === year) return s;
    prev = s;
  }
  return prev;
}

const OP_DEFAULTS_PATCH: Record<string, number> = Object.fromEntries(
  HYNIX_YEARS.map(year => [hynixOpKey(year), HYNIX_OP_DEFAULTS[year]])
);

const S = ASSUMPTIONS_SCHEMA.hynix;
const DEFAULTS: HynixInputs = {
  salary: 5600,
  avgSalary: S.avgSalary.default,
  headcount: S.headcount.default,
  months: 12, workMonthsByYear: {}, ...OP_DEFAULTS_PATCH,
  h1: S.h1.default, h2: S.h2.default, taxRate: null,
  accumGrowth: 5, accumYears: 5, accumSalaryOverrides: {},   // 기본 5개년(사용자 2026-09-10)
  stockPrice: null,
  opTril: HYNIX_OP_DEFAULTS[2026],
};

// 공유 링크 diff 기준 (기본값과 같은 키는 링크에서 생략)
export const HYNIX_DEFAULTS: HynixInputs = DEFAULTS;

/**
 * 한 해 결과 — calcHynix를 **첫해(2026) 조건으로 정규화해** 부른다.
 * 옛 훅은 calcHynix(inputs)를 그대로 불러 salary·months·opTril만 봤는데, 연도별 표(accumSalaryOverrides[2026] ·
 * workMonthsByYear[2026])와 어긋날 수 있었다(옛 OpiTable이 둘을 동시에 패치해 겨우 맞췄다). 여기서 정규화하면
 * 히어로 = 3개년 표 첫 행이 구성으로 성립한다(cashflow.buildHynixAccumRows가 같은 값으로 첫 행을 만든다).
 */
export function calcHynixResult(inputs: HynixInputs): HynixResult {
  const first = getActiveHynixYears(inputs)[0] ?? HYNIX_YEARS[0];
  return calcHynix({
    ...inputs,
    salary: getHynixYearSalary(inputs, first),
    months: getHynixWorkMonths(inputs, first),
    opTril: getHynixOp(inputs, first),
  } as unknown as Parameters<typeof calcHynix>[0]) as HynixResult;
}
