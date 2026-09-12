// core/bonus/samsung/result-view.ts — ① 성과급 결과 화면의 뷰 모델.
//
// 화면이 보여주는 **모든 수**를 이 함수 하나가 만든다. 그래야
//   히어로 = 현금 + 주식 · 현금화 가능 = 현금 + 올해 풀린 주식 · 차액 = Σ소계 − Σ합계 ·
//   매트릭스 창 밖 주식 = 차액의 주식
// 같은 관계가 **구성으로** 성립하고, tests/samsung-result-view.test.mjs가 그걸 잰다.
// 시안 작업에서 검사를 통과하고 사람 눈이 잡은 결함은 전부 "한 값이 여러 곳에 다른 형태로" 계열이었다.
//
// 경계(CLAUDE.md §10): 여기서는 derive의 결과를 **재배열·합산·대조**만 한다. 지급 규칙·세율·상한을
// 새로 판단하지 않는다 — 그건 derive.ts / calc-bridge.js의 것이다. 이 파일에 `0.5`나 `200` 같은
// 제도 상수가 나타나면 잘못 들어온 것이다.
//
// 단위: 금액 만원 정수 · 부여가 원 · 비율 0~1 (표시용 %는 UI가).
import { splitShares3Y } from '../../calc-bridge.js';
import { buildSamsungAccumRows } from '../../cashflow.js';
import { getExclDays,
  calcSamsungTaiPreview, getActiveSamsungYears, getWorkMonths, getYearAnnualSalary,
  getYearGrade, getYearOps, getYearSalaryInput, getWorkBonusForYear,
} from './derive.ts';
import { HYNIX_DEFAULTS, calcHynixResult } from '../hynix/derive.ts';
import { buildHynixResultView } from '../hynix/result-view.ts';
import type { HynixInputs } from '../hynix/types.ts';
import { payoutShape } from '../compare/payout-shape.ts';
import { deptLabel, gradeLabel } from './labels.ts';
import type { Dept, Grade, SamsungInputs, SamsungResult, TaiPreview } from './types.ts';

/** cashflow.buildSamsungAccumRows 한 행 — vested*는 JS가 뒤에 붙이는 필드라 여기서 계약을 적는다 */
export interface AccumRow {
  year: number; workMonths: number; salary: number; annualSalary: number; isMonthly: boolean;
  effRate: number; opiPre: number; opiPost: number; spPre: number; spPost: number;
  shares: number; stVal: number;
  totalPre: number; incomeTax: number; vestedShares: number; vestedVal: number; vestedPre: number;
}

export interface ResultCondition {
  dept: Dept; deptLabel: string; grade: Grade; gradeLabel: string;
  salary: number; isMonthly: boolean; year: number; months: number;
  /** 근무제외일 — OPI2(자사주)만 일할이라 화면이 그 근거를 적을 때 쓴다(2026-09-10) */
  exclDays: number;
  stockPrice: number; opMem: number; academicOn: boolean;
}
export interface ResultHero {
  total: number;        // = cash + stockVal
  cash: number;         // = opi + tai
  stockVal: number;     // = shares × 부여가 (절사) — derive의 stVal
  opi: number; tai: number; shares: number;
  /** '세전 보기'가 쓰는 같은 구성의 세전 금액(§ 아래 PreParts 주석) */
  pre: { total: number; cash: number; stockVal: number; opi: number; tai: number };
}

/**
 * 세전 보기가 읽는 값. **역산하지 않는다** — OPI·TAI·자사주의 세율이 서로 다르므로
 * (TAI는 OPI+특별성과급 위에 얹히는 증분세다) 세후에 하나의 실효세율을 곱해 되돌리면 틀린다.
 * derive가 낸 세전값(opiPre·spPre·h1Pre+h2Pre·PSU grossMan)을 그대로 올린다(§2 "출처 있는 숫자만").
 *
 * **자사주의 흐름도 세전으로 선다**(사용자 2026-09-10). 주식 수는 `floor(세후금액 / 부여가)`라
 * 세후에서 나온 값이지만, 세전 주식 수를 새로 지어내지 않는다 — 부여 연도마다
 * "1주에 얹혀 있던 세전 금액"(spPre ÷ shares)을 그 해 풀리는 주식 수에 곱해 더한다.
 * 그래서 세전에서도 소계 − 수령 = 차액 항등식이 그대로 선다(tests가 잰다).
 */
