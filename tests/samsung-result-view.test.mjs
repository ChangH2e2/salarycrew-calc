// samsung-result-view.test.mjs — ① 성과급 결과 화면 뷰 모델의 골든값 + 항등식.
//
// 값 하나가 맞는 테스트 + **값끼리의 관계**가 맞는 테스트(설계 2026-09-07 §4).
// 골든값은 시안(캔버스 ①Main)과 계산기 기본값이 2026년에 정확히 일치함을 드라이런으로 확인한 값이다.
// 2027~2028은 시안이 메모리 OP 450조를 가정해 다르므로 값이 아니라 관계만 잰다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMSUNG_DEFAULTS, calcSamsungResult } from '../src-react/core/bonus/samsung/derive.ts';
import { buildSamsungResultView, buildSamsungComparisonView, heroTotal } from '../src-react/core/bonus/samsung/result-view.ts';
import { HYNIX_DEFAULTS, calcHynixResult } from '../src-react/core/bonus/hynix/derive.ts';
import { buildHynixResultView } from '../src-react/core/bonus/hynix/result-view.ts';
import { sampleHeroCurve, heroAtOp, snapOp } from '../src-react/core/bonus/samsung/curve.ts';

// 이 파일의 골든은 **기본값 골든**이다 — 지금 기본값이 무엇을 내는지 적어 두는 것이 그 일이다.
// 운영값의 진짜 소스는 CMS라(§1) 사람이 대시보드에서 바꾸면 여기 기대값도 같이 옮긴다
// (`0f6b454f`의 분류: 계산 골든은 입력 고정, 기본값 골든은 기대값 이동).
// 일부만 고정하면 **교차 참조가 어긋난다** — compare-view·hynix-result-view가 이 파일의 값을
// 되읽으므로, 한쪽만 300에 묶으면 다른 쪽 350과 충돌한다(2026-09-11에 실제로 그랬다).
const BASE = SAMSUNG_DEFAULTS;

const view = (inputs = BASE, dept = 'mem') =>
  buildSamsungResultView({ inputs, results: calcSamsungResult(inputs), dept });

test('골든: 기본값(2026 · 메모리 · 연봉제 일반 · 5,600만 · 메모리 OP 350조 · 부여가 255,000)', () => {
  const v = view();
  assert.equal(v.condition.deptLabel, '메모리');
  assert.equal(v.condition.gradeLabel, '연봉제 일반');
  assert.equal(v.condition.salary, 5600);
  assert.equal(v.condition.opMem, 350);
  assert.equal(v.hero.opi, 1679);
  assert.equal(v.hero.tai, 302);
  assert.equal(v.hero.cash, 1981);
  assert.equal(v.hero.shares, 1028);
  assert.equal(v.hero.stockVal, 26214);
  assert.equal(v.hero.total, 28195);
  assert.equal(v.grant.vestedNow.shares, 343);
  assert.equal(v.grant.vestedNow.val, 8747);
  assert.equal(v.grant.vestedNow.pct, 33);
  assert.equal(v.grant.later.shares, 685);
  assert.equal(v.grant.later.val, 17467);
  assert.equal(v.grant.later.pct, 67);
  assert.equal(v.cashableNow, 10728);
  assert.equal(Math.round(v.formula.tax.opiSp * 1000) / 10, 40.1);
  assert.equal(Math.round(v.formula.tax.tai * 1000) / 10, 46.1);
  assert.equal(Math.round(v.formula.sp.rate * 10000) / 100, 781.18);
  assert.equal(v.formula.opi.rate, 0.5);
  assert.equal(v.formula.opi.pre, 2800);
  assert.equal(v.formula.tai.monthlyBase, 280);
  assert.equal(v.formula.tai.pre, 560);
});

