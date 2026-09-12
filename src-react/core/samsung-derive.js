// samsung-derive.js — 옛 경로 shim (2026-09-07 S1).
// 본체는 core/bonus/samsung/derive.ts로 옮겼다. 이 파일은 tests/calc-bridge.test.mjs ·
// hooks/useCalcState.js · core/cashflow.js · scripts/gen-salary-pages.mjs · check-calc-drift.mjs가
// 옛 경로를 import하기 때문에 남아 있다. 소비처를 새 경로로 옮길 때마다 여기 목록에서 지우고,
// 0이 되면 이 파일을 지운다. 여기에 코드를 추가하지 마라.
export * from './bonus/samsung/derive.ts';
