// hynix-derive.js — 옛 경로 shim (2026-09-07 S5a). 정본은 core/bonus/hynix/derive.ts.
// 소비처(cashflow.js · semco-derive.js · gen-salary-pages · check-calc-drift · useHynixState)가 새 경로로
// 옮겨지면 지운다. 여기에 코드를 추가하지 마라.
export {
  HYNIX_YEARS, HYNIX_OP_DEFAULTS, HYNIX_DEFAULTS,
  hynixOpKey, getActiveHynixYears, getHynixWorkMonths, getHynixOp, getHynixYearSalary, calcHynixResult,
} from './bonus/hynix/derive.ts';