export interface PreParts {
  opi: number; tai: number; stockVal: number; psuGrant: number;
  subtotal: number;     // = opi + tai + stockVal + psuGrant (부여 기준)
  vested: number;       // 그 해 풀린 자사주의 세전 상당액
  psuReceived: number;  // PSU 그 해 수령분(세전)
  received: number;     // = opi + tai + vested + psuReceived
}
export interface StockGrant {
  shares: number; val: number; price: number;
  /** 같은 주식 수의 **세전** 상당액. 주식 수는 세후 금액에서 나왔으므로 1주 단가가 부여가와 다르다 */
  preVal: number;
  vestedNow: { shares: number; val: number; preVal: number; pct: number };
  later: { shares: number; val: number; preVal: number; pct: number };   // val = grant.val − vestedNow.val (구성으로 항등)
  laterByYear: { year: number; shares: number; val: number; preVal: number; pct: number }[];   // 2·3년차 각각 — Σ = later (사용자 2026-09-08 "27·28 각각 빗금")
}
export interface ThreeYearRow {
  year: number; opi: number; tai: number; stockVal: number;
  pre: PreParts;        // 같은 해의 세전 금액 — 부여 기준만
  psuGrant: number;     // PSU 부여(만기 해에 전액) — 없으면 0
  psuReceived: number;  // PSU 그 해 수령분(3분할 중 한 몫) — 없으면 0
  subtotal: number;     // 부여 기준 = opi + tai + stockVal + psuGrant
  vested: number;       // 그 해 풀린 주식 평가액
  received: number;     // 그 해 손에 = opi + tai + vested + psuReceived
  shares: number; vestedShares: number;
}
export interface ThreeYear {
  years: number[];
  rows: ThreeYearRow[];
  totals: Omit<ThreeYearRow, 'year'>;   // totals.pre도 같은 구성으로 합산된다
  deferred: number;         // Σsubtotal − Σreceived = Σ(stockVal − vested)
  deferredPre: number;      // 같은 정의의 세전 짝
  deferredShares: number;   // Σshares − ΣvestedShares
  growthPct: number;
}
export interface VestMatrix {
  vestYears: number[];                                   // 첫해 … 마지막해 + 2
  rows: { grantYear: number; shares: number; byYear: Record<number, number>; kind?: 'stock' | 'psu' }[];
  totalsByYear: Record<number, number>;
  beyondShares: number;                                  // 마지막해 뒤에 풀리는 주식 = threeYear.deferredShares
}
export interface FormulaLines {
  opi: { base: number; baseLabel: string; rate: number; workMonths: number; gradeMul: number; pre: number; post: number };
  tai: { monthlyBase: number; h1Rate: number; h2Rate: number; pre: number; post: number };
  sp:  { base: number; baseLabel: string; rate: number; pre: number; post: number; price: number; shares: number };
  tax: { opiSp: number; tai: number };                   // 비율 0~1
  premise: { opMem: number; dsOpT: number; thresholdT: number; eligible: boolean };
}
export interface SamsungResultView {
  condition: ResultCondition;
  hero: ResultHero;
  grant: StockGrant;
  cashableNow: number;    // ← 그 화면의 결론 한 값(인주) = hero.cash + grant.vestedNow.val
  cashableNowPre: number; // 같은 정의의 세전 짝 = hero.pre.cash + grant.vestedNow.preVal
  threeYear: ThreeYear;
  vestMatrix: VestMatrix;
  formula: FormulaLines;
  tai: TaiPreview;
  psu: PsuView | null;    // 약정 그룹을 고르고 기준주가가 있을 때만 — 없으면 화면이 절을 안 그린다
}

export interface ResultViewParams {
  inputs: SamsungInputs;
  results: SamsungResult;
  dept: Dept;
  year?: number;
}

import { derivePsu } from './psu.ts';
import type { PsuView } from './psu.ts';

const round = (n: number) => Math.round(n);

/** 히어로 한 값 — 현금(OPI+TAI) + 주식(부여가 환산). curve.ts가 같은 함수로 곡선을 찍는다(항등식). */
export function heroTotal(inputs: SamsungInputs, results: SamsungResult, dept: Dept, year: number = inputs.year): number {
  const d = results.deptResults[dept] ?? results.deptResults.mem;
  const tai = calcSamsungTaiPreview(inputs, year, { totalPre: d.opiPre + d.spPre, incomeTax: d.deduct.incomeTax });
  return d.opiPost + tai.totalPost + d.stVal;
}

