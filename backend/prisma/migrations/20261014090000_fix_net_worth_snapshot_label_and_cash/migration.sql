-- 순자산 스냅샷 바로잡기 (데이터만, 스키마 변경 없음) — 2026-10-14
--
-- 1) 이름표: 2026-08-18 부터 크론이 매주 월요일에 "지금 값"을 "지난달" 이름으로 덮어써 왔다.
--    그래서 2026-07 이후 행은 다음 달(대개 그 달 마지막 월요일) 값을 담고 있다 → 한 달 뒤로 옮긴다.
--    매월 1일에 돌던 시절의 행(2026-06 까지)은 월말 값이 맞으므로 그대로 둔다.
--    옛 2026-07 행은 덮어써져 원래 값이 없으므로 2026-07 은 비게 된다.
--    (user_id, month) 유니크 충돌을 피하려고 큰 달부터 옮긴다.
UPDATE `net_worth_snapshot`
SET `month` = DATE_FORMAT(DATE_ADD(CONCAT(`month`, '-01'), INTERVAL 1 MONTH), '%Y-%m')
WHERE `month` >= '2026-07'
ORDER BY `month` DESC;

-- 2) 현금 = 수입 - 지출 - 자산이동 으로 바뀌었다. 예전 값은 자산이동을 빼지 않아 예적금 · 예수금에
--    더해진 돈을 현금에도 한 번 더 셌다 → cash_total 을 새 식으로 다시 계산하고,
--    total_assets 에서 그 달 말까지의 자산이동 누계를 뺀다.
UPDATE `net_worth_snapshot` s
LEFT JOIN (
  SELECT
    s2.`id`,
    SUM(CASE t.`type` WHEN 'income' THEN t.`amount` ELSE -t.`amount` END) AS cash,
    SUM(CASE t.`type` WHEN 'transfer' THEN t.`amount` ELSE 0 END) AS moved
  FROM `net_worth_snapshot` s2
  JOIN `transaction` t
    ON t.`user_id` = s2.`user_id`
   AND t.`deleted_at` IS NULL
   AND t.`date` < DATE_ADD(CONCAT(s2.`month`, '-01'), INTERVAL 1 MONTH)
  GROUP BY s2.`id`
) x ON x.`id` = s.`id`
SET
  s.`cash_total` = COALESCE(x.cash, 0),
  s.`total_assets` = s.`total_assets` - COALESCE(x.moved, 0);
