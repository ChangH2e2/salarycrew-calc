// core/bonus/shared/tax-explain.ts — "성과급에서 세금을 어떻게 뗐나"를 단계로 돌려준다.
//
// 왜: 결과 화면들이 세후 금액만 보여주고 그 근거는 화면마다 다른 자리에 한 줄씩 흩어져 있었다
// (사용자 2026-09-07 "세금 어케 뗀건지도 열림닫힘 형태로라도 적어주는 게 좋겠다 · 회사 공통적으로").
// 계산 자체는 바꾸지 않는다 — calc-bridge.bonusTaxDeducted가 이미 하는 일을 **같은 함수로**
// 다시 밟아 중간값을 드러낼 뿐이다. 여기서 세율을 새로 판단하면 제2의 계산 엔진이 된다(§10).
//
// 모델: 성과급 몫 세금 = (성과급 포함 연간세액) − (성과급 없을 때 연간세액), 지방소득세 10% 포함.
// 한계세율 하나를 곱하는 근사가 아니라 **구간 변화까지 반영한 차액**이라, 성과급이 구간을
// 넘길 때 실효세율이 뛰는 것이 그대로 보인다.
import { incomeTaxOf, earnedIncomeTaxCredit, earnedDed } from '../../calc-bridge.js';
import { calcHealthInsurance } from '../../calc/health.ts';

export interface TaxStep {
  label: string;
  /** 근거 한 줄 — 없으면 생략 */
  note?: string;
  /** 만원. null이면 값 없이 설명만(구분 줄) */
  value: number | null;
  kind: 'base' | 'sub' | 'result' | 'diff';
}

export interface TaxExplain {
  /** 성과급을 뺀 연봉(만) */
  annualPay: number;
  /** 성과급 세전(만) */
  bonusPre: number;
  /** 성과급 몫 소득세(지방세 전, 만) */
  incomeTax: number;
  /** 지방소득세(소득세의 10%, 만) */
  localTax: number;
  /** 성과급에서 떼는 총 세금(만) */
  total: number;
  /** 세후 성과급(만) */
  net: number;
  /** 실효세율 % — 총 세금 / 성과급 세전 */
  effPct: number;
  steps: TaxStep[];
  /** 이 계산이 다루지 않는 것 — 화면이 반드시 함께 말해야 한다(§2) */
  excluded: string[];
  /**
   * 성과급 때문에 **이듬해 더 내는 건강보험료**(본인부담 건강 + 장기요양, 만원).
   * 세금이 아니라 그 뒤에 따로 나가는 돈이라 `total`에 넣지 않는다 — 화면도 따로 적는다.
   * 건보료는 전년도 보수로 걷은 뒤 보수총액이 확정되면 정산하므로(가이드 `/guide/bonus-timeline`),
   * 성과급을 받은 다음 해에 나타난다. 계산은 `calc/health.ts` 하나를 두 번 부른 **차이**다.
   */
  health: { monthly: number; annual: number; capped: boolean };
}

const r0 = (n: number) => Math.round(n);

/**
 * 성과급이 늘린 보수총액 때문에 이듬해 더 내는 건강보험료(본인부담, 장기요양 포함).
 * **상·하한이 있는 계산이라 비율 곱셈으로 근사하지 않는다** — 코어를 두 번 부른 차이다(§10).
 * 실측: 연봉 8,000만 + 성과급 1억 → 월 33.9만 · 연 407만. `/guide/bonus-timeline`의 값과 같다.
 */
function healthIncrease(annualPayMan: number, bonusPreMan: number) {
  const before = calcHealthInsurance({ monthlySalary: annualPayMan / 12 });
  const after = calcHealthInsurance({ monthlySalary: (annualPayMan + bonusPreMan) / 12 });
  const monthly = Math.max(0, after.employeeTotal - before.employeeTotal);
  return { monthly: Math.round(monthly * 10) / 10, annual: r0(monthly * 12), capped: after.capped };
}
const BASIC_DEDUCTION = 150;   // 본인 인적공제(만) — calc-bridge와 같은 값

export function explainBonusTax(annualPayMan: number, bonusPreMan: number): TaxExplain {
  const annualPay = Math.max(0, r0(annualPayMan));
  const bonusPre = Math.max(0, r0(bonusPreMan));

  const withTotal = annualPay + bonusPre;
  const baseTaxable = Math.max(0, annualPay - earnedDed(annualPay) - BASIC_DEDUCTION);
  const withTaxable = Math.max(0, withTotal - earnedDed(withTotal) - BASIC_DEDUCTION);

  const withRaw = incomeTaxOf(withTaxable);
  const baseRaw = incomeTaxOf(baseTaxable);
  const withNet = withRaw - earnedIncomeTaxCredit(withTotal, withRaw);
  const baseNet = baseRaw - earnedIncomeTaxCredit(annualPay, baseRaw);

  const incomeTax = Math.max(0, r0(withNet - baseNet));
  const localTax = r0(incomeTax * 0.1);
  const total = incomeTax + localTax;

  return {
    annualPay, bonusPre, incomeTax, localTax, total,
    net: bonusPre - total,
    effPct: bonusPre > 0 ? Math.round(total / bonusPre * 1000) / 10 : 0,
    // 건강·장기요양은 아래 `health`로 **값을 적어 주므로** 여기서 뺀다 — 안 빼면 화면이
    // "포함되지 않았다"고 말하면서 바로 아래에 그 값을 보여주는 꼴이 된다
    excluded: ['국민연금·고용보험', '부양가족·의료비 등 개인별 공제', '연말정산 정산분'],
    health: healthIncrease(annualPay, bonusPre),
    steps: [
      { kind: 'base', label: '성과급을 뺀 연봉', value: annualPay,
        note: '이 금액이 어느 세율 구간에 있는지가 성과급 세율을 정합니다' },
      { kind: 'base', label: '성과급(세전)', value: bonusPre },
      { kind: 'sub', label: '합산 총급여', value: withTotal,
        note: `근로소득공제 ${Math.round(earnedDed(withTotal)).toLocaleString('ko-KR')}만 · 본인공제 ${BASIC_DEDUCTION}만을 빼면 과세표준 ${withTaxable.toLocaleString('ko-KR')}만` },
      { kind: 'sub', label: '합산 기준 연간 소득세', value: r0(withNet),
        note: '산출세액에서 근로소득세액공제를 뺀 값' },
      { kind: 'sub', label: '성과급이 없었다면', value: r0(baseNet),
        note: '같은 방식으로 연봉만으로 계산한 연간 소득세' },
      { kind: 'diff', label: '성과급 몫 소득세', value: incomeTax,
        note: '두 값의 차이 — 한계세율 하나를 곱하지 않고 구간이 바뀌는 것까지 반영합니다' },
      { kind: 'diff', label: '지방소득세', value: localTax, note: '소득세의 10%' },
      { kind: 'result', label: '성과급에서 떼는 세금', value: total,
        note: bonusPre > 0 ? `실효세율 ${Math.round(total / bonusPre * 1000) / 10}%` : undefined },
    ],
  };
}
