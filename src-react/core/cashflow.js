// cashflow.js — 삼성·하이닉스 다년도 누적 수령액·이연 계산 순수 함수.
// AccumTable / HynixAccumTable의 계산 로직을 UI에서 분리해 테스트 가능하게 한다.
import { calcSamsungOneDeptYear, splitShares3Y, calcHynix, bonusTaxDeducted, EMP_RATE, HEALTH_RATE, HYNIX_RULES } from './calc-bridge.js';
import { getGradeMul } from './grades.js';
import { getActiveSamsungYears, getYearGrade, getYearOps, getYearSalaryInput, getWorkBonusForYear, getWorkMonths } from './samsung-derive.js';
import { getActiveHynixYears, hynixOpKey, getHynixWorkMonths } from './hynix-derive.js';

// 삼성 누적: 연도별 OPI 현금 + 자사주(부여 총액 / 당해 매도분 3년 분할) 계산.
// 반환: [{ year, workMonths, opiPre, opiPost, spPre, spPost, shares, stVal, vestedShares, vestedVal, vestedPre }]
export function buildSamsungAccumRows({ inputs, selectedDept, growthInput, stockPrice }) {
  const grow = 1 + (Number(growthInput) || 0) / 100;
  const totalH = inputs.hMem + inputs.hCom + inputs.hFnd + inputs.hLsi;
  const activeYears = getActiveSamsungYears(inputs);

  const rows = activeYears.map((year, i) => {
    const yearGrade     = getYearGrade(inputs, year);
    const yearIsMonthly = yearGrade === 'monthly';
    const salary        = getYearSalaryInput(inputs, year);
    // OPI 기준연봉 = 계약연봉 + 업무성과급(토글 ON, 연봉제만) — calcSamsungResult와 동일 기준
    const annualSalary  = (yearIsMonthly ? salary * 12 : salary) + getWorkBonusForYear(inputs, year);
    // 누적 표는 연도별 급여 인상률(accumGrowth)을 avgSalary에 복리 적용
    const avgSalary     = Math.round((inputs.avgSalary || 8500) * Math.pow(grow, i));
    const ops           = getYearOps(inputs, year);
    const monthsN       = getWorkMonths(inputs, year);
    const workR         = monthsN / 12;
    const academicOn    = !!(inputs.academic && inputs.academic[year]);
    // 학술연수 OPI2: 근무개월 만근 인정 + 학술기간 절반 인정 → (n + (12−n)/2)/12 (n=0이면 0.5)
    const spWorkR       = academicOn ? (monthsN + (12 - monthsN) / 2) / 12 : workR;
    const gradeMul      = yearIsMonthly ? 1 : getGradeMul(yearGrade);

    const r = calcSamsungOneDeptYear({
      year, dept: selectedDept,
      salary, annualSalary, isMonthly: yearIsMonthly,
      workR, spWorkR, gradeMul, academicOn,
      avgSalary, totalH,
      hMem: inputs.hMem, hCom: inputs.hCom, hFnd: inputs.hFnd, hLsi: inputs.hLsi,
      opMem: ops.mem, opFnd: ops.fnd, opLsi: ops.lsi,
      taxOverride: inputs.taxOverride, stockPrice,
    });

    // opiPre·spPre도 담는다 — 결과 화면의 '세전 보기'가 연도별로 세전 금액을 적어야 하는데,
    // 세후에서 역산하면 OPI와 자사주가 같은 실효세율을 쓴다고 가정하게 된다(사실이 아니다).
    return { year, workMonths: monthsN, salary, annualSalary, isMonthly: yearIsMonthly, effRate: r.effRate, opiPre: r.opiPre, opiPost: r.opiPost, spPre: r.spPre, spPost: r.spPost, shares: r.shares, stVal: r.stVal, totalPre: r.totalPre, incomeTax: r.incomeTax };
  });

  // 자사주 3년 분할 → 당해 매도분(vesting): 올해 1/3 + 작년 1/3 + 재작년 1/3
  const splits = rows.map(row => splitShares3Y(row.shares));
  // 부여 연도마다 **1주에 얹혀 있던 세전 금액**이 다르다 — 주식 수가 세후 금액에서 나왔고
  // 세율도 해마다 다르기 때문이다. 세전 흐름은 주식 수를 새로 짓지 않고 이 단가로 환산한다
  // (사용자 2026-09-10 "자사주도 완전 세전기준으로"). 전부 derive가 낸 값에서만 나온다.
  const prePerShare = (i) => (rows[i] && rows[i].shares > 0 ? rows[i].spPre / rows[i].shares : 0);
  rows.forEach((row, idx) => {
    const currentGrant  = splits[idx]?.[0] || 0;
    const prevGrant     = idx >= 1 ? (splits[idx - 1]?.[1] || 0) : 0;
    const prevPrevGrant = idx >= 2 ? (splits[idx - 2]?.[2] || 0) : 0;
    row.vestedShares = currentGrant + prevGrant + prevPrevGrant;
    row.vestedVal    = Math.round(row.vestedShares * stockPrice / 10000);
    row.vestedPre    = Math.round(
      currentGrant * prePerShare(idx)
      + prevGrant * prePerShare(idx - 1)
      + prevPrevGrant * prePerShare(idx - 2),
    );
  });
  return rows;
}

