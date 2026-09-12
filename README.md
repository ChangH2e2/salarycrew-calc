# salarycrew-calc

**[salarycrew.com](https://salarycrew.com)이 실제로 쓰는 성과급 계산 코어**입니다.
화면에 보이는 숫자가 어떤 식으로 나온 것인지 코드로 확인할 수 있게 공개합니다.

> 계산기 사이트는 "이 숫자가 맞나"를 물어도 답할 방법이 없습니다.
> 이 저장소가 그 답입니다 — **화면이 부르는 함수 그대로**이고, 테스트가 골든값을 잡고 있습니다.

## 무엇이 들어 있나

| 회사 | 코드 | 화면 |
|---|---|---|
| 삼성전자 | `core/bonus/samsung/` — OPI · TAI · 자사주 3년 분할 · PSU 지급배수 | [salarycrew.com/samsung](https://salarycrew.com/samsung) |
| SK하이닉스 | `core/bonus/hynix/` — PS · PI · 초과이익분배금 | [salarycrew.com/sk-hynix](https://salarycrew.com/sk-hynix) |
| 삼성전기 | `core/bonus/semco/` — OPI · TAI(사업부 조건) | [salarycrew.com/semco](https://salarycrew.com/semco) |
| 현대차 · 기아 · 한화에어로 | `core/bonus/rate/` — 지급률형(임단협 합의 기준) | [/hyundai](https://salarycrew.com/hyundai) · [/kia](https://salarycrew.com/kia) · [/hanwha-aero](https://salarycrew.com/hanwha-aero) |

공통:

- `core/calc-bridge.js` — 소득세·4대보험·실수령액. 상수는 `data/calc-constants.json` **단일 소스**
- `core/bonus/compare/` — 회사 간 비교, 지급 형태(현금/주식) 분해
- `core/bonus/*/curve.ts` — 영업이익에 따른 지급 곡선
- `core/bonus/shared/tax-explain.ts` — 세금 설명(소득세 → 지방세 10% → 실효세율)

## 설계에서 지키는 것

1. **돈에 부동소수점을 쓰지 않는다.** 단위는 타입이 명시합니다 — 성과급·급여는 **만원**,
   자사주 부여가·부동산 결제는 **원**(`core/bonus/samsung/types.ts` 머리 참고).
2. **`*-view.ts`는 계산하지 않는다.** `derive`가 만든 값을 재배열·합산·대조만 합니다.
   지급 규칙·세율·상한을 view가 새로 판단하면 계산 엔진이 둘이 됩니다.
3. **한 값이 여러 표현으로 나뉘면 항등식 테스트를 같이 둡니다**(히어로 = 현금 + 주식 …).
   눈으로 잡히는 결함은 대부분 이 계열이라, 검사로 내려보냈습니다.
4. **출처 없는 숫자는 넣지 않습니다.** 상수에는 기준연도·검토일·출처가 붙어 있습니다
   (`data/calc-constants.json`의 `_meta`).

## 돌려보기

Node 24 LTS(`.node-version`)를 씁니다. `.ts`는 빌드 없이 **타입 스트립으로 그대로 실행**되므로
의존성 설치가 필요 없습니다.

```bash
npm test          # node --test tests/*.test.mjs
```

43개 테스트가 곡선·엣지(영업이익 0, 근무 0개월)·세전/세후 항등식·회사 간 비교를 잡습니다.

```js
import { SAMSUNG_DEFAULTS, calcSamsungResult } from './src-react/core/bonus/samsung/derive.ts';

// 연봉 7,300만 · 2026년 메모리 영업이익 350조 가정
const inputs = { ...SAMSUNG_DEFAULTS, salary: 7300, opMem2026: 350 };
const { deptResults } = calcSamsungResult(inputs);

const mem = deptResults.mem;
mem.opiPre;    // OPI 세전(만원)
mem.opiPost;   // OPI 세후(만원)
mem.shares;    // 특별성과급 자사주(주)
mem.stVal;     // 그 주식의 당해 가치(만원)
mem.effRate;   // 실효세율 (0~1)
```

입력은 `SAMSUNG_DEFAULTS`를 펼쳐 필요한 것만 덮어쓰면 됩니다 — 필드가 많고(연도별 급여·직급·
근무개월·사업부 인원 …) 서로 맞물려 있어서, 부분 객체를 새로 만들기보다 이 방식이 안전합니다.
출력 금액 단위는 **만원**, 주가·부여가만 **원**입니다.

## 여기 없는 것

- **화면·UI** — 이 저장소는 계산만 담습니다.
- **데이터 운영** — 영업이익 가정치, 주가, 공시 파싱, 청약·실거래 수집 크론은 서비스 쪽에 있습니다.
- **최신 가정값** — `data/calc-constants.json`은 공개 시점 스냅샷입니다.
  운영 중인 가정값(영업이익 전망 등)은 사이트가 CMS에서 받아 씁니다.

## 정확도에 대해

**공개 자료 기반 추정값이며 실제 지급액과 다를 수 있습니다.** 지급 산식은 노사 합의서·사업보고서 등
공개된 내용을 따르지만, 회사가 공개하지 않는 부분(부문·사업부 재원 배분 세부 등)은 추정이 들어갑니다.
틀린 곳을 찾으면 이슈로 알려주세요 — 근거(합의서 조항·공시 페이지)를 함께 주시면 가장 빠릅니다.

산식 설명은 사이트의 가이드에 있습니다:
[OPI](https://salarycrew.com/guide/opi) · [TAI](https://salarycrew.com/guide/tai) ·
[PSU](https://salarycrew.com/guide/psu) · [특별성과급](https://salarycrew.com/guide/special) ·
[하이닉스 PS](https://salarycrew.com/guide/hynix-ps) · [역대 성과급](https://salarycrew.com/guide/history)

## 라이선스

MIT. 계산 코드는 자유롭게 쓰셔도 됩니다.
