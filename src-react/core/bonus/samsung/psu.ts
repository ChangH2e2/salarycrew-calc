// core/bonus/samsung/psu.ts — PSU(Performance Stock Unit) 도출. 순수 함수.
//
// 왜 별도 파일인가: PSU는 OPI·TAI·특별성과급과 **재원이 다르다**. 성과급 산식(영업이익 → 재원 →
// 사업부 → 개인)을 한 줄도 공유하지 않고, 주가 상승률만으로 지급배수가 정해진다. derive.ts에
// 섞으면 "제2의 계산 엔진"이 된다(§10) — 그래서 입력도 출력도 여기서 닫는다.
//
// 2026-09-09: 옛 PsuCalc.jsx(별도 탭)를 결과 화면 안으로 녹이며 옮겼다. 사용자 결정:
// "PSU도 성과급 페이지에서 자연스럽게 녹일 것"(ASK #8) · 약정 그룹과 기준주가는 고급 설정에서.
//
// 단위: 가격은 **원** 정수 · 금액은 **만원** 정수(types.ts의 규칙 그대로).
import { getPsuMultiplier, PSU_RULES, splitShares3Y } from '../../calc-bridge.js';

export type PsuGroupKey = 'none' | 'cl12' | 'cl34';

/** 약정 그룹 — 회사가 공개한 값이 아니라 통용되는 CL 구간별 약정 주수다(옛 PsuCalc의 GRANT_GROUPS). */
export const PSU_GROUPS: readonly { key: PsuGroupKey; label: string; shares: number }[] = [
  { key: 'cl12', label: 'CL1·CL2', shares: 200 },
  { key: 'cl34', label: 'CL3·CL4', shares: 300 },
];

export interface PsuInputs {
  psuGroup?: PsuGroupKey;
  psuBasePrice?: number | string;   // 원 — 약정 시점 기준가
  psuPrice?: number | string | null; // 원 — 평가 기준가(주가 봇의 psu_price = 1주·1개월·2개월 VWAP의 평균)
  psuTaxRate?: number | string | null;  // % — null이면 결과 화면의 소득세(실효세율)를 그대로 쓴다
  psuMaturity?: string;             // 'YYYY-MM-DD' — 화면에 입력을 두지 않는다(사용자 2026-09-07). 상수로만 산다
}

export const PSU_DEFAULTS: Omit<PsuInputs, 'psuPrice' | 'psuTaxRate'> & { psuPrice: number | null; psuTaxRate: number | null } = {
  psuGroup: 'cl12',        // 기본 CL1·CL2 200주(사용자 2026-09-09). '해당 없음'을 고르면 절이 사라진다
  psuBasePrice: 85385,
  psuPrice: null,          // 주가 봇이 채운다(psu_price). 없으면 절을 그리지 않는다 — 출처 없는 값은 안 쓴다(§2)
  psuTaxRate: null,   // 소득세를 따라간다 — PSU만 다른 세율을 쓸 근거가 없다(사용자 2026-09-07)
  psuMaturity: '2028-10-13',
};

export interface PsuYearRow { year: number; shares: number; grossMan: number; netMan: number }
export interface PsuStep { thresholdPct: number; multiplier: number; targetPrice: number; active: boolean }

export interface PsuView {
  groupKey: PsuGroupKey;
  groupLabel: string;
  contractShares: number;   // 약정 주수
  basePrice: number;        // 원
  price: number;            // 원
  priceIsAuto: boolean;
  returnPct: number;        // % (198.9)
  multiplier: number;       // 2.0
  atTop: boolean;           // 마지막 구간인가 — "더 올라도 배수는 그대로"
  grantedShares: number;
  grossMan: number;         // 당해 가치(만원)
  netMan: number;           // 세후(만원)
  taxRate: number;          // %
  maturityYear: number;
  years: PsuYearRow[];      // 만기부터 3년, 3분할
  steps: PsuStep[];         // 지급배수 구간표
  /** 다른 그룹도 표에 함께 보여주기 위한 요약 */
  others: { label: string; grantedShares: number; grossMan: number; netMan: number }[];
}

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** 만기일에서 3년 분할 수령 연도 — 만기 해부터 세 해. */
export function psuYears(maturity: string | undefined): number[] {
  const y = parseInt(String(maturity || PSU_DEFAULTS.psuMaturity).slice(0, 4), 10);
  const base = Number.isFinite(y) ? y : 2028;
  return [base, base + 1, base + 2];
}

/**
 * PSU 도출. 약정이 없거나(기본) 기준주가를 못 받았으면 **null** — 화면은 절을 통째로 안 그린다.
 * 0원짜리 절을 그리는 것보다 없는 게 낫다(§2 "안 보여주는 게 낫다").
 */
export function derivePsu(inputs: PsuInputs = {}, fallbackTaxPct = 38): PsuView | null {
  const key = (inputs.psuGroup ?? PSU_DEFAULTS.psuGroup) as PsuGroupKey;
  const group = PSU_GROUPS.find(g => g.key === key);
  if (!group) return null;

  const basePrice = Math.max(1, Math.round(num(inputs.psuBasePrice, num(PSU_DEFAULTS.psuBasePrice))));
  const rawPrice = inputs.psuPrice == null || inputs.psuPrice === '' ? null : num(inputs.psuPrice, 0);
  if (rawPrice == null || rawPrice < 1) return null;      // 기준주가 없음 → 주식 수를 만들지 않는다
  const price = Math.round(rawPrice);

  const returnPct = (price / basePrice - 1) * 100;
  const rule = getPsuMultiplier(returnPct);
  const multiplier = rule.multiplier;
  const top = PSU_RULES[PSU_RULES.length - 1];
  const atTop = rule.threshold === top.threshold;

  const grantedShares = Math.floor(group.shares * multiplier);
  // 세율: 직접 넣은 값이 있으면 그것, 없으면 이 결과 화면의 소득세(실효세율)를 그대로 쓴다.
  const givenTax = inputs.psuTaxRate == null || inputs.psuTaxRate === '' ? null : num(inputs.psuTaxRate, NaN);
  const taxRate = Math.min(70, Math.max(0, Number.isFinite(givenTax as number) ? (givenTax as number) : fallbackTaxPct));
  const keep = 1 - taxRate / 100;
  const manOf = (shares: number) => Math.round(shares * price / 10000);

  const years = psuYears(inputs.psuMaturity as string | undefined);
  const split = splitShares3Y(grantedShares);
  const rows: PsuYearRow[] = years.map((year, i) => ({
    year,
    shares: split[i],
    grossMan: manOf(split[i]),
    netMan: Math.round(manOf(split[i]) * keep),
  }));

  const steps: PsuStep[] = PSU_RULES.map(r => ({
    thresholdPct: r.threshold,
    multiplier: r.multiplier,
    targetPrice: Math.round(basePrice * (1 + r.threshold / 100)),
    active: r.threshold === rule.threshold,
  }));

  const others = PSU_GROUPS.filter(g => g.key !== key).map(g => {
    const s = Math.floor(g.shares * multiplier);
    return { label: g.label, grantedShares: s, grossMan: manOf(s), netMan: Math.round(manOf(s) * keep) };
  });

  return {
    groupKey: key,
    groupLabel: group.label,
    contractShares: group.shares,
    basePrice,
    price,
    priceIsAuto: false,           // 화면이 자동값과 대조해 채운다
    returnPct,
    multiplier,
    atTop,
    grantedShares,
    grossMan: manOf(grantedShares),
    netMan: Math.round(manOf(grantedShares) * keep),
    taxRate,
    maturityYear: years[0],
    years: rows,
    steps,
    others,
  };
}