test('항등식: 히어로 = 현금 + 주식 · 현금 = OPI + TAI · 주식 = 올해 풀림 + 나중 풀림 · 현금화 가능 = 현금 + 올해 풀림', () => {
  for (const dept of ['mem', 'com', 'fnd', 'lsi']) {
    const v = view(BASE, dept);
    assert.equal(v.hero.total, v.hero.cash + v.hero.stockVal, dept);
    assert.equal(v.hero.cash, v.hero.opi + v.hero.tai, dept);
    assert.equal(v.grant.val, v.hero.stockVal, dept);
    assert.equal(v.grant.vestedNow.val + v.grant.later.val, v.grant.val, dept);
    assert.equal(v.grant.vestedNow.shares + v.grant.later.shares, v.grant.shares, dept);
    assert.equal(v.grant.vestedNow.pct + v.grant.later.pct, v.grant.shares > 0 ? 100 : 0, dept);
    // 2·3년차 각각(laterByYear)의 합 = later — 화면이 두 줄·두 빗금으로 나눠 그려도 총량은 같다
    assert.equal(v.grant.laterByYear.length, 2, dept);
    assert.equal(v.grant.laterByYear.reduce((a, r) => a + r.shares, 0), v.grant.later.shares, dept);
    assert.equal(v.grant.laterByYear.reduce((a, r) => a + r.val, 0), v.grant.later.val, dept);
    assert.equal(v.grant.laterByYear.reduce((a, r) => a + r.pct, 0), v.grant.later.pct, dept);
    assert.equal(v.cashableNow, v.hero.cash + v.grant.vestedNow.val, dept);
  }
});

test('항등식: 3개년 첫 행은 히어로와 같은 수 · 행마다 소계 = OPI+TAI+주식, 합계 = OPI+TAI+풀림 · 누적은 행의 합', () => {
  const v = view();
  const [r0] = v.threeYear.rows;
  assert.equal(r0.year, v.condition.year);
  assert.equal(r0.opi, v.hero.opi);
  assert.equal(r0.tai, v.hero.tai);
  assert.equal(r0.stockVal, v.hero.stockVal);
  assert.equal(r0.subtotal, v.hero.total);
  assert.equal(r0.received, v.cashableNow);
  for (const r of v.threeYear.rows) {
    assert.equal(r.subtotal, r.opi + r.tai + r.stockVal, String(r.year));
    assert.equal(r.received, r.opi + r.tai + r.vested, String(r.year));
  }
  const t = v.threeYear.totals;
  const sum = (k) => v.threeYear.rows.reduce((a, r) => a + r[k], 0);
  for (const k of ['opi', 'tai', 'stockVal', 'subtotal', 'vested', 'received', 'shares', 'vestedShares']) {
    assert.equal(t[k], sum(k), k);
  }
  assert.equal(v.threeYear.deferred, t.subtotal - t.received);
  assert.equal(v.threeYear.deferred, t.stockVal - t.vested);
  assert.equal(v.threeYear.deferredShares, t.shares - t.vestedShares);
});

test('항등식: 매트릭스 — 행의 3칸 합 = 부여 주식 · 창 안 연도 합 = 그 해 풀린 주식 · 창 밖 합 = 이월 주식 ≈ 차액', () => {
  // 창을 3년으로 **고정**한다 — 이 테스트가 재는 것은 항등식이지 기본 연수가 아니다.
  // 기본값(2026-09-10에 3→5)에 매달아 두면 제품 판단이 바뀔 때마다 뜻 없이 깨진다.
  const v = view({ ...BASE, accumYears: 3 });
  const { rows, vestYears, totalsByYear, beyondShares } = v.vestMatrix;
  const last = v.threeYear.years[v.threeYear.years.length - 1];
  assert.deepEqual(vestYears, [2026, 2027, 2028, 2029, 2030]);
  for (const m of rows) {
    const cells = Object.values(m.byYear).reduce((a, n) => a + n, 0);
    assert.equal(cells, m.shares, String(m.grantYear));
  }
  for (const r of v.threeYear.rows) {
    assert.equal(totalsByYear[r.year], r.vestedShares, String(r.year));
  }
  const beyond = vestYears.filter(y => y > last).reduce((a, y) => a + totalsByYear[y], 0);
  assert.equal(beyondShares, beyond);
  assert.equal(beyondShares, v.threeYear.deferredShares);
  // 주식 수 × 부여가와 만원 차액은 절사 때문에 행 수만큼 어긋날 수 있다 — 그 이상이면 관계가 깨진 것
  const beyondVal = Math.round(beyondShares * v.grant.price / 10000);
  assert.ok(Math.abs(beyondVal - v.threeYear.deferred) <= v.threeYear.rows.length,
    `이월 주식 환산 ${beyondVal} vs 차액 ${v.threeYear.deferred}`);
});

