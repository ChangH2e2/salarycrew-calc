// core/bonus/samsung/curve.ts — ⓪ 조건 바의 영업이익 곡선: OP 격자마다 "올해 내 성과급, 세후로"를 샘플링한다.
//
// 계산 판단은 하지 않는다 — 점 하나하나가 derive.calcSamsungResult를 그대로 부른 값이고, 합계 식은
// result-view의 heroTotal과 **같은 함수**다(현재 OP에서 곡선 값 = 히어로 값이 항등식으로 성립한다,
// tests/samsung-result-view.test.mjs). 허들 아래 구간은 특별성과급이 0이라 곡선이 꺾인다 — 그 판단도 derive의 것이다.
//
// 단위: op 조원 · total 만원 정수.
import { calcSamsungResult, opKeys } from './derive.ts';
import { heroTotal, heroTotalPre } from './result-view.ts';
import type { Dept, SamsungInputs } from './types.ts';

export interface CurvePoint { op: number; total: number; totalPre: number; eligible: boolean; eff: number | null }   // eff = 그 사업부의 실효세율(0~1) — 조건 바 상태 B "실효세율 39.4 → 38.6%"
export interface CurveOptions { min?: number; max?: number; step?: number }

/** 시안 인터랙션 스펙: 표시 범위 150~350조 · step 5조 */
export const CURVE_DEFAULT: Required<CurveOptions> = { min: 150, max: 350, step: 5 };

export function sampleHeroCurve(inputs: SamsungInputs, dept: Dept, opts: CurveOptions = {}): CurvePoint[] {
  const { min, max, step } = { ...CURVE_DEFAULT, ...opts };
  const key = opKeys(inputs.year).mem;
  const out: CurvePoint[] = [];
  for (let op = min; op <= max + 1e-9; op += step) {
    const r = calcSamsungResult({ ...inputs, [key]: op });
    out.push({ op, total: heroTotal(inputs, r, dept), totalPre: heroTotalPre(inputs, r, dept), eligible: r.eligible, eff: r.deptResults?.[dept]?.effRate ?? null });
  }
  return out;
}

/** 곡선 위 한 점 — 조건 바가 손잡이 값을 바꿀 때 쓴다 */
export function heroAtOp(inputs: SamsungInputs, dept: Dept, op: number): CurvePoint {
  const key = opKeys(inputs.year).mem;
  const r = calcSamsungResult({ ...inputs, [key]: op });
  return { op, total: heroTotal(inputs, r, dept), totalPre: heroTotalPre(inputs, r, dept), eligible: r.eligible, eff: r.deptResults?.[dept]?.effRate ?? null };
}

/** 격자에 맞춘 값 — 슬라이더 step 밖 값은 밑줄 입력으로만 넣는다(스펙) */
export function snapOp(op: number, opts: CurveOptions = {}): number {
  const { min, max, step } = { ...CURVE_DEFAULT, ...opts };
  const clamped = Math.max(min, Math.min(max, op));
  return Math.round((clamped - min) / step) * step + min;
}
