// core/bonus/shared/format.ts — 성과급 화면 공통 숫자 조판(순수 함수).
// 삼성 결과·조건 바·입력, 하이닉스 결과가 같은 fmt/eokMan/fmtM을 네 벌 들고 있었다(두 번째 반복을 지나 네 번째) — 여기 하나로.
// 단위는 부르는 쪽이 안다: 이 함수들은 **만원 정수**를 받는다.

export const fmt = (n: number | string | null | undefined): string => Math.round(Number(n) || 0).toLocaleString('ko-KR');

/** 억·만 표기 — 히어로는 "2억 4,654" + 단위 "만원"으로 갈라 조판한다(단위는 한 단 아래) */
export function eokMan(n: number | string | null | undefined): { text: string; unit: string } {
  const v = Math.abs(Math.round(Number(n) || 0));
  const eok = Math.floor(v / 10000), man = v % 10000;
  if (eok > 0) return man > 0 ? { text: `${fmt(eok)}억 ${fmt(man)}`, unit: '만' } : { text: `${fmt(eok)}억`, unit: '' };
  return { text: fmt(man), unit: '만' };
}

export const fmtM = (n: number | string | null | undefined): string => { const { text, unit } = eokMan(n); return text + unit; };

/** 막대 라벨처럼 **좁고 여럿이 나란히 서는 자리** — 다섯 자리를 넘으면 억 소수 둘째로 접는다.
 *  23,140 → "2.31억" · 4,231 → "4,231만". 뒤따르는 0은 떼어 1.10억이 아니라 1.1억으로 적는다.
 *  `fmtCompact`(표 칸)와 다른 이유: 표는 만원 축을 유지해야 열끼리 비교되지만,
 *  막대 라벨은 서로 부딪히지 않는 것이 먼저다. 정확한 값은 늘 아래 표에 있다(사용자 2026-09-10).
 *  두 번째 자리(YearBars · 공유 이미지)에서 쓰이며 여기로 올라왔다. */
export const shortMan = (n: number | string | null | undefined): string => {
  const v = Math.round(Number(n) || 0);
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(2).replace(/\.?0+$/, '')}억`;
  return `${fmt(v)}만`;
};

export const fmtSigned = (n: number): string => `${n < 0 ? '−' : '+'}${fmtM(Math.abs(n))}`;

/** 비율 0~1 → '39.4%' */
export const pct = (r: number, d = 1): string => `${((Number(r) || 0) * 100).toFixed(d)}%`;

/** 좁은 칸(모바일 표)용 압축 표기 — 만원 축을 유지한 채 억만 접는다.
 *  22,637 → "2억2,637" · 1,696 → "1,696". 머리의 "단위 만원"이 그대로 유효하다.
 *  왜 필요한가: 390px 5열 표에 "2억 2,637만"(공백·만 포함)은 안 들어가는데,
 *  만원 그대로 두면 자릿수만 늘어선 숫자라 읽히지 않는다(사용자 2026-09-07). */
export const fmtCompact = (n: number | string | null | undefined): string => {
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a < 10000) return sign + a.toLocaleString('ko-KR');
  const eok = Math.floor(a / 10000);
  const man = a % 10000;
  return `${sign}${eok}억${man ? man.toLocaleString('ko-KR') : ''}`;
};