test('허들 미달이면 주식이 0이고 관계는 그대로 성립한다 (메모리 OP 100조)', () => {
  const inputs = { ...SAMSUNG_DEFAULTS, opMem2026: 100 };
  const v = view(inputs);
  assert.equal(v.formula.premise.eligible, false);
  assert.equal(v.hero.shares, 0);
  assert.equal(v.hero.stockVal, 0);
  assert.equal(v.hero.total, v.hero.cash);
  assert.equal(v.cashableNow, v.hero.cash);
  assert.equal(v.grant.vestedNow.pct + v.grant.later.pct, 0);
});

test('비연봉제(월급)에서도 산식 재료의 단위 라벨이 바뀌고 관계는 유지된다', () => {
  const inputs = { ...BASE, grade: 'monthly', salary: 250 };
  const v = view(inputs);
  assert.equal(v.condition.isMonthly, true);
  assert.equal(v.condition.gradeLabel, '비연봉제');
  assert.equal(v.formula.opi.baseLabel, '월급');
  assert.equal(v.hero.total, v.hero.cash + v.hero.stockVal);
  assert.equal(v.cashableNow, v.hero.cash + v.grant.vestedNow.val);
});

test('곡선: 현재 OP의 점 = 히어로 · 격자 41점 · 허들 아래는 eligible false · 단조 증가(허들 위)', () => {
  const v = view();
  const pts = sampleHeroCurve(BASE, 'mem');
  assert.equal(pts.length, 41);
  assert.equal(pts[0].op, 150); assert.equal(pts[40].op, 350);
  // **현재 OP를 숫자로 박지 않는다** — 재려는 것은 "곡선의 그 점 = 히어로"라는 항등식이지
  // 기본값이 300이냐 350이냐가 아니다(2026-09-11에 CMS가 350으로 바뀌며 깨졌다).
  const curOp = v.condition.opMem;
  const atCur = pts.find(p => p.op === curOp);
  assert.equal(atCur.total, v.hero.total);
  assert.equal(heroAtOp(BASE, 'mem', curOp).total, v.hero.total);
  assert.equal(heroTotal(SAMSUNG_DEFAULTS, calcSamsungResult(SAMSUNG_DEFAULTS), 'mem'), v.hero.total);
  // 허들은 DS 합계(메모리 + 파운드리 −1.5 + S.LSI −0.5) 기준 — 메모리 200조는 DS 198조라 미달, 205조부터 충족
  const firstOk = pts.find(p => p.eligible);
  assert.equal(firstOk.op, 205);
  assert.equal(pts.find(p => p.op === 200).eligible, false);
  const above = pts.filter(p => p.eligible);
  for (let i = 1; i < above.length; i++) assert.ok(above[i].total >= above[i - 1].total, `${above[i].op}조에서 감소`);
  assert.equal(snapOp(303), 305); assert.equal(snapOp(100), 150); assert.equal(snapOp(999), 350);
});