/**
 * 히어로의 **세전** 짝 — 곡선(curve.ts)과 히어로가 같은 식을 쓰게 한다.
 * 세후에서 역산하지 않는다: OPI·TAI·자사주의 세율이 서로 다르다(PreParts 주석).
 */
export function heroTotalPre(inputs: SamsungInputs, results: SamsungResult, dept: Dept, year: number = inputs.year): number {
  const d = results.deptResults[dept] ?? results.deptResults.mem;
  const tai = calcSamsungTaiPreview(inputs, year, { totalPre: d.opiPre + d.spPre, incomeTax: d.deduct.incomeTax });
  return round(d.opiPre + tai.h1Pre + tai.h2Pre + d.spPre);
}

export function buildSamsungResultView({ inputs, results, dept, year = inputs.year }: ResultViewParams): SamsungResultView {
  const d = results.deptResults[dept] ?? results.deptResults.mem;
  const price = Math.max(1, Number(inputs.stockPrice) || 1);
  const grade = getYearGrade(inputs, year);
  const isMonthly = grade === 'monthly';
  const salary = getYearSalaryInput(inputs, year);
  const months = getWorkMonths(inputs, year);
  const ops = getYearOps(inputs, year);

  // TAI — OPI+특별성과급 위에 얹히는 증분세 기준(derive와 같은 호출)
  const tai = calcSamsungTaiPreview(inputs, year, { totalPre: d.opiPre + d.spPre, incomeTax: d.deduct.incomeTax });

  // ── 히어로: 현금 + 주식(부여가 환산) ──
  const cash = d.opiPost + tai.totalPost;
  const stockVal = d.stVal;
  const heroTaiPre = tai.h1Pre + tai.h2Pre;
  const hero: ResultHero = {
    total: heroTotal(inputs, results, dept, year), cash, stockVal, opi: d.opiPost, tai: tai.totalPost, shares: d.shares,
    pre: {
      total: d.opiPre + heroTaiPre + d.spPre, cash: d.opiPre + heroTaiPre,
      stockVal: d.spPre, opi: d.opiPre, tai: round(heroTaiPre),
    },
  };

  // ── 부여 주식의 3분할 ──
  const [s1, s2, s3] = splitShares3Y(d.shares) as [number, number, number];
  const vestedNowVal = round(s1 * price / 10000);
  const vestedNowPct = d.shares > 0 ? Math.round(s1 / d.shares * 100) : 0;
  // 세전 1주 단가 — 주식 수가 세후 금액에서 나왔으므로 부여가와 다르다(사용자 2026-09-10)
  const prePerShare = d.shares > 0 ? d.spPre / d.shares : 0;
  const vestedNowPre = round(s1 * prePerShare);
  const grant: StockGrant = {
    shares: d.shares, val: stockVal, price, preVal: round(d.spPre),
    vestedNow: { shares: s1, val: vestedNowVal, preVal: vestedNowPre, pct: vestedNowPct },
    later: { shares: s2 + s3, val: stockVal - vestedNowVal, preVal: round(d.spPre) - vestedNowPre, pct: d.shares > 0 ? 100 - vestedNowPct : 0 },
    laterByYear: [],
  };
  // 2년차는 주식 수 × 부여가, 3년차는 나머지 — 세 몫의 합이 부여 전량과 항등이 되게 마지막 몫에서 절사 오차를 흡수한다
  const val2 = round(s2 * price / 10000);
  const preVal2 = round(s2 * prePerShare);
  const pct2 = d.shares > 0 ? Math.round(s2 / d.shares * 100) : 0;
  grant.laterByYear = [
    { year: year + 1, shares: s2, val: val2, preVal: preVal2, pct: pct2 },
    { year: year + 2, shares: s3, val: grant.later.val - val2, preVal: grant.later.preVal - preVal2, pct: grant.later.pct - pct2 },
  ];
  const cashableNow = cash + vestedNowVal;
  const cashableNowPre = round(d.opiPre + tai.h1Pre + tai.h2Pre) + vestedNowPre;

  // ── 3개년(누적 연수만큼) ──
  const growthPct = Number(inputs.accumGrowth) || 0;
  const accum = buildSamsungAccumRows({
    inputs, selectedDept: dept, growthInput: inputs.accumGrowth, stockPrice: price,
  }) as AccumRow[];
  // PSU는 성과급 재원 밖이지만 **같은 축(부여 기준)**으로 넣으면 소계 = 합계 + 차액 항등식이 그대로 선다.
  // 사용자 결정(2026-09-09): 별도 두 줄이 아니라 한 표로 합친다.
  //   부여 = 만기 해에 전액(세후) · 수령 = 그 해 3분할 몫 · 나머지는 차액으로 이월
  // PSU 세율은 이 화면의 소득세를 따라간다(사용자 2026-09-07) — 직접 넣은 값이 있으면 그게 이긴다.
  const effTaxPct = Number(inputs.taxOverride) > 0 ? Number(inputs.taxOverride) : (results.autoEffRate || 0);
  const psu = derivePsu(inputs, effTaxPct);
  const psuGrantOf = (y: number) => (psu && psu.maturityYear === y ? psu.netMan : 0);
  const psuRecvOf = (y: number) => (psu ? (psu.years.find(r => r.year === y)?.netMan ?? 0) : 0);
  const psuGrossOf = (y: number) => (psu && psu.maturityYear === y ? psu.grossMan : 0);
  const psuRecvGrossOf = (y: number) => (psu ? (psu.years.find(r => r.year === y)?.grossMan ?? 0) : 0);
  const rows: ThreeYearRow[] = accum.map(r => {
    const tp = calcSamsungTaiPreview(inputs, r.year, { totalPre: r.totalPre, incomeTax: r.incomeTax });
    const t = tp.totalPost;
    const psuGrant = psuGrantOf(r.year);
    const psuReceived = psuRecvOf(r.year);
    const subtotal = r.opiPost + t + r.stVal + psuGrant;
    const received = r.opiPost + t + r.vestedVal + psuReceived;
    const pOpi = round(r.opiPre), pTai = round(tp.h1Pre + tp.h2Pre), pSp = round(r.spPre), pPsu = psuGrossOf(r.year);
    const pVest = round(r.vestedPre), pPsuRecv = psuRecvGrossOf(r.year);
    const pre: PreParts = {
      opi: pOpi, tai: pTai, stockVal: pSp, psuGrant: pPsu, subtotal: pOpi + pTai + pSp + pPsu,
      vested: pVest, psuReceived: pPsuRecv, received: pOpi + pTai + pVest + pPsuRecv,
    };
    return { year: r.year, opi: r.opiPost, tai: t, stockVal: r.stVal, pre, psuGrant, psuReceived, subtotal, vested: r.vestedVal, received, shares: r.shares, vestedShares: r.vestedShares };
  });
  const sum = (k: Exclude<keyof ThreeYearRow, 'year' | 'pre'>) => rows.reduce((a, r) => a + r[k], 0);
  const sumPre = (k: keyof PreParts) => rows.reduce((a, r) => a + r.pre[k], 0);
  const totals: Omit<ThreeYearRow, 'year'> = {
    opi: sum('opi'), tai: sum('tai'), stockVal: sum('stockVal'),
    psuGrant: sum('psuGrant'), psuReceived: sum('psuReceived'), subtotal: sum('subtotal'),
    vested: sum('vested'), received: sum('received'), shares: sum('shares'), vestedShares: sum('vestedShares'),
    pre: {
      opi: sumPre('opi'), tai: sumPre('tai'), stockVal: sumPre('stockVal'),
      psuGrant: sumPre('psuGrant'), subtotal: sumPre('subtotal'),
      vested: sumPre('vested'), psuReceived: sumPre('psuReceived'), received: sumPre('received'),
    },
  };
  const years = getActiveSamsungYears(inputs);
  const threeYear: ThreeYear = {
    years, rows, totals, growthPct,
    deferred: totals.subtotal - totals.received,
    deferredPre: totals.pre.subtotal - totals.pre.received,
    deferredShares: totals.shares - totals.vestedShares,
  };

  // ── 부여 연도 × 풀리는 해 매트릭스 ──
  const first = years[0] ?? year;
  const last = years[years.length - 1] ?? year;
  const vestYears: number[] = [];
  for (let y = first; y <= last + 2; y++) vestYears.push(y);
  const totalsByYear: Record<number, number> = Object.fromEntries(vestYears.map(y => [y, 0]));
  let beyondShares = 0;
  const mRows = rows.map(r => {
    const [a, b, c] = splitShares3Y(r.shares) as [number, number, number];
    const byYear: Record<number, number> = { [r.year]: a, [r.year + 1]: b, [r.year + 2]: c };
    for (const [yy, n] of Object.entries(byYear)) {
      const yn = Number(yy);
      totalsByYear[yn] = (totalsByYear[yn] ?? 0) + n;
      if (yn > last) beyondShares += n;
    }
    return { grantYear: r.year, shares: r.shares, byYear, kind: 'stock' as 'stock' | 'psu' };
  });
  // PSU도 같은 격자에 넣는다 — 만기 해부터 3분할이라 축이 정확히 같다(사용자 2026-09-09
  // "28년이나 29·30년에도 표엔 없는데"). 자사주는 실선, PSU는 점선으로 구분한다.
  if (psu) {
    const byYear: Record<number, number> = {};
    for (const r of psu.years) {
      byYear[r.year] = r.shares;
      if (!vestYears.includes(r.year)) vestYears.push(r.year);
      totalsByYear[r.year] = (totalsByYear[r.year] ?? 0) + r.shares;
      if (r.year > last) beyondShares += r.shares;
    }
    vestYears.sort((a, b) => a - b);
    mRows.push({ grantYear: psu.maturityYear, shares: psu.grantedShares, byYear, kind: 'psu' });
  }
  const vestMatrix: VestMatrix = { vestYears, rows: mRows, totalsByYear, beyondShares };

  // ── 이 숫자가 나온 계산 — derive가 이미 낸 값을 문장 재료로 정렬만 한다 ──
  const annualSalary = getYearAnnualSalary(inputs, year) + getWorkBonusForYear(inputs, year);
  const taiPre = tai.h1Pre + tai.h2Pre;
  const formula: FormulaLines = {
    opi: {
      base: isMonthly ? salary : annualSalary,
      baseLabel: isMonthly ? '월급' : '계약연봉',
      rate: results.opiRateCap, workMonths: months,
      gradeMul: d.opiPre > 0 && annualSalary > 0 && !isMonthly
        ? Math.round(d.opiPre / (annualSalary * results.opiRateCap * (months / 12)) * 100) / 100
        : 1,
      pre: d.opiPre, post: d.opiPost,
    },
    tai: { monthlyBase: tai.monthlyBase, h1Rate: tai.rate1, h2Rate: tai.rate2, pre: round(taiPre), post: tai.totalPost },
    sp: {
      base: isMonthly ? salary * 14 : annualSalary,
      baseLabel: isMonthly ? '월급 × 14' : '계약연봉',
      rate: d.specialRate * (d.spWorkR ?? 1),
      pre: d.spPre,          // 세금 근거 접힘(TaxBreakdown)이 세전 합계를 만들 때 쓴다 — 재계산 아님, derive 값 그대로
      post: d.spPost, price, shares: d.shares,
    },
    tax: { opiSp: d.effRate, tai: taiPre > 0 ? 1 - tai.totalPost / taiPre : 0 },
    premise: { opMem: ops.mem, dsOpT: results.dsOpT, thresholdT: results.thresholdT, eligible: results.eligible },
  };

  const condition: ResultCondition = {
    dept, deptLabel: deptLabel(dept), grade, gradeLabel: gradeLabel(grade),
    salary, isMonthly, year, months, exclDays: getExclDays(inputs, year),
    stockPrice: price, opMem: ops.mem, academicOn: d.academicOn,
  };

  return { condition, hero, grant, cashableNow, cashableNowPre, threeYear, vestMatrix, formula, tai, psu };
}

/** 삼성의 현재 결과와 같은 연봉의 하이닉스 기본 시나리오를 대조한다.
 * 별도 함수로 두어 하이닉스의 삼성 대조 막대가 다시 이 대조를 호출하지 않는다.
 * 지급액·세율·이연은 두 result-view의 값을 그대로 받는다.
 */
export function buildSamsungComparisonView(inputs: SamsungInputs, view: SamsungResultView, hxCms: Partial<HynixInputs> | null = null) {
  const salary = getYearAnnualSalary(inputs, view.condition.year);
  const hxInputs = { ...HYNIX_DEFAULTS, ...hxCms, salary, accumSalaryOverrides: {} } as HynixInputs;
  const hx = buildHynixResultView({ inputs: hxInputs, results: calcHynixResult(hxInputs) });
  return {
    salary, samsungYear: view.condition.year, hynixYear: hx.condition.year,
    samsung: payoutShape(view.hero.cash, view.grant.vestedNow.val, view.grant.later.val),
    hynix: hx.shape.hynix, plan: hx.plan,
  };
}
