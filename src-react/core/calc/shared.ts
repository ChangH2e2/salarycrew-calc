// core/calc/shared.ts — 생활금융 계산기 공통 소품(순수 함수). 옛 life-calc.js·salary-net.js가 각자 들고 있던 clampNum과 원리금균등 환산 둘.
// 단위는 전부 만원 · 비율은 %(부르는 쪽이 /100).

/** 숫자 아니면 fallback, 아니면 [min, max]로 자른다 — 입력 칸의 ''·'-'·NaN을 여기서 흡수한다 */
export function clampNum(v: unknown, min: number, max: number, fallback = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** 원리금균등: 월 상환액 M으로 빌릴 수 있는 원금 L = M × (1−(1+r)^−n) / r */
export function loanFromPayment(monthly: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (n <= 0 || monthly <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r <= 0) return monthly * n;
  return monthly * (1 - Math.pow(1 + r, -n)) / r;
}

/** 원리금균등: 원금 L의 월 상환액 */
export function paymentFromLoan(loan: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (n <= 0 || loan <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r <= 0) return loan / n;
  return loan * r / (1 - Math.pow(1 + r, -n));
}

export type Num = number | string;
