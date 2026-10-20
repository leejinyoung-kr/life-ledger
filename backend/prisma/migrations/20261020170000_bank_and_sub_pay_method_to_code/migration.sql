-- 예적금 은행 · 구독 결제수단을 이름(라벨)에서 코드 관리 코드로 바꾼다 — 가계부(결제수단 · 입금 은행)와 같은 방식 (ADR 0009)
-- 코드 관리 목록에 없는 값은 그대로 두고, 화면은 코드 관리에 없는 값을 그대로 보여 준다.

UPDATE `saving` s
JOIN `category` k ON k.`domain` = 'bank' AND k.`label` = s.`bank`
SET s.`bank` = k.`code`;

UPDATE `subscription` s
JOIN `category` k ON k.`domain` = 'pay_method' AND k.`label` = s.`pay_method`
SET s.`pay_method` = k.`code`;