test('삼성 비교 막대: 현재 사업부의 부여액·현금화 가능액과 항등, 하이닉스 CMS와 같은 연봉 반영', () => {
  const inputs = { ...SAMSUNG_DEFAULTS, salary: 7300, opMem: 350 };
  const cms = { opTril: 256, avgSalary: 9000, headcount: 34000 };
  for (const dept of ['mem', 'foundry', 'lsi']) {
    const v = view(inputs, dept);
    const c = buildSamsungComparisonView(inputs, v, cms);
    assert.equal(c.samsung.total, Math.round(v.hero.cash) + Math.round(v.hero.stockVal));
    assert.equal(c.samsung.cash + c.samsung.vestedNow, Math.round(v.cashableNow));
    assert.equal(Object.values(c.samsung.pct).reduce((a, b) => a + b), c.samsung.total ? 100 : 0);
    const hxInputs = { ...HYNIX_DEFAULTS, ...cms, salary: 7300 };
    const hx = buildHynixResultView({ inputs: hxInputs, results: calcHynixResult(hxInputs) });
    assert.deepEqual(c.hynix, hx.shape.hynix);
    assert.deepEqual(c.plan, hx.plan);
    assert.equal(c.hynix.total, hx.hero.total + hx.hero.deferredPost);
  }
});

test('삼성 비교 막대: 월급제는 연봉으로 환산하며 PSU 약정을 비교 성과급에 섞지 않는다', () => {
  const inputs = { ...SAMSUNG_DEFAULTS, grade: 'monthly', salary: 400, psuGroup: 'cl12', psuPrice: 300000, psuBasePrice: 100000 };
  const v = view(inputs);
  const c = buildSamsungComparisonView(inputs, v);
  assert.ok(v.psu?.netMan > 0);
  assert.equal(c.salary, 4800);
  assert.equal(c.samsung.total, Math.round(v.hero.cash) + Math.round(v.grant.val));
});

// 2026-09-07: "세금 어떻게 뗐나" 접힘(components/TaxBreakdown)이 회사 공통으로 붙었다.
// 이건 **설명**이지 계산이 아니다 — 기존 세금 함수와 값이 어긋나면 화면에 두 개의 진실이 생긴다.
test('세금 설명은 계산을 바꾸지 않는다 — bonusTaxDeducted와 전 조합 일치', async () => {
  const { explainBonusTax } = await import('../src-react/core/bonus/shared/tax-explain.ts');
  const { bonusTaxDeducted } = await import('../src-react/core/calc-bridge.js');
  let checked = 0;
  for (let pay = 2000; pay <= 20000; pay += 500) {
    for (let bonus = 500; bonus <= 60000; bonus += 1500) {
      const expected = Math.round(bonusTaxDeducted(pay, bonus));
      const got = explainBonusTax(pay, bonus).total;
      assert.ok(Math.abs(expected - got) <= 1,
        `연봉 ${pay} · 성과급 ${bonus}: 기존 ${expected} ≠ 설명 ${got}`);
      checked++;
    }
  }
  assert.ok(checked > 1000, `조합이 ${checked}건뿐 — 루프가 도는지 확인하라`);
});

test('세금 설명의 단계가 서로 맞는다 — 지방세 10% · 합계 = 소득세 + 지방세 · 실효세율', async () => {
  const { explainBonusTax } = await import('../src-react/core/bonus/shared/tax-explain.ts');
  for (const [pay, bonus] of [[6000, 24000], [3000, 500], [12000, 60000]]) {
    const e = explainBonusTax(pay, bonus);
    assert.equal(e.localTax, Math.round(e.incomeTax * 0.1), '지방소득세는 소득세의 10%');
    assert.equal(e.total, e.incomeTax + e.localTax);
    assert.equal(e.net, e.bonusPre - e.total);
    assert.equal(e.effPct, Math.round(e.total / e.bonusPre * 1000) / 10);
    // 마지막 단계의 값이 곧 합계여야 한다 — 화면이 그 줄을 결론으로 쓴다
    const last = e.steps[e.steps.length - 1];
    assert.equal(last.kind, 'result');
    assert.equal(last.value, e.total);
  }
});

