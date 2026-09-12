// core/bonus/compare/payout-shape.ts — "부여액을 무엇으로 받나" 세 토막(현금 · 올해 풀리는 자사주 · 나중에 풀리는 몫).
//
// 하이닉스 결과 화면의 "삼성과 결정적으로 다른 점"과 ㉑ 두 회사 비교(S5b)가 같은 막대를 그린다 — 두 번째 반복이라
// 여기(core/bonus/compare/)에 둔다. 각 회사의 뷰 모델이 이미 낸 값을 **비율로 접기만** 한다(계산 판단 없음).
// 기준: 세후(소득세 기준) — 히어로가 보여주는 것과 같은 수. 세 정수 %의 합은 항상 100(최대 나머지 배분).
import { SAMSUNG_DEFAULTS, calcSamsungResult } from '../samsung/derive.ts';
import { buildSamsungResultView } from '../samsung/result-view.ts';
import type { SamsungInputs } from '../samsung/types.ts';

export interface PayoutShape {
  cash: number;        // 만원
  vestedNow: number;   // 만원 — 그 해 바로 풀리는 자사주
  later: number;       // 만원 — 뒤로 밀리는 몫
  total: number;       // = cash + vestedNow + later
  pct: { cash: number; vestedNow: number; later: number };   // 정수 %, 합 100(총액 0이면 전부 0)
}

/** 세 값을 합 100의 정수 %로 — 최대 나머지 방식(반올림 합이 99·101이 되는 것을 막는다) */
export function toPct100(parts: [number, number, number]): [number, number, number] {
  const total = parts.reduce((a, b) => a + b, 0);
  if (total <= 0) return [0, 0, 0];
  const raw = parts.map(p => (p / total) * 100);
  const floors = raw.map(Math.floor) as [number, number, number];
  let rest = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) { if (rest <= 0) break; floors[i] += 1; rest -= 1; }
  return floors;
}

export function payoutShape(cash: number, vestedNow: number, later: number): PayoutShape {
  const c = Math.max(0, Math.round(cash)), v = Math.max(0, Math.round(vestedNow)), l = Math.max(0, Math.round(later));
  const [pc, pv, pl] = toPct100([c, v, l]);
  return { cash: c, vestedNow: v, later: l, total: c + v + l, pct: { cash: pc, vestedNow: pv, later: pl } };
}

/**
 * 삼성전자(메모리 · 기본 가정)에서 같은 계약연봉이면 무엇으로 받나 — 하이닉스 화면의 대조 막대용.
 * 값은 삼성 뷰 모델 그대로: 현금 = OPI+TAI 세후 · 올해 풀림 = 부여 주식의 1/3 · 나중 = 2/3.
 * cms(운영 가정값)는 App이 넘기는 삼성 assumptions — 없으면 코드 기본값.
 */
export function samsungPayoutShape(salary: number, cms: Partial<SamsungInputs> | null = null): PayoutShape {
  const inputs: SamsungInputs = { ...SAMSUNG_DEFAULTS, ...(cms || {}), salary, year: 2026 } as SamsungInputs;
  const v = buildSamsungResultView({ inputs, results: calcSamsungResult(inputs), dept: 'mem' });
  return payoutShape(v.hero.cash, v.grant.vestedNow.val, v.grant.later.val);
}
