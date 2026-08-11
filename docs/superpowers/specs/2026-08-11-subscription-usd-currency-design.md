# 구독 관리 — 달러(USD) 구독 지원 설계

## 배경

구독 관리 페이지(`frontend/app/(app)/subscriptions/page.tsx`)는 모든 구독 금액을 `won()`으로만 표시한다. 결제수단에 "해외결제"가 있음에도 통화 필드가 없어, 넷플릭스 미국 요금제 등 달러로 청구되는 구독은 사용자가 매번 환율을 수동 계산해 원화로 입력해야 했다. 실제 카드 청구액(환율 변동)과 앱에 기록된 금액이 계속 어긋나는 문제가 있었다.

## 목표

- 구독별로 통화(KRW/USD)를 지정하고, 원래 통화·금액을 그대로 저장한다.
- 구독 카드는 원래 통화로 표시한다.
- 월/연 환산 요약 통계는 조회 시점의 최신 환율로 원화 환산해 계산한다.

## 범위 밖

- 환율 변동 이력 저장
- 실시간 환율을 UI에 별도 표시
- USD 외 다른 통화(엔·유로 등) 지원

## 설계

### 환율 조회 — 기존 서비스 재사용

`backend/src/investment/price-lookup.service.ts`의 `PriceLookupService.getExchangeRate(from, to)`가 frankfurter.app(무료, API 키 불필요) 연동과 10분 TTL 인메모리 캐싱을 이미 구현하고 있다. 새 서비스를 만들지 않고 그대로 재사용한다. `investment-account`, `asset` 모듈이 이미 동일하게 `providers`에 `PriceLookupService`를 직접 추가해 재사용하는 패턴을 따른다(모듈 import 대신 provider 직접 등록).

### DB (Prisma)

- `Subscription` 모델에 `currency` enum(`KRW` 기본값 | `USD`) 컬럼 추가.
- `amount`는 원래 통화 기준 금액 그대로 저장(변환하지 않음).
- 마이그레이션 1개 생성. 기존 행은 컬럼 기본값(`KRW`)으로 자동 채워지므로 별도 백필 불필요.

### 백엔드

- `create-subscription.dto.ts` / `update-subscription.dto.ts`: `currency` optional 필드 추가(`@IsEnum(SubscriptionCurrency)`), 기본값 KRW.
- `subscription.service.ts`:
  - `toDto()`에 `currency` 포함.
  - `toMonthly(amount, cycle, rate)`가 환율 인자를 받아, 통화가 USD인 항목은 `amount * rate`로 원화 환산 후 기존 로직(연→/12, 주→*52/12) 적용하도록 변경.
  - `summary()`: 대상 행 중 USD 통화가 하나라도 있으면 `PriceLookupService.getExchangeRate('USD', 'KRW')`를 1회 호출해 모든 행 계산에 재사용(행마다 호출하지 않음).
- `subscription.module.ts`: `providers`에 `PriceLookupService` 추가.

### 프론트엔드

- `lib/subscription.ts`: `Subscription.currency: 'KRW' | 'USD'` 타입 추가.
- 구독 카드 금액 표시: `sub.currency === 'USD' ? usd(sub.amount) : won(sub.amount)` (`usd()`는 `lib/finance.ts`에 이미 존재).
- 추가/수정 모달: "통화" select(원화/달러) 추가, 기본값 원화.
- 상단 요약 통계(월 합계/연 환산/활성 구독/다음 결제)는 백엔드가 이미 원화로 환산한 값을 내려주므로 프론트 변경 불필요.

## 에러 처리

- `PriceLookupService.getExchangeRate`가 외부 API 실패 시 `BadRequestException`을 던지는 기존 동작을 그대로 따른다. USD 구독이 있는 사용자가 환율 조회 실패 시 요약 API가 에러를 반환할 수 있음 — 캐시(10분 TTL)가 있어 실제 발생 빈도는 낮음. 별도 폴백 로직은 범위 밖(YAGNI).

## 테스트 관점

- `subscription.service.spec.ts`(신규 또는 기존 확장): USD 구독이 섞인 경우 `summary()`의 월/연 합계가 환율 반영해 정확히 계산되는지, KRW만 있을 때 환율 API가 호출되지 않는지 검증.
