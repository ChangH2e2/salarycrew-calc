// grades.js — 직급/급여체계 도메인 규칙 (단일 출처)
// 직급별 성과급 배율(mul)은 계산 도메인 규칙이므로 UI가 아닌 core에 둔다.
// UI(드롭다운)는 이 GRADES를 읽기만 한다.
// CL3·CL2는 CL4 일반과 배율 동일(×1.0)이므로 연봉제 일반으로 통합.
// 구 값('cl3','cl2','cl4-low') → getGradeMul 기본값 1.0으로 하위 호환.
// `short`는 좁은 자리(연도별 표 드롭다운)용 — 라벨을 화면에서 자르지 않고 **여기서 정한다**.
// 배율은 남긴다: 그게 이 선택이 결과를 어떻게 바꾸는지 말해 주는 유일한 단서다(사용자 2026-09-10 "글자 좀 줄이고").
export const GRADES = [
  { value: 'cl4-top', label: '연봉제 상위 (×1.4)', short: '상위×1.4', mul: 1.4 },
  { value: 'cl4-mid', label: '연봉제 중위 (×1.2)', short: '중위×1.2', mul: 1.2 },
  { value: 'cl4-low', label: '연봉제 일반 (×1.0)', short: '일반×1',   mul: 1.0 },
  { value: 'monthly', label: '비연봉제 (월급)',     short: '월급제',   mul: 1.0 },
];

export function getGradeMul(grade) {
  return GRADES.find(g => g.value === grade)?.mul ?? 1.0;
}
