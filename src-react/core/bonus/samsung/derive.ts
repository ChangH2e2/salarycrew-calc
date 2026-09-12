// core/bonus/samsung/derive.ts — 삼성 계산 입력 파생·상수·순수 계산 (React-free).
//
// 2026-09-07 S1: core/samsung-derive.js를 그대로 옮기고 경계에 타입만 붙였다. **계산은 한 줄도
// 바꾸지 않았다** — 골든 테스트(tests/calc-bridge.test.mjs)가 같은 값을 내야 한다. 옛 경로
// core/samsung-derive.js는 이 파일을 re-export하는 shim으로 남아 tests/·gen-salary-pages·
// check-calc-drift가 그대로 돈다. 소비처가 새 경로로 옮겨지면 shim을 지운다.
//
// 이 파일이 아는 것: 입력에서 연도별 급여·직급·근무개월·영업이익을 파생하고, calc-bridge의
// 풀·사업부 계산을 불러 사업부 4개의 한 해 결과를 만든다. 이 파일이 모르는 것: 화면. 표시용
// 재배열·합산은 result-view.ts(S2)가 한다 — 거기서 지급 규칙·세율·상한을 새로 판단하지 않는다.
import {
  calcSamsungPool,
  calcSamsungOneDeptYear,
  bonusTaxDeducted,
  HEALTH_ONLY_RATE,
  LTC_OF_HEALTH,
  EMP_RATE,
  NPS_RATE,
  NPS_CAP_YR,
} from '../../calc-bridge.js';
import { getGradeMul } from '../../grades.js';
import { PSU_DEFAULTS } from './psu.ts';
import ASSUMPTIONS_SCHEMA from '../../../../data/assumptions-schema.json' with { type: 'json' };
import type { Dept, DeptResult, Grade, OpKey, SamsungInputs, SamsungResult, TaiPreview, YearOps } from './types.ts';

export type { Dept, DeptResult, Grade, OpKey, SamsungInputs, SamsungResult, TaiPreview, YearOps } from './types.ts';

// assumptions-schema.json의 samsung 블록은 키가 opMem2026 … 처럼 연도로 늘어나는 사전이라
// JSON 추론 타입으로는 템플릿 키를 인덱싱할 수 없다 — 사전으로 한 번 캐스트한다.
const SCHEMA_SAMSUNG = ASSUMPTIONS_SCHEMA.samsung as unknown as Record<string, { default?: number } | undefined>;

export const SAMSUNG_YEARS: number[] = Array.from({ length: 10 }, (_, i) => 2026 + i);

// 기본값을 assumptions-schema.json 단일 소스에서 파생
export const YEAR_OP_DEFAULTS: Record<number, YearOps> = Object.fromEntries(
  SAMSUNG_YEARS.map(year => [year, {
    mem: SCHEMA_SAMSUNG[`opMem${year}`]?.default ?? 100,
    fnd: SCHEMA_SAMSUNG[`opFnd${year}`]?.default ?? 0,
    lsi: SCHEMA_SAMSUNG[`opLsi${year}`]?.default ?? 0,
  }])
);

const DEFAULT_OP_PATCH = Object.fromEntries(
  SAMSUNG_YEARS.flatMap(year => {
    const d = YEAR_OP_DEFAULTS[year];
    return [
      [`opMem${year}`, d.mem],
      [`opFnd${year}`, d.fnd],
      [`opLsi${year}`, d.lsi],
    ];
  })
) as Record<OpKey, number>;

export function getActiveSamsungYears(inputs: Pick<SamsungInputs, 'accumYears'> = DEFAULTS): number[] {
  const count = Math.max(3, Math.min(10, Number(inputs.accumYears) || 3));
  return SAMSUNG_YEARS.slice(0, count);
}

