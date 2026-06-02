-- category.domain ENUM에 결제수단·계정카테고리·신원지갑·ENV그룹 도메인 추가
ALTER TABLE `category`
    MODIFY `domain` ENUM(
        'transaction',
        'subscription',
        'asset',
        'investment',
        'saving',
        'pay_method',
        'credential_cat',
        'id_type',
        'env_group'
    ) NOT NULL COMMENT '적용 도메인';
