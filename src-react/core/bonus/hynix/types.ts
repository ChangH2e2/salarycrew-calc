// core/bonus/hynix/types.ts — SK하이닉스 성과급 계산의 입·출력 계약.
//
// 단위(경계 규칙: 부동소수점 금지, 단위는 도메인 타입이 말한다):
//   · 급여·성과급·세액           → **만원**. 화면에 내보내는 값은 정수로 반올림한다(중간 계산은 실수여도 된다)
//   · opTril*(영업이익)          → **조원**
//   · stockPrice(주식 기준가)    → **원** 정수 · null이면 주식 수를 계산하지 않는다(출처 있는 값만 — CLAUDE.md §2)
//   · *Rate·effRate              → 비율 0~1. 표시용 %는 UI가 한다
//   · h1·h2(PI 지급률)           → % 정수(0·75·100·150) — 옛 입력 계약 그대로

/** 연도별 영업이익 키 — 2026만 옛 호환으로 opTril, 나머지는 opTril2027 … (단위 조원) */
export type HynixOpKey = 'opTril' | `opTril${number}`;

/** 입력. 타이핑 중 값('', '-', '1.')이 섞여 들어오므로 숫자 칸은 string도 허용한다 — calcHynix가 0으로 떨어뜨린다. */
export interface HynixInputs {
  salary: number | string;            // 계약연봉(만원)
  avgSalary: number | string;         // 직원 평균연봉(만원) — PS 배분 분모
  headcount: number | string;         // 전체 인원(명)
  months: number | string;            // 첫해 근무 개월 0~12
  workMonthsByYear: Record<string, number | string>;
  h1: number; h2: number;             // PI 상·하반기 지급률(%)
  taxRate: number | string | null;    // 소득세율 직접 입력(%) · null이면 누진세 자동
  accumGrowth: number | string;       // 급여 인상률(% · 연 복리)
  accumYears: number | string;        // 누적 연수 3~10
  accumSalaryOverrides: Record<string, number>;
  stockPrice?: number | string | null; // 주식 기준가(원) — 임단협 잠정합의의 자사주 수량 환산용. 미확인 값이라 기본 null
  [op: `opTril${number}`]: number | string | undefined;
  opTril: number | string;
}

/** 2026 임단협 잠정합의 — PS 지급 수단 분해(data/calc-constants.json hynix.psPayout2026) */
export interface HynixPayoutPlan {
  status: 'tentative' | 'ratified' | string;
  effectiveFromYear: number;
  cashRatio: number;            // 당해 현금 (0.5)
  stockCurrentRatio: number;    // 당해 자사주 (0.3)
  stockDeferredRatio: number;   // 이연 자사주 (0.2) — 셋을 더하면 1, 주식 몫 합계는 0.5
  deferredTranches: { afterYears: number; ratio: number }[];
}

/** calc-bridge.calcHynix의 출력 — 금액 만원(실수), 비율 0~1 */
export interface HynixResult {
  psPoolT: number;         // PS 재원(조)
  psAvgMan: number;        // 1인 평균 PS(만원)
  psRate: number; piRate: number; grossRate: number; currentRate: number;   // 계약연봉 대비
  psMan: number;           // PS 발생(세전)
  piMan: number;           // PI(세전, 전액 현금)
  grossMan: number;        // PS + PI
  psDefer: number;         // 이연 20%(세전)
  psCashMan: number;       // 당해 현금분(세전)
  psStockMan: number;      // 당해 자사주분(세전)
  psPayoutPlan: HynixPayoutPlan | null;
  currentGross: number;    // 당해 지급 세전 = psMan × 0.8 + piMan
  deduct: number; net: number; effRate: number;   // effRate는 4대보험 포함 %(0~100) — 옛 계약
  incomeTaxRaw?: number;   // 반올림 전 소득세 — 토막 배분 전용(표시는 deductDetail.incomeTax)
  deductDetail: { incomeTax: number; health: number; emp: number; total: number };
}