// 하이닉스 이연 잔여(연말 미지급 스냅샷): 당해 PS 20% + 전년 PS 10%
export function hynixRemainingDeferred(psRows, idx) {
  // **비율은 calc-constants 하나에서 온다.** 2026-09-15까지 0.2·0.1이 여기 손으로 박혀 있었고,
  // 수정 잠정합의안이 이연을 없앴을 때(psDeferRatio 0.2 → 0) 이 함수만 옛 규칙으로 남아
  // 같은 화면의 두 숫자가 어긋났다 — §10 "*-view는 지급 규칙을 새로 판단하지 않는다"의 형제다.
  const defer = HYNIX_RULES.psDeferRatio;
  if (!(defer > 0)) return 0;
  const currentRemain = (psRows[idx] || 0) * defer;
  const prevRemain    = idx >= 1 ? (psRows[idx - 1] || 0) * (defer / 2) : 0;
  return Math.max(0, currentRemain + prevRemain);
}

// 하이닉스 누적: 연도별 PS/PI + 이연 carry(전년·전전년 각 10%) 지급/세후.
// 반환: baseRows(연도별 salary·opTril·months·calcHynix 결과 + paid*·remainDefer)
export function buildHynixAccumRows({ inputs, growthInput }) {
  const grow = 1 + (Number(growthInput) || 0) / 100;
  const salaryOverrides = inputs.accumSalaryOverrides || {};
  const years = getActiveHynixYears(inputs);
  let prevSalary = Number(inputs.salary) || 0;

  const baseRows = years.map((year, idx) => {
    const autoSalary = idx === 0 ? prevSalary : Math.round(prevSalary * grow);
    const override   = salaryOverrides[year];
    const salary     = Number(override) > 0 ? Number(override) : autoSalary;
    prevSalary = salary;

    const opRaw  = Number(inputs[hynixOpKey(year)] ?? inputs.opTril ?? 0);
    const opTril = Number.isFinite(opRaw) ? opRaw : 0; // '-'·'' 중간 입력 방어
    const months = getHynixWorkMonths(inputs, year);
    const result = calcHynix({ ...inputs, salary, opTril, months });
    return { year, salary, autoSalary, opTril, months, ...result };
  });

  const psRows = baseRows.map(row => row.psMan || 0);
  baseRows.forEach((row, idx) => {
    // 이연 분할(1년·2년 뒤 각 defer/2)과 당해 비율(1 − defer) — 둘 다 상수에서 파생한다.
    // 이연이 0이면 carryPaid도 0이고 당해가 100%다(2026-09-10 수정 잠정합의).
    const defer = HYNIX_RULES.psDeferRatio;
    const tranche = defer / 2;
    const carryPaid    = defer > 0 ? ((idx >= 1 ? psRows[idx - 1] * tranche : 0) + (idx >= 2 ? psRows[idx - 2] * tranche : 0)) : 0;
    const paidPsGross  = row.psMan * (1 - defer) + carryPaid;
    const paidPiGross  = row.piMan;
    const paidGross    = paidPsGross + paidPiGross;
    // 빈 값(null)만 자동세율, 명시적 0도 유효한 수동세율로 처리 — calc-bridge.js와 동일 기준
    const manualTaxRate = inputs.taxRate != null && Number.isFinite(+inputs.taxRate)
      ? Math.max(0, Math.min(70, +inputs.taxRate)) : null;
    const incomeTax    = manualTaxRate != null ? paidGross * (manualTaxRate / 100) : bonusTaxDeducted(row.salary, paidGross);
    const paidDeduct   = Math.max(0, incomeTax + paidGross * (HEALTH_RATE + EMP_RATE));
    const paidNet      = Math.max(0, paidGross - paidDeduct);
    const netRatio     = paidGross > 0 ? paidNet / paidGross : 0;

    row.paidPsGross = paidPsGross;
    row.paidPiGross = paidPiGross;
    row.paidGross = paidGross;
    row.paidDeduct = paidDeduct;
    row.paidNet = paidNet;
    row.paidPsNet = paidPsGross * netRatio;
    row.paidPiNet = paidPiGross * netRatio;
    row.paidIncomeOnly = Math.max(0, paidGross - incomeTax); // 소득세 기준 (4대보험 별도)
    row.remainDefer = hynixRemainingDeferred(psRows, idx);
    // 2026 임단협 잠정합의 — 그해 받는 돈을 현금분/자사주분으로 나눈다. 합계는 paidGross 그대로.
    // 표가 전액 현금인 것처럼 보이던 것을 바로잡는 용도(사용자 2026-08-20).
    // carryPaid(전년·전전년 이연분)도 자사주다. HYNIX_YEARS가 2026부터라 표 안에는
    // 구제도(전액 현금) 이연이 섞여 들어올 여지가 없다 — idx 0의 carryPaid는 항상 0이다.
    const plan = row.psPayoutPlan;
    if (plan) {
      row.paidCashGross  = row.psMan * plan.cashRatio + paidPiGross;
      row.paidStockGross = row.psMan * plan.stockCurrentRatio + carryPaid;
      row.paidCashNet    = row.paidCashGross * netRatio;
      row.paidStockNet   = row.paidStockGross * netRatio;
    }
  });

  return baseRows;
}