const DEFAULTS: SamsungInputs = {
  grade: 'cl4-low',
  salary: 5600,
  splitSalary: false, // 연봉제 계약연봉·업무성과급 분리 입력
  workBonus: 0,       // 업무성과급(연간) — TAI 상여기초에서 제외
  avgSalary: SCHEMA_SAMSUNG.avgSalary?.default ?? 8500,
  months: 12,
  hMem: SCHEMA_SAMSUNG.hMem?.default ?? 0,
  hCom: SCHEMA_SAMSUNG.hCom?.default ?? 0,
  hFnd: SCHEMA_SAMSUNG.hFnd?.default ?? 0,
  hLsi: SCHEMA_SAMSUNG.hLsi?.default ?? 0,
  stockPrice: 255000,
  taxOverride: null,
  accumGrowth: 5,
  // 기본 5개년(사용자 2026-09-10). 3년은 자사주가 3년에 걸쳐 풀리는 것을 겨우 담는 길이라
  // 마지막 해에 이월이 몰려 보였다 — 5년이면 첫 부여분이 다 풀린 뒤가 보인다.
  accumYears: 5,
  accumSalaryOverrides: {},
  accumPayTypeOverrides: {},
  salaryByYear: {},
  gradeByYear: {},
  workMonthsByYear: {},
  exclDaysByYear: {},
  year: 2026,
  scenario: 'mid',
  academic: Object.fromEntries(SAMSUNG_YEARS.map(year => [year, false])),
  ...DEFAULT_OP_PATCH,
  // PSU — 기본은 '해당 없음'. 고르면 그때 결과에 절이 생긴다(psu.ts)
  ...PSU_DEFAULTS,
};

// 공유 링크 diff 기준 (기본값과 같은 키는 링크에서 생략)
export const SAMSUNG_DEFAULTS: SamsungInputs = DEFAULTS;

export function opKeys(year: number): { mem: OpKey; fnd: OpKey; lsi: OpKey } {
  return {
    mem: `opMem${year}`,
    fnd: `opFnd${year}`,
    lsi: `opLsi${year}`,
  };
}

// 음수·소수 입력 중간 상태('', '-', '-1.')도 허용하므로 NaN은 0으로 처리
function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isNaN(n) ? d : n;
}

export function getYearOps(inputs: SamsungInputs, year: number = inputs.year): YearOps {
  const keys = opKeys(year);
  return {
    mem: num(inputs[keys.mem] ?? YEAR_OP_DEFAULTS[year]?.mem ?? 0),
    fnd: num(inputs[keys.fnd] ?? YEAR_OP_DEFAULTS[year]?.fnd ?? 0),
    lsi: num(inputs[keys.lsi] ?? YEAR_OP_DEFAULTS[year]?.lsi ?? 0),
  };
}

export function getWorkMonths(inputs: SamsungInputs, year: number = inputs.year): number {
  const byYear = inputs?.workMonthsByYear || {};
  const raw = byYear[year] ?? inputs?.months ?? 12;
  return Math.max(0, Math.min(12, num(raw, 12)));
}

/** 한 해의 일수 — 윤년까지 보지 않는다(성과급 규정이 그 수준을 요구하지 않는다) */
export const DAYS_IN_YEAR = 365;

/**
 * 연도별 **근무제외일**. 사용자가 안 적었으면 근무개월에서 환산한다 —
 * 그래야 개월만 넣던 사람의 값이 안 바뀐다(하위호환).
 * OPI1은 지금대로 **월할**이고, 일할은 **OPI2(자사주)에만** 쓴다(사용자 확인 2026-09-10).
 */
export function getExclDays(inputs: SamsungInputs, year: number = inputs.year): number {
  const raw = (inputs?.exclDaysByYear || {})[year];
  if (raw !== undefined && raw !== null && raw !== '') {
    return Math.max(0, Math.min(DAYS_IN_YEAR, num(raw, 0)));
  }
  const months = getWorkMonths(inputs, year);
  return Math.round(((12 - months) / 12) * DAYS_IN_YEAR);
}

export function getYearGrade(inputs: SamsungInputs, year: number = inputs.year): Grade {
  return inputs?.gradeByYear?.[year] || inputs?.grade || 'cl4-low';
}

export function getYearSalaryInput(inputs: SamsungInputs, year: number = inputs.year): number {
  const byYear = inputs?.salaryByYear || {};
  const override = Number(byYear[year]);
  if (override > 0) return override;

  const baseInput = Number(inputs?.salary) || 0;
  const baseGrade = inputs?.grade || 'cl4-low';
  const yearGrade = getYearGrade(inputs, year);
  const grow = 1 + (Number(inputs?.accumGrowth) || 0) / 100;
  const offset = Math.max(0, Number(year) - 2026);
  const baseAnnual = baseGrade === 'monthly' ? baseInput * 12 : baseInput;
  const annual = Math.round(baseAnnual * Math.pow(grow, offset));
  return yearGrade === 'monthly' ? Math.round(annual / 12) : annual;
}

export function getYearAnnualSalary(inputs: SamsungInputs, year: number = inputs.year): number {
  const grade = getYearGrade(inputs, year);
  const salaryInput = getYearSalaryInput(inputs, year);
  return grade === 'monthly' ? salaryInput * 12 : salaryInput;
}

