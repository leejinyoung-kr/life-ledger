-- 카테고리 도메인에 bank(은행/금융기관) 추가 — 수입 입금처·예적금 기관 공용 선택값
ALTER TABLE `category` MODIFY COLUMN `domain` ENUM(
    'transaction',
    'subscription',
    'asset',
    'investment',
    'saving',
    'pay_method',
    'bank',
    'credential_cat',
    'id_type',
    'env_group'
) NOT NULL COMMENT '적용 도메인';