// ── OPI2 일할 (사용자 확인 2026-09-10 "OPI2만 일할이래 · 제외일을 넣는 건 어때?") ──
test('OPI2(자사주)만 일할이고 OPI1은 월할 그대로다', async () => {
  const { SAMSUNG_DEFAULTS, calcSamsungResult, getExclDays } = await import('../src-react/core/bonus/samsung/derive.ts');
  const { buildSamsungResultView } = await import('../src-react/core/bonus/samsung/result-view.ts');
  const hero = (extra) => {
    const inputs = { ...SAMSUNG_DEFAULTS, salary: 8000, year: 2026, accumYears: 1, ...extra };
    return buildSamsungResultView({ inputs, results: calcSamsungResult(inputs), dept: 'mem', year: 2026 }).hero;
  };
  const full = hero({});
  const excl30 = hero({ exclDaysByYear: { 2026: 30 } });
  // **자사주만** 줄어든다 — OPI는 월할이라 개월이 그대로면 변하지 않는다(세후라 미세 변동은 있다)
  assert.ok(excl30.stockVal < full.stockVal, '제외일이 자사주에 안 닿는다');
  assert.ok(Math.abs(excl30.stockVal / full.stockVal - (365 - 30) / 365) < 0.02);

  // **하위호환**: 제외일을 안 적으면 근무개월에서 환산한다 — 개월만 넣던 사람의 값이 안 바뀐다
  assert.equal(getExclDays({ workMonthsByYear: { 2026: 6 }, year: 2026 }, 2026), Math.round(365 / 2));
  assert.equal(getExclDays({ exclDaysByYear: { 2026: 10 }, workMonthsByYear: { 2026: 6 }, year: 2026 }, 2026), 10);
  assert.equal(getExclDays({ year: 2026 }, 2026), 0, '만근이면 제외일 0');

  // 학술연수는 절반만 인정하던 규칙 그대로 — 이제 일 단위로 뺀다
  const acad = hero({ exclDaysByYear: { 2026: 100 }, academic: { 2026: true } });
  const plain = hero({ exclDaysByYear: { 2026: 100 } });
  assert.ok(acad.stockVal > plain.stockVal, '학술연수가 절반 인정으로 안 걸린다');
});

// ── 좁은 자리 숫자 조판(format.shortMan) ────────────────────────────────────
// 막대 라벨(YearBars)과 공유 이미지가 **같은 함수**를 쓴다 — 두 번째 반복에서 core로 올렸다(§10).
// 두 곳이 다른 규칙으로 접으면 "그래프는 1.2억, 이미지는 1억 2,000만"이 되어 같은 값이 달라 보인다.
test('shortMan — 다섯 자리를 넘으면 억 소수 둘째로 접고, 뒤따르는 0은 뗀다', async () => {
  const { shortMan } = await import('../src-react/core/bonus/shared/format.ts');
  assert.equal(shortMan(4231), '4,231만');
  assert.equal(shortMan(9999), '9,999만');
  assert.equal(shortMan(10000), '1억');          // 1.00억이 아니다
  assert.equal(shortMan(11000), '1.1억');        // 1.10억이 아니다
  assert.equal(shortMan(12345), '1.23억');
  assert.equal(shortMan(231400), '23.14억');
  assert.equal(shortMan(0), '0만');
});

// ── 세전 보기 ─────────────────────────────────────────────────────────────
// 화면이 '세전으로'를 누르면 히어로·현금/주식·연도별 표·영업이익 곡선이 한꺼번에 넘어간다.
// 여기서 재는 것은 그 값들이 **서로 어긋나지 않는가**다 — 화면은 한 값을 여러 모양으로 나눠 적고,
// 어긋남은 눈으로 안 잡힌다(§10 "한 값이 여러 표현으로 나뉘면 항등식 테스트를 같이 쓴다").
test('세전: 히어로 = 현금 + 주식 · 산식의 세전값과 같다', () => {
  const v = view();
  assert.equal(v.hero.pre.total, v.hero.pre.cash + v.hero.pre.stockVal);
  assert.equal(v.hero.pre.cash, v.hero.pre.opi + v.hero.pre.tai);
  // 세전값은 역산이 아니라 derive가 낸 값 그대로여야 한다 — 산식 줄과 정확히 같다
  assert.equal(v.hero.pre.opi, v.formula.opi.pre);
  assert.equal(v.hero.pre.tai, v.formula.tai.pre);
  assert.equal(v.hero.pre.stockVal, v.formula.sp.pre);
});

