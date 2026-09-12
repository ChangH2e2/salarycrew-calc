// core/bonus/semco/curve.ts — ⓪ 조건 바의 영업이익 곡선: OP 격자마다 "올해 내 성과급, 세후로"를 샘플링한다.
//
// 삼성·하이닉스 curve.ts와 같은 규약 — 점 하나하나가 derive.calcSemcoResult를 그대로 부른 값이고, 합계 식은
// result-view의 heroTotal과 **같은 함수**다(현재 OP에서 곡선 값 = 히어로 값, tests/semco-result-view.test.mjs).
// 삼성전기 OPI는 허들이 없지만 **지급률 상한**(calcSemco의 opiRateCap)이 있어 곡선이 어느 지점부터 평평해진다 — 그 판단도 derive의 것.
// 단위: op 조원(소수 첫째 자리 격자) · total 만원 정수.
import { calcSemcoResult, getActiveSemcoYears, semcoOpKey } from './derive.ts';
import { heroTotal, heroParts } from './result-view.ts';
import type { SemcoInputs } from './types.ts';

export interface CurvePoint { op: number; total: number; totalPre: number; eligible: boolean }
export interface CurveOptions { min?: number; max?: number; step?: number }

/** 표시 범위 — 기본 가정 1.64조(2026)를 가운데 두고 0.5~4조, 0.1조 격자 */
export const CURVE_DEFAULT: Required<CurveOptions> = { min: 0.5, max: 4, step: 0.1 };

const r1 = (n: number) => Math.round(n * 10) / 10;

function firstOpKey(inputs: SemcoInputs) {
  return semcoOpKey(getActiveSemcoYears(inputs)[0] ?? 2026);
}

export function sampleHeroCurve(inputs: SemcoInputs, opts: CurveOptions = {}): CurvePoint[] {
  const { min, max, step } = { ...CURVE_DEFAULT, ...opts };
  const key = firstOpKey(inputs);
  const out: CurvePoint[] = [];
  const n = Math.round((max - min) / step);
  for (let i = 0; i <= n; i++) {
    const op = r1(min + i * step);
    const r = calcSemcoResult({ ...inputs, [key]: op });
    out.push({ op, total: heroTotal(inputs, r), totalPre: heroParts(r, true).total, eligible: true });
  }
  return out;
}

/** 곡선 위 한 점 — 조건 바가 손잡이 값을 바꿀 때 쓴다 */
export function heroAtOp(inputs: SemcoInputs, op: number): CurvePoint {
  const key = firstOpKey(inputs);
  const r = calcSemcoResult({ ...inputs, [key]: op });
  return { op, total: heroTotal(inputs, r), totalPre: heroParts(r, true).total, eligible: true };
}

/** 격자에 맞춘 값 — 슬라이더 step 밖 값은 밑줄 입력으로만 넣는다 */
export function snapOp(op: number, opts: CurveOptions = {}): number {
  const { min, max, step } = { ...CURVE_DEFAULT, ...opts };
  const clamped = Math.max(min, Math.min(max, op));
  return r1(Math.round((clamped - min) / step) * step + min);
}
