// core/bonus/samsung/types.ts — 삼성 성과급 계산의 입·출력 계약.
//
// 왜 타입이 여기만 있나: §2 계산 오류 6건 중 타입이 잡았을 건 0건(전부 규제값·상한 누락)이다.
// 타입이 값어치 있는 곳은 "무엇이 들어오고 나가는가"가 흔들리는 계산 경계뿐이라
// core/ 안쪽만 TS로 간다(설계 2026-09-07 §2.2). UI는 JSX 그대로.
//
// 돈의 단위 — 이 파일이 명시한다(경계 규칙: 부동소수점 금지, 단위는 도메인 타입이 말한다):
//   · 급여·성과급·세액·평가액  → **만원**. 정수로 반올림해 내보낸다(중간 계산은 실수여도 된다)
//   · stockPrice(부여가)         → **원** 정수
//   · *Rate·effRate·workR        → 비율 0~1 (opiRateCap 0.5 = 50%). 표시용 % 변환은 UI가 한다
//   · h*(사업부 인원) · shares   → 명·주 (정수)

import type { PsuGroupKey } from './psu.ts';

export type Dept = 'mem' | 'com' | 'fnd' | 'lsi';
export type Grade = 'cl4-top' | 'cl4-mid' | 'cl4-low' | 'monthly';

/** 연도별 사업부 영업이익 키 — opMem2026 · opFnd2026 · opLsi2026 … (단위 조원) */
export type OpKey = `opMem${number}` | `opFnd${number}` | `opLsi${number}`;

export interface YearOps { mem: number; fnd: number; lsi: number }

/** 입력. UI가 타이핑 중인 값('', '-', '-1.')이 섞여 들어오므로 숫자 칸은 string도 허용하고
 *  num()이 0으로 떨어뜨린다 — 계산이 NaN을 내보내는 일이 없게. */
export interface SamsungInputs {
  grade: Grade;
  salary: number | string;          // 만원. 연봉제면 연봉, 비연봉제면 월급
  splitSalary: boolean;             // 계약연봉·업무성과급 분리 입력
  workBonus: number | string;       // 업무성과급(연간, 만원) — TAI 상여기초 제외
  avgSalary: number | string;       // 직원 평균연봉(만원) — 지급률 산출 분모
  months: number | string;          // 근무 개월 0~12
  hMem: number; hCom: number; hFnd: number; hLsi: number;   // 사업부 인원
  stockPrice: number;               // 원
  taxOverride: number | string | null;   // % (0~70). null이면 자동 누진세
  accumGrowth: number | string;     // 급여 인상률 %
  accumYears: number | string;      // 누적 연수 3~10
  accumSalaryOverrides: Record<string, number>;
  accumPayTypeOverrides: Record<string, string>;
  salaryByYear: Record<string, number | string>;
  gradeByYear: Record<string, Grade>;
  workMonthsByYear: Record<string, number | string>;
  /** 연도별 **근무제외일**(휴직·무급 등). OPI2(자사주)만 일할이라 이 값이 그 비율을 정한다.
   *  비우면 근무개월에서 환산한다 — 옛 입력만 있는 사람도 값이 안 바뀐다(사용자 2026-09-10) */
  exclDaysByYear: Record<string, number | string>;
  year: number;
  scenario: string;
  academic: Record<string, boolean>;
  taiH1Rate?: number | string;
  taiH2Rate?: number | string;
  taiBaseManual?: number | string;
  // PSU — 성과급 재원과 무관한 별도 약정(core/bonus/samsung/psu.ts가 닫는다).
  // psuGroup 'none'이 기본이라 대다수 화면에는 PSU 절 자체가 없다.
  psuGroup?: PsuGroupKey;
  psuBasePrice?: number | string;   // 원 — 약정 시점 기준가
  psuPrice?: number | string | null; // 원 — 평가 기준가(주가 봇 psu_price = 1주·1개월·2개월 VWAP 평균)
  psuTaxRate?: number | string | null;   // null이면 결과 화면의 소득세를 따라간다
  psuMaturity?: string;
  [op: OpKey]: number | string | undefined;
}

export interface DeductDetail {
  incomeTax: number; nps: number; emp: number; health: number; ltc: number; total: number;
}

/** 한 사업부의 한 해 결과. 금액은 전부 만원 정수. */
export interface DeptResult {
  opiPre: number; opiPost: number;
  spPre: number;  spPost: number;
  shares: number; stVal: number;
  effRate: number;          // OPI+특별성과급 합산 실효세율 0~1
  specialRate: number;      // 특별성과급 지급률 0~ (6.6787 = 667.87%)
  spWorkR: number;          // 학술연수 반영 근무비율 0~1
  spDivRate: number; spBizRate: number;
  spDetail: unknown;        // 산식 가이드용 풀 상세 — calc-bridge가 만든다
  academicOn: boolean;
  stockEligible: boolean;
  deduct: DeductDetail;
}

export interface SamsungResult {
  deptResults: Record<Dept, DeptResult>;
  eligible: boolean;
  dsOpT: number;            // DS 합계 영업이익(조)
  thresholdT: number;       // 허들(조) — 2028까지 200, 2029부터 100
  opiRateCap: number;       // 0~0.5 (비연봉제는 월급 배수 0~7)
  annualOpiRateCap: number;
  autoEffRate: number;      // % (메모리 기준 실효세율 × 100) — 고급 설정 자동값 표시용
  opiPaidTotalMW: number;
  bonusBaseMW: number;
  specialRates: unknown;
  ops: YearOps;
  workMonths: number;
}

export interface TaiPreview {
  rate1: number; rate2: number;     // % 0~300
  monthlyBase: number;              // 만원
  h1Pre: number; h2Pre: number;
  h1Post: number; h2Post: number;
  totalPost: number;
}
