// core/bonus/hynix/curve.ts — ⓪ 조건 바의 영업이익 곡선: OP 격자마다 "올해 내 성과급, 세후로"를 샘플링한다.
//
// 계산 판단은 없다 — 점 하나하나가 derive.calcHynixResult를 그대로 부른 값이고, 합계 식은 result-view의 heroTotal과
// **같은 함수**다(현재 OP에서 곡선 값 = 히어로 값이 항등식, tests/hynix-result-view.test.mjs). 하이닉스 PS는 허들이 없어
// 곡선이 꺾이지 않는다 — 재원이 OP에 비례하고 PI는 OP와 무관한 상수항이다.
// 단위: op 조원 · total 만원 정수.
import { calcHynixResult, getActiveHynixYears, hynixOpKey } from './derive.ts';
import { heroTotal, heroParts } from './result-view.ts';
import type { HynixInputs } from './types.ts';

export interface CurvePoint { op: number; total: number; totalPre: number; eligible: boolean }
export interface CurveOptions { min?: number; max?: number; step?: number }

/** 표시 범위 — 기본 가정 256조(2026)·380조(2027~)를 가운데 두고, assumptions 스키마 상한(500)까지 */
export const CURVE_DEFAULT: Required<CurveOptions> = { min: 100, max: 500, step: 10 };

function firstOpKey(inputs: HynixInputs) {
  return hynixOpKey(getActiveHynixYears(inputs)[0] ?? 2026);
}

export function sampleHeroCurve(inputs: HynixInputs, opts: CurveOptions = {}): CurvePoint[] {
  const { min, max, step } = { ...CURVE_DEFAULT, ...opts };
  const key = firstOpKey(inputs);
  const out: CurvePoint[] = [];
  for (let op = min; op <= max + 1e-9; op += step) {
    const r = calcHynixResult({ ...inputs, [key]: op });
    out.push({ op, total: heroTotal(inputs, r), totalPre: heroParts(r, true).total, eligible: true });
  }
  return out;
}

/** 곡선 위 한 점 — 조건 바가 손잡이 값을 바꿀 때 쓴다 */
export function heroAtOp(inputs: HynixInputs, op: number): CurvePoint {
  const key = firstOpKey(inputs);
  const r = calcHynixResult({ ...inputs, [key]: op });
  return { op, total: heroTotal(inputs, r), totalPre: heroParts(r, true).total, eligible: true };
}

/** 격자에 맞춘 값 — 슬라이더 step 밖 값은 밑줄 입력으로만 넣는다 */
export function snapOp(op: number, opts: CurveOptions = {}): number {
  const { min, max, step } = { ...CURVE_DEFAULT, ...opts };
  const clamped = Math.max(min, Math.min(max, op));
  return Math.round((clamped - min) / step) * step + min;
}
