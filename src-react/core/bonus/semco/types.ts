// core/bonus/semco/types.ts — 삼성전기 성과급 계산의 입·출력 계약.
//
// 단위(경계 규칙: 부동소수점 금지, 단위는 도메인 타입이 말한다):
//   · 급여·성과급·세액   → **만원**. 화면에 내보내는 값은 정수로 반올림한다
//   · opTril*(영업이익)  → **조원**. 삼성전기는 1~3조 단위라 소수 둘째 자리까지 쓴다(1.64조)
//   · *Rate              → 비율 0~1. 표시용 %는 UI가 한다
//   · h1·h2(TAI 지급률)  → % 정수(0·50·75·100 … 300)
// 하이닉스와 같은 calc-bridge 출력 이름(psMan·piMan)을 그대로 쓴다 — 뜻은 OPI·TAI다. 이름을 바꾸면
// calc-bridge 골든([4b])과 어긋나므로 뷰 모델(result-view.ts)에서만 OPI·TAI로 부른다.
import type { Grade } from '../samsung/types.ts';

export type SemcoOpKey = 'opTril' | `opTril${number}`;
export type { Grade as SemcoGrade };

/** 입력. 타이핑 중 값('', '-', '1.')이 섞여 들어오므로 숫자 칸은 string도 허용한다 — calcSemco가 0으로 떨어뜨린다. */
export interface SemcoInputs {
  grade: Grade;                       // 연봉제 상위·중위·일반 · 비연봉제(월급)
  salary: number | string;            // 계약연봉(만원) · 월급제면 월급(만원)
  avgSalary: number | string;         // 직원 평균연봉(만원) — OPI 지급률 분모
  headcount: number | string;         // 전체 인원(명)
  months: number | string;            // 첫해 근무 개월 0~12
  workMonthsByYear: Record<string, number | string>;
  h1: number; h2: number;             // TAI 상·하반기 지급률(%)
  taxRate: number | string | null;    // 소득세율 직접 입력(%) · null이면 누진세 자동
  accumGrowth: number | string;       // 급여 인상률(% · 연 복리)
  accumYears: number | string;        // 누적 연수 3~10
  accumSalaryOverrides: Record<string, number>;
  [op: `opTril${number}`]: number | string | undefined;
  opTril: number | string;
}

/** calc-bridge.calcSemco의 출력 — 금액 만원(실수), 비율 0~1 */
export interface SemcoResult {
  psPoolT: number;         // OPI 재원(조) = 영업이익 × 10%
  psAvgMan: number;        // 1인 평균 OPI(만원)
  psRate: number; piRate: number; grossRate: number; currentRate: number;   // 급여 대비
  psMan: number;           // OPI(세전)
  piMan: number;           // TAI(세전)
  grossMan: number;        // OPI + TAI
  psDefer: number;         // 항상 0 — 삼성전기는 이연이 없다
  currentGross: number;    // = grossMan
  deduct: number; net: number; effRate: number;   // effRate는 4대보험 포함 %(0~100)
  opiRateRaw: number;      // 상한 적용 전 지급률(평균연봉 대비)
  opiRateCap: number;      // 상한 적용 후 — 기준 급여에 곱하는 배율
  gradeMul: number;        // 직급 배율(연봉제만)
  taiBase: number;         // TAI 기준액(만원) — 연봉 ÷ 20 · 월급 − 20
  deductDetail: { incomeTax: number; health: number; emp: number; total: number };
}
