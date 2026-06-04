-- 최초 매수일을 선택값으로 변경 (과거 매수일을 모를 수 있어 NULL 허용)
ALTER TABLE `investment`
  MODIFY `purchase_date` DATE NULL COMMENT '최초 매수일';