// 업무성과급(연간) — 연봉제 + 토글 ON일 때만. '내 급여'는 계약연봉만 입력하고,
// 업성은 여기서 OPI1/2 기준연봉에 가산된다 (TAI 상여기초에는 미포함).
export function getWorkBonusForYear(inputs: SamsungInputs, year: number = inputs.year): number {
  if (getYearGrade(inputs, year) === 'monthly') return 0;
  return inputs.splitSalary ? Math.max(0, Number(inputs.workBonus) || 0) : 0;
}

export function getTaiAutoMonthlyBase(inputs: SamsungInputs, year: number = inputs.year): number {
  const grade = getYearGrade(inputs, year);
  const salaryInput = getYearSalaryInput(inputs, year);
  if (grade === 'monthly') return Math.max(0, salaryInput - 20);
  // 연봉제: TAI 상여기초 = 계약연봉 ÷ 20 (업무성과급은 애초에 포함되지 않음)
  return salaryInput / 20;
}

export function getTaiMonthlyBase(inputs: SamsungInputs, year: number = inputs.year): number {
  const manual = Number(inputs?.taiBaseManual);
  // 공유 링크 등 외부 입력값 방어(UI NumField와 동일 범위) — share.js SHARE_FIELD_BOUNDS와 이중 방어
  return Number.isFinite(manual) && manual > 0 ? Math.min(50000, manual) : getTaiAutoMonthlyBase(inputs, year);
}

export function getTaiRates(inputs: SamsungInputs): { h1: number; h2: number } {
  const clamp = (v: number) => Math.max(0, Math.min(300, v));
  return {
    h1: Number.isFinite(+(inputs?.taiH1Rate ?? NaN)) ? clamp(+(inputs.taiH1Rate as number | string)) : 100,
    h2: Number.isFinite(+(inputs?.taiH2Rate ?? NaN)) ? clamp(+(inputs.taiH2Rate as number | string)) : 100,
  };
}

// opiCtx: { totalPre, incomeTax } — 같은 해 OPI+특별성과급 세전액·소득세(calcSamsungResult의 d.opiPre+d.spPre, d.deduct.incomeTax).
// TAI를 OPI·특별성과급 위에 쌓인 소득으로 보고 증분세를 계산해야, OPI가 0인 경우에도 TAI 소득세가 0으로 새지 않는다.
export function calcSamsungTaiPreview(
  inputs: SamsungInputs,
  year: number,
  opiCtx: { totalPre?: number; incomeTax?: number } = {},
): TaiPreview {
  const { totalPre: opiTotalPre = 0, incomeTax: opiIncomeTax = 0 } = opiCtx || {};
  const { h1, h2 } = getTaiRates(inputs);
  const monthlyBase = getTaiMonthlyBase(inputs, year);
  const h1Pre = Math.max(0, monthlyBase * h1 / 100);
  const h2Pre = Math.max(0, monthlyBase * h2 / 100);
  const taiPreTotal = h1Pre + h2Pre;
  // 빈 값(null)만 자동세율, 명시적 0도 유효한 수동세율(세금 0%)로 처리 — calc-bridge.js와 동일 기준
  const hasManualTax = inputs?.taxOverride != null && Number.isFinite(+inputs.taxOverride);
  let taxRate: number;
  if (hasManualTax) {
    taxRate = Math.max(0, Math.min(70, +(inputs.taxOverride as number | string))) / 100;
  } else if (taiPreTotal > 0) {
    // TAI를 OPI+특별성과급 위에 쌓아 증분세를 구한다 — OPI가 0이어도 TAI 자체 세율이 정확히 계산됨.
    const annualSalary = getYearAnnualSalary(inputs, year) + getWorkBonusForYear(inputs, year);
    const comboTax: number = bonusTaxDeducted(annualSalary, opiTotalPre + taiPreTotal);
    taxRate = Math.max(0, comboTax - opiIncomeTax) / taiPreTotal;
  } else {
    taxRate = 0;
  }
  const h1Post = Math.round(h1Pre * (1 - taxRate));
  const h2Post = Math.round(h2Pre * (1 - taxRate));
  return { rate1: h1, rate2: h2, monthlyBase, h1Pre, h2Pre, h1Post, h2Post, totalPost: h1Post + h2Post };
}

