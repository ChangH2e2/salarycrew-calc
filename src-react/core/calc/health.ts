// core/calc/health.ts — 건강보험료(직장가입자) (옛 life-calc.js, S7a 2026-09-08 이동 · 산식 무변경).
// 보수월액 × 건강보험료율(본인부담분) + 장기요양보험료. 회사가 동일 금액을 추가 부담하므로 실제 납부총액은 본인부담분의 2배다.
// 지역가입자(소득·재산·자동차 점수제)는 산정 방식이 달라 이 계산기 범위 밖.
import { HEALTH_ONLY_RATE, LTC_OF_HEALTH } from '../calc-bridge.js';
import { clampNum } from './shared.ts';
import type { Num } from './shared.ts';

// 보수월액보험료 월 상·하한(2026, 건강보험료 총액=노사 합산 기준) — 만원 단위
export const HEALTH_TOTAL_CAP_MAN = 918.348;   // 9,183,480원 — net.ts(실수령)도 이 상한을 공유
const HEALTH_TOTAL_FLOOR_MAN = 2.016;   // 20,160원

export function calcHealthInsurance({ monthlySalary = 300 }: { monthlySalary?: Num } = {}) {
  const salary = clampNum(monthlySalary, 0, 100000);
  // 법정 상·하한은 '건강보험료 총액(노사 합산)'에 적용한 뒤 절반씩 부담 —
  // 기존엔 상·하한 없이 비율만 곱해 고소득 입력에서 상한을 크게 넘겼다(2026-07-30 교정).
  const rawTotalHealth = salary * HEALTH_ONLY_RATE * 2;
  // 보수가 0이면 부과 대상 자체가 아니므로 하한을 적용하지 않는다
  const cappedTotalHealth = salary <= 0 ? 0
    : Math.min(HEALTH_TOTAL_CAP_MAN, Math.max(HEALTH_TOTAL_FLOOR_MAN, rawTotalHealth));
  const capped = salary > 0 && rawTotalHealth > HEALTH_TOTAL_CAP_MAN;
  const floored = salary > 0 && rawTotalHealth < HEALTH_TOTAL_FLOOR_MAN;
  const healthPremium = cappedTotalHealth / 2;      // 본인부담 건강보험료
  const ltcPremium = healthPremium * LTC_OF_HEALTH; // 장기요양은 건강보험료에 비례(상·하한 적용 후 기준)
  const employeeTotal = healthPremium + ltcPremium;
  const employerTotal = employeeTotal;
  const combinedTotal = employeeTotal + employerTotal;
  return { salary, healthPremium, ltcPremium, employeeTotal, employerTotal, combinedTotal, capped, floored };
}