test('세전 > 세후 — 모든 갈래에서', () => {
  const v = view();
  assert.ok(v.hero.pre.opi > v.hero.opi, 'OPI');
  assert.ok(v.hero.pre.tai > v.hero.tai, 'TAI');
  assert.ok(v.hero.pre.stockVal > v.hero.stockVal, '자사주');
  assert.ok(v.hero.pre.total > v.hero.total, '합계');
});

test('세전: 연도별 소계 = 갈래 합 · 누적 = 연도별 합', () => {
  const v = view();
  for (const r of v.threeYear.rows) {
    assert.equal(r.pre.subtotal, r.pre.opi + r.pre.tai + r.pre.stockVal + r.pre.psuGrant, `${r.year} 소계`);
    assert.ok(r.pre.subtotal > r.subtotal, `${r.year} 세전 > 세후`);
  }
  const t = v.threeYear.totals.pre;
  for (const k of ['opi', 'tai', 'stockVal', 'psuGrant', 'subtotal']) {
    assert.equal(t[k], v.threeYear.rows.reduce((a, r) => a + r.pre[k], 0), k);
  }
  // 첫해 행은 히어로와 같은 해다 — 두 경로가 같은 값을 내야 한다
  const first = v.threeYear.rows[0];
  assert.equal(first.pre.opi, v.hero.pre.opi);
  assert.equal(first.pre.stockVal, v.hero.pre.stockVal);
});

test('세전: 영업이익 곡선의 지금 점 = 히어로 세전 (조건 바와 결과가 같은 식)', () => {
  const inputs = SAMSUNG_DEFAULTS;
  const v = view(inputs);
  const at = heroAtOp(inputs, 'mem', Number(inputs[`opMem${inputs.year}`] ?? inputs.opMem ?? 300));
  assert.equal(at.totalPre, v.hero.pre.total);
  assert.ok(at.totalPre > at.total);
});

// 자사주의 흐름까지 세전으로 세운 뒤의 항등식(사용자 2026-09-10 "자사주도 완전 세전기준으로").
// **주식 수를 새로 짓지 않는 것**이 이 계산의 핵심이라, 주식 수는 세후와 같아야 한다.
test('세전: 소계 − 수령 = 차액 · 주식 수는 세후와 같다', () => {
  const v = view();
  const t = v.threeYear.totals.pre;
  assert.equal(t.received, t.opi + t.tai + t.vested + t.psuReceived);
  assert.equal(v.threeYear.deferredPre, t.subtotal - t.received);
  assert.ok(v.threeYear.deferredPre > 0);
  for (const r of v.threeYear.rows) {
    assert.equal(r.pre.received, r.pre.opi + r.pre.tai + r.pre.vested + r.pre.psuReceived, `${r.year}`);
    assert.ok(r.pre.received > r.received, `${r.year} 세전 > 세후`);
  }
});

test('세전 자사주: 부여 = 세 몫의 합 · 1주 단가는 부여가보다 크다', () => {
  const v = view();
  const g = v.grant;
  assert.equal(g.preVal, g.vestedNow.preVal + g.later.preVal);
  assert.equal(g.later.preVal, g.laterByYear.reduce((a, r) => a + r.preVal, 0));
  assert.equal(g.preVal, v.hero.pre.stockVal);            // 부여 전량 세전 = 산식의 특별성과급 세전
  assert.equal(g.shares, v.hero.shares);                   // 주식 수는 세후 그대로
  // 세금을 뗀 뒤 주식을 사므로 세전 1주 단가 > 부여가
  assert.ok(g.preVal * 10000 / g.shares > g.price);
  assert.equal(v.cashableNowPre, v.hero.pre.cash + g.vestedNow.preVal);
  assert.ok(v.cashableNowPre > v.cashableNow);
});