export function calcSamsungResult(inputs: SamsungInputs): SamsungResult {
  const year   = inputs.year;
  const ops    = getYearOps(inputs, year);
  const yearGrade  = getYearGrade(inputs, year);
  const isMonthly  = yearGrade === 'monthly';
  const salary     = getYearSalaryInput(inputs, year);
  // OPI1/2 기준연봉 = 계약연봉 + 업무성과급(토글 ON 시) — 세금·사회보험 추정도 총연봉 기준
  const annualSalary = getYearAnnualSalary(inputs, year) + getWorkBonusForYear(inputs, year);
  const months  = getWorkMonths(inputs, year);
  const workR   = months / 12;
  const academicOn = !!(inputs.academic && inputs.academic[year]);
  // 학술연수 OPI2: 근무개월은 만근 인정 + 학술기간(12−n)은 절반 인정 → (n + (12−n)/2)/12.
  // n=0(연중 학술)이면 0.5(기존 ×50%와 동일), n=12면 1.0.
  // **OPI2(자사주)만 일할이다.** 제외일을 날짜로 받아 (365 − 제외일) / 365.
  // 학술연수 기간은 절반만 인정하던 규칙은 그대로 — 이제 그 절반을 **일 단위로** 뺀다.
  const exclDays   = getExclDays(inputs, year);
  const effExcl    = academicOn ? exclDays / 2 : exclDays;
  const spWorkR    = Math.max(0, Math.min(1, (DAYS_IN_YEAR - effExcl) / DAYS_IN_YEAR));
  const gradeMul: number = getGradeMul(yearGrade);
  const totalH     = inputs.hMem + inputs.hCom + inputs.hFnd + inputs.hLsi;
  const avgSalary  = Number(inputs.avgSalary);

  // 공통 params — calcSamsungOneDeptYear 재사용
  const common = {
    year, salary, annualSalary, isMonthly,
    workR, spWorkR, gradeMul, academicOn,
    avgSalary, totalH,
    hMem: inputs.hMem, hCom: inputs.hCom,
    hFnd: inputs.hFnd, hLsi: inputs.hLsi,
    opMem: ops.mem, opFnd: ops.fnd, opLsi: ops.lsi,
    taxOverride: inputs.taxOverride, stockPrice: inputs.stockPrice,
  };

  // Pool 정보 (threshold, eligible 등) — 사업부 독립적
  const { bonusBaseMW, opiRateRaw, eligible, dsOpT, thresholdT } = calcSamsungPool({
    year, opMem: ops.mem, opFnd: ops.fnd, opLsi: ops.lsi, totalH, avgSalary,
  });
  const annualOpiRateCap = Math.min(opiRateRaw, 0.5);
  const opiRateCap = isMonthly ? Math.min(annualOpiRateCap * 14, 7) : annualOpiRateCap;
  const opiPaidTotalMW = avgSalary * (isMonthly ? opiRateCap / 14 : opiRateCap) * totalH;

  const deptResults = {} as Record<Dept, DeptResult>;
  let specialRates: unknown = null;

  (['mem', 'com', 'fnd', 'lsi'] as const).forEach(dept => {
    const r = calcSamsungOneDeptYear({ ...common, dept });
    if (!specialRates) specialRates = r.specialRates;

    // 공제 상세 (소득세 + 4대보험) — useCalcState 전용, AccumTable은 불필요
    const npsBase  = Math.max(0, Math.min(annualSalary + r.totalPre, NPS_CAP_YR) - Math.min(annualSalary, NPS_CAP_YR));
    const nps      = npsBase * NPS_RATE;
    const emp      = r.totalPre * EMP_RATE;
    const health   = r.totalPre * HEALTH_ONLY_RATE;
    const ltc      = health * LTC_OF_HEALTH;

    deptResults[dept] = {
      opiPre: r.opiPre, opiPost: r.opiPost,
      spPre:  r.spPre,  spPost:  r.spPost,
      shares: r.shares, stVal:   r.stVal,
      effRate: r.effRate, specialRate: r.specialRate, spWorkR: r.spWorkR,
      spDivRate: r.spDivRate, spBizRate: r.spBizRate,
      spDetail: r.spDetail,
      academicOn, stockEligible: r.stockEligible,
      deduct: {
        incomeTax: Math.round(r.incomeTax),
        nps: Math.round(nps), emp: Math.round(emp),
        health: Math.round(health), ltc: Math.round(ltc),
        total: Math.round(r.incomeTax + nps + emp + health + ltc),
      },
    };
  });

  return {
    deptResults, eligible, dsOpT, thresholdT,
    opiRateCap, annualOpiRateCap,
    autoEffRate: deptResults.mem.effRate * 100,
    opiPaidTotalMW, bonusBaseMW,
    specialRates, ops, workMonths: months,
  };
}
