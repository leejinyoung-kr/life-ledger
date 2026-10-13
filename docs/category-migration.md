# 카테고리 마이그레이션 가이드 (엑셀 → LifeLedger)

LifeLedger 가계부 카테고리는 **2계층(대분류 → 소분류)** 구조다.
거래(`transaction`)는 **소분류 code 1개만** 저장하고, 대분류는 `category.parent_code` 로 파생한다.

이 문서는 기존 엑셀 가계부를 실제로 옮길 때
**엑셀 카테고리 → 앱 소분류 code** 를 어떻게 매칭할지 기록한다.

> 앱 기본 시드는 엑셀을 "정리(트림)"한 버전이라 1:1 이 아니다.
> 그대로 다 쓰고 싶으면 [B안](#b-엑셀-그대로-복원) 참고.

---

## 1. DB 구조

| 테이블 | 컬럼 | 설명 |
| --- | --- | --- |
| `category` | `domain='transaction'` | 가계부 카테고리 |
| `category` | `code` | 소분류·대분류 식별 코드 (예: `food_dining`) |
| `category` | `parent_code` | 소분류면 대분류 code, 대분류면 `NULL` |
| `category` | `label` | 화면 표시명 |
| `category` | `sort_order` | 정렬(트리 순서) |
| `transaction` | `category` | **소분류 code** 저장 (대분류 저장 안 함) |

- 대분류 행: `parent_code IS NULL`
- 소분류 행: `parent_code = <대분류 code>`
- 거래는 항상 **소분류(leaf) code** 를 가진다.

---

## 2. 앱 기본 카테고리 트리 (시드)

> 정의 위치: `backend/prisma/seeds/categories.seed.ts` · `backend/src/category/category.service.ts` (`TX_TREE`)

| 대분류(code) | 소분류(code = label) |
| --- | --- |
| 식비 `food` | `food_grocery`=식료품 · `food_dining`=외식 · `food_cafe`=카페·간식 · `food_etc`=기타(식비) |
| 꾸밈비 `beauty` | `beauty_clothing`=의류·잡화 · `beauty_cosmetic`=화장품 · `beauty_hair`=미용 · `beauty_etc`=기타(꾸밈비) |
| 생활비 `living` | `living_daily`=생필품 · `living_appliance`=가구·가전 · `living_housing`=주거관련 · `living_etc`=기타(생활비) |
| 보험·통신 `insurance` | `insurance_telecom`=통신비 · `insurance_premium`=보험 · `insurance_subscription`=구독·정기결제 · `insurance_etc`=기타(보험·통신) |
| 차량유지 `car` | `car_fuel`=유류비 · `car_maintenance`=정비·수리 · `car_etc`=기타(차량) |
| 교통비 `transport` | `transport_transit`=대중교통 · `transport_taxi`=택시 · `transport_intercity`=시외·항공 · `transport_etc`=기타(교통) |
| 여가생활 `leisure` | `leisure_travel`=여행 · `leisure_culture`=영화·공연 · `leisure_exercise`=운동 · `leisure_etc`=기타(여가) |
| 건강 `health` | `health_hospital`=병원 · `health_pharmacy`=약국 · `health_supplement`=건강보조제 · `health_etc`=기타(건강) |
| 자기계발 `selfdev` | `selfdev_book`=도서 · `selfdev_edu`=교육·강의 · `selfdev_etc`=기타(자기계발) |
| 경조사 `event` | `event_condolence`=부조 · `event_gift`=선물 · `event_gathering`=모임·회비 · `event_etc`=기타(경조사) |
| 기타 `etc` | `etc_interest`=이자 · `etc_fee`=수수료 · `etc_tax`=세금 · `etc_rentfee`=임대관리비 · `etc_etc`=기타 |
| 수입 `income` | `income_salary`=급여 · `income_side`=부수입 · `income_financial`=금융수입 · `income_etc`=기타수입 |
| 이체 `transfer` | `transfer_move`=저축·계좌이체 |

> 유형 매핑: 대분류 `income` → 수입, `transfer` → 이체, 그 외 → 지출.

---

## 3. 엑셀 → 앱 소분류 매칭표 (A안 · 정리본)

기존 엑셀 소분류를 앱 소분류 code 로 흡수. **합쳐진 항목은 ←로 표시**.

### 지출
| 엑셀 대분류 | 엑셀 소분류 | → 앱 소분류 code |
| --- | --- | --- |
| 식비 | 식료품 | `food_grocery` |
| 식비 | 외식 / 회사점심 | `food_dining` |
| 식비 | 간식 / 커피·음료 | `food_cafe` |
| 식비 | 기타(식비) | `food_etc` |
| 꾸밈비 | 의류 / 패션잡화 | `beauty_clothing` |
| 꾸밈비 | 화장품 | `beauty_cosmetic` |
| 꾸밈비 | 미용(헤어 외) | `beauty_hair` |
| 꾸밈비 | 기타(꾸밈비) | `beauty_etc` |
| 생활비 | 생필품 / 잡화(인테리어 외) | `living_daily` |
| 생활비 | 가구·가전 | `living_appliance` |
| 생활비 | 주거 관련 | `living_housing` |
| 생활비 | 기타(생활비) | `living_etc` |
| 보험·통신 | 통신비 | `insurance_telecom` |
| 보험·통신 | 자동차보험 / 기타보험 / 연금보험 | `insurance_premium` |
| 보험·통신 | 구독/정기결제 | `insurance_subscription` |
| 보험·통신 | 기타(보험·통신) | `insurance_etc` |
| 차량유지비 | 유류비 | `car_fuel` |
| 차량유지비 | 세차비 / 점검·부품교체 / 수리비 | `car_maintenance` |
| 차량유지비 | 기타(차량유지비) | `car_etc` |
| 교통비 | 대중교통 | `transport_transit` |
| 교통비 | 택시 | `transport_taxi` |
| 교통비 | 고속버스·기차 / 비행기 | `transport_intercity` |
| 교통비 | 기타(교통비) | `transport_etc` |
| 여가생활 | 여행비 | `leisure_travel` |
| 여가생활 | 영화·공연 / 전시회 및 기타 | `leisure_culture` |
| 여가생활 | 운동 | `leisure_exercise` |
| 여가생활 | 기타(여가생활) | `leisure_etc` |
| 건강 | 병원 | `health_hospital` |
| 건강 | 약국 | `health_pharmacy` |
| 건강 | 건강보조제 | `health_supplement` |
| 건강 | 기타(건강) | `health_etc` |
| 자기계발 | 도서 | `selfdev_book` |
| 자기계발 | 학원·강의 / 스터디 | `selfdev_edu` |
| 자기계발 | 기타(자기계발) | `selfdev_etc` |
| 경조사 | 부조 | `event_condolence` |
| 경조사 | 선물 | `event_gift` |
| 경조사 | 모임·회비 | `event_gathering` |
| 경조사 | 기타(경조사) | `event_etc` |
| 기타 | 이자 | `etc_interest` |
| 기타 | 수수료 | `etc_fee` |
| 기타 | 소득세 / 세금 | `etc_tax` |
| 기타 | 임대관리비 | `etc_rentfee` |
| 기타 | 기타예비비 / 기타(기타) | `etc_etc` |

### 수입 / 이체 (엑셀엔 없거나 별도 관리 → 거래 유형으로 구분)
| 의미 | → 앱 소분류 code |
| --- | --- |
| 급여·월급·성과급 | `income_salary` |
| 부수입·중고거래·용돈 | `income_side` |
| 이자수령·배당·환급 | `income_financial` |
| 기타 수입 | `income_etc` |
| 저축·계좌 간 이동 | `transfer_move` |

> ⚠️ 합쳐진 항목(예: 회사점심→외식)은 원본 구분이 사라진다.
> 구분 유지가 필요하면 [B안](#b-엑셀-그대로-복원) 으로 소분류를 추가하라.

---

## 4. 마이그레이션 SQL (A안)

전제: 엑셀에서 옮긴 거래가 `transaction.category` 에 **엑셀 소분류 라벨(또는 임시 코드)** 로 들어와 있다고 가정.
(엑셀 업로드 기능으로 넣었다면 이미 앱 라벨→code 변환됨 — 그 경우 이 단계 불필요.)

```sql
-- 예시: 임시 적재된 엑셀 라벨을 앱 소분류 code 로 일괄 변환
-- (실제 컬럼/값은 적재 방식에 맞게 조정)
UPDATE `transaction` SET category = 'food_dining'
  WHERE category IN ('외식', '회사점심');
UPDATE `transaction` SET category = 'food_cafe'
  WHERE category IN ('간식', '커피/음료', '커피·음료');
-- ... 매칭표(3절) 전체를 동일 패턴으로 반복

-- 변환 누락 점검 — 트리에 없는 code 가 남았는지 확인
SELECT category, COUNT(*) FROM `transaction`
  WHERE category NOT IN (SELECT code FROM category WHERE domain='transaction' AND parent_code IS NOT NULL)
  GROUP BY category;
```

---

## B. 엑셀 그대로 복원

정리(트림) 없이 엑셀 소분류를 **1:1 그대로** 쓰고 싶으면:

1. `category` 에 엑셀 소분류를 그대로 INSERT (대분류 먼저, 소분류 `parent_code` 연결).
2. 거래는 그 code 로 변환.

```sql
-- 대분류 (parent_code = NULL)
INSERT INTO category (user_id, domain, code, label, parent_code, sort_order, is_active)
VALUES
  (:uid, 'transaction', 'food',  '식비',  NULL, 1, 1),
  (:uid, 'transaction', 'beauty','꾸밈비', NULL, 2, 1);
  -- ...

-- 소분류 (parent_code = 대분류 code)
INSERT INTO category (user_id, domain, code, label, parent_code, sort_order, is_active)
VALUES
  (:uid, 'transaction', 'food_company_lunch', '회사점심', 'food', 3, 1),
  (:uid, 'transaction', 'food_snack',         '간식',     'food', 4, 1);
  -- ...
```

> code 규칙: 영문 소문자·숫자·언더바. 대분류 code + `_` + 소분류 식별자 권장.
> 같은 `(user_id, domain, code)` 는 유니크 — 중복 금지.

---

## 체크리스트

- [ ] 거래의 모든 `category` 가 **소분류 code** 인지 (대분류 code 금지)
- [ ] 모든 소분류에 `parent_code` 존재, 대분류는 `NULL`
- [ ] 매칭 안 된 잔여 code 없음 (4절 점검 쿼리)
- [ ] 코드관리 페이지에서 대분류→소분류 그룹이 정상 표시되는지
