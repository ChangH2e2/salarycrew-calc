// core/bonus/samsung/labels.ts — 사업부·직급 표시 이름의 단일 출처.
// 옛 위치: components/DeptResultTabs.jsx의 DEPTS(라벨이 UI에 살았다). 뷰 모델(result-view.ts)이
// 라벨을 써야 하는데 core는 components를 못 본다(경계 규칙) — 그래서 여기로 내렸고 컴포넌트가 가져다 쓴다.
import { GRADES } from '../../grades.js';
import type { Dept, Grade } from './types.ts';

export const DEPTS: ReadonlyArray<{ id: Dept; label: string }> = [
  { id: 'mem', label: '메모리' },
  { id: 'com', label: '공통' },
  { id: 'fnd', label: '파운드리' },
  { id: 'lsi', label: 'S.LSI' },
];

export function deptLabel(dept: Dept): string {
  return DEPTS.find(d => d.id === dept)?.label ?? '메모리';
}

/** '연봉제 일반 (×1.0)' → '연봉제 일반'. 배율은 산식 줄이 따로 말한다. */
export function gradeLabel(grade: Grade): string {
  const raw: string = (GRADES as ReadonlyArray<{ value: string; label: string }>).find(g => g.value === grade)?.label ?? '';
  return raw.replace(/\s*\(.*\)\s*$/, '');
}
