-- ============================================================
--  Doc-Nexus — 통합 초기 마이그레이션 (init, 기존 16개 마이그레이션 병합)
--  Provider : MySQL (utf8mb4_unicode_ci)
--  타임스탬프 : KST 기준, updated_at은 DB 레벨 DEFAULT(TiDB 트리거 비호환으로 트리거 대신 사용)
-- ============================================================

-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `google_id` VARCHAR(100) NULL COMMENT 'Google 계정 고유 ID',
    `email` VARCHAR(200) NOT NULL COMMENT '이메일',
    `name` VARCHAR(100) NOT NULL COMMENT '이름',
    `picture` VARCHAR(500) NULL COMMENT '프로필 사진 URL',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    UNIQUE INDEX `user_google_id_key`(`google_id`),
    UNIQUE INDEX `user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='회원';

-- CreateTable
CREATE TABLE `transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `type` ENUM('income', 'expense', 'transfer') NOT NULL COMMENT '거래유형',
    `date` DATE NOT NULL COMMENT '거래일',
    `title` VARCHAR(200) NOT NULL COMMENT '내역명',
    `category` VARCHAR(50) NOT NULL COMMENT '카테고리코드',
    `amount` DECIMAL(15, 2) NOT NULL COMMENT '금액(원)',
    `pay_method` VARCHAR(50) NOT NULL COMMENT '결제수단',
    `memo` VARCHAR(300) NULL COMMENT '메모',
    `is_recurring` BOOLEAN NOT NULL DEFAULT false COMMENT '반복거래 여부',
    `recurring_rule` JSON NULL COMMENT '반복규칙',
    `recurring_parent_id` INTEGER NULL COMMENT '반복 원본 transaction.id (자동 생성 회차)',
    `recurring_period` VARCHAR(10) NULL COMMENT '반복 회차 식별 (YYYY-MM / YYYY / YYYY-MM-DD)',
    `recurring_overridden` BOOLEAN NOT NULL DEFAULT false COMMENT '사용자 개별 수정 회차(범위 수정 보존)',
    `target_type` ENUM('saving', 'investment', 'asset') NULL COMMENT '이동 대상 종류(transfer 전용)',
    `target_id` INTEGER NULL COMMENT '대상 테이블 id (target_type 기준)',
    `target_direction` ENUM('increase', 'decrease') NULL COMMENT '잔액 변화 방향(asset 전용)',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `transaction_user_id_date_idx`(`user_id`, `date`),
    INDEX `transaction_recurring_parent_id_idx`(`recurring_parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='수입/지출 내역';

-- CreateTable
CREATE TABLE `saving` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `bank` VARCHAR(100) NOT NULL COMMENT '은행/기관',
    `name` VARCHAR(100) NOT NULL COMMENT '상품명',
    `type` ENUM('savings', 'deposit', 'subscription', 'etc') NOT NULL COMMENT '예적금유형',
    `interest_rate` DECIMAL(5, 2) NOT NULL COMMENT '금리(%)',
    `monthly_amount` DECIMAL(15, 2) NOT NULL COMMENT '월 납입액(원)',
    `start_date` DATE NOT NULL COMMENT '가입일',
    `maturity_date` DATE NULL COMMENT '만기일',
    `balance` DECIMAL(15, 2) NOT NULL COMMENT '현재 잔액(원)',
    `memo` VARCHAR(300) NULL COMMENT '메모',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `saving_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='예적금';

-- CreateTable
CREATE TABLE `investment_account` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `name` VARCHAR(100) NOT NULL COMMENT '계좌명',
    `cash_balance` DECIMAL(15, 2) NOT NULL DEFAULT 0 COMMENT '예수금(미투자 대기 현금)',
    `cash_balance_usd` DECIMAL(15, 2) NOT NULL DEFAULT 0 COMMENT '달러 예수금',
    `account_number_enc` VARCHAR(255) NULL COMMENT '계좌번호(암호문, AES-256-GCM)',
    `memo` VARCHAR(300) NULL COMMENT '메모',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `investment_account_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='투자 계좌';

-- CreateTable
CREATE TABLE `investment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `account_id` INTEGER NOT NULL COMMENT 'investment_account.id FK',
    `name` VARCHAR(100) NOT NULL COMMENT '종목명',
    `type` ENUM('domestic_stock', 'foreign_stock', 'foreign_etf', 'domestic_etf', 'crypto', 'etc') NOT NULL COMMENT '투자유형',
    `symbol` VARCHAR(20) NULL COMMENT '시세조회용 종목코드(국내) 또는 티커(해외)',
    `quantity` DECIMAL(18, 6) NULL COMMENT '보유수량 — 시세조회 시 평가금액 계산에 사용',
    `principal` DECIMAL(15, 2) NOT NULL COMMENT '투자원금(원)',
    `principal_usd` DECIMAL(15, 4) NULL COMMENT '해외종목 달러 원금',
    `current_value` DECIMAL(15, 2) NOT NULL COMMENT '현재 평가금액(원)',
    `current_value_usd` DECIMAL(15, 4) NULL COMMENT '해외종목 달러 평가금액',
    `purchase_date` DATE NULL COMMENT '최초 매수일',
    `memo` VARCHAR(300) NULL COMMENT '메모',
    `recurring_buy_enabled` BOOLEAN NOT NULL DEFAULT false COMMENT '반복매수 사용 여부',
    `recurring_buy_rule` JSON NULL COMMENT '반복 규칙',
    `recurring_buy_amount` DECIMAL(15, 2) NULL COMMENT '회차당 매수금액(국내 원·해외 달러)',
    `recurring_buy_quantity` DECIMAL(18, 6) NULL COMMENT '회차당 매수수량(주)',
    `recurring_buy_last_period` VARCHAR(10) NULL COMMENT '마지막 처리 회차',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `investment_user_id_idx`(`user_id`),
    INDEX `investment_account_id_idx`(`account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='투자';

-- CreateTable
CREATE TABLE `subscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `name` VARCHAR(100) NOT NULL COMMENT '서비스명',
    `category` VARCHAR(50) NOT NULL COMMENT '카테고리코드',
    `amount` DECIMAL(15, 2) NOT NULL COMMENT '결제금액(원)',
    `cycle` ENUM('monthly', 'yearly', 'weekly') NOT NULL DEFAULT 'monthly' COMMENT '결제주기',
    `status` ENUM('active', 'trial', 'paused') NOT NULL DEFAULT 'active' COMMENT '상태',
    `next_payment_date` DATE NOT NULL COMMENT '다음 결제일',
    `pay_method` VARCHAR(50) NOT NULL COMMENT '결제수단',
    `last_used_at` DATE NULL COMMENT '마지막 사용일',
    `memo` VARCHAR(300) NULL COMMENT '메모',
    `deleted_at` DATETIME(3) NULL COMMENT '해지일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `subscription_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='구독';

-- CreateTable
CREATE TABLE `asset` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `type` ENUM('cash', 'savings', 'investment', 'realestate', 'debt', 'etc') NOT NULL COMMENT '자산유형',
    `name` VARCHAR(100) NOT NULL COMMENT '자산명',
    `amount` DECIMAL(15, 2) NOT NULL COMMENT '금액(원)',
    `interest_rate` DECIMAL(5, 2) NULL COMMENT '금리(%)',
    `memo` VARCHAR(300) NULL COMMENT '메모',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `asset_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='자산/부채';

-- CreateTable
CREATE TABLE `net_worth_snapshot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `month` VARCHAR(7) NOT NULL COMMENT '기준월(YYYY-MM)',
    `total_assets` DECIMAL(15, 2) NOT NULL COMMENT '총자산(원)',
    `total_debt` DECIMAL(15, 2) NOT NULL COMMENT '총부채(원)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    INDEX `net_worth_snapshot_user_id_idx`(`user_id`),
    UNIQUE INDEX `net_worth_snapshot_user_id_month_key`(`user_id`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='순자산 월별 스냅샷';

-- CreateTable
CREATE TABLE `user_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `display_name` VARCHAR(100) NULL COMMENT '표시 이름',
    `notif_monthly` BOOLEAN NOT NULL DEFAULT true COMMENT '월간 리포트 자동생성 알림',
    `notif_upload` BOOLEAN NOT NULL DEFAULT false COMMENT '파일 업로드 완료 알림',
    `notif_maturity` BOOLEAN NOT NULL DEFAULT true COMMENT '만기/결제 임박 알림 수신',
    `notif_deadline` BOOLEAN NOT NULL DEFAULT true COMMENT '만료/마감 임박 알림 수신',
    `session_expiry` VARCHAR(10) NOT NULL DEFAULT '7d' COMMENT '세션 자동만료',
    `pw_auto_hide` VARCHAR(10) NOT NULL DEFAULT '10s' COMMENT '비밀번호 자동숨김',
    `openai_api_key` VARCHAR(512) NULL COMMENT 'OpenAI API 키 (AES-256-GCM 암호문)',
    `openai_model` VARCHAR(50) NOT NULL DEFAULT 'gpt-4o-mini' COMMENT 'AI 리포트 생성 모델',
    `master_lock_enabled` BOOLEAN NOT NULL DEFAULT false COMMENT '마스터 잠금 사용 여부',
    `master_lock_hash` VARCHAR(200) NULL COMMENT '마스터 비번 해시(saltHex:hashHex)',
    `master_lock_timeout` INTEGER NOT NULL DEFAULT 5 COMMENT '자동잠금 시간(분), 0=수동',
    `categories` JSON NOT NULL COMMENT '카테고리 목록',
    `widgets` JSON NOT NULL COMMENT '대시보드 위젯 표시/순서',
    `menu_order` JSON NULL COMMENT '사이드바 1차 메뉴 순서(key 배열)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    UNIQUE INDEX `user_settings_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='사용자 설정';

-- CreateTable
CREATE TABLE `notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `group` ENUM('ledger', 'system') NOT NULL COMMENT '알림그룹',
    `tone` ENUM('warning', 'success', 'info') NOT NULL COMMENT '톤',
    `title` VARCHAR(200) NOT NULL COMMENT '제목',
    `description` VARCHAR(500) NOT NULL COMMENT '내용',
    `source` VARCHAR(50) NOT NULL COMMENT '발생처 라벨',
    `read_at` DATETIME(3) NULL COMMENT '읽은시각(KST)',
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '발생시각(화면표시용)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    INDEX `notification_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='알림';

-- CreateTable
CREATE TABLE `ai_report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `period_label` VARCHAR(50) NOT NULL COMMENT '분석 기간 표시 라벨',
    `period_from` DATE NOT NULL COMMENT '분석 시작일',
    `period_to` DATE NOT NULL COMMENT '분석 종료일',
    `model_used` VARCHAR(50) NOT NULL COMMENT '생성에 사용한 AI 모델',
    `summary` VARCHAR(1000) NOT NULL COMMENT '종합 요약',
    `insights` JSON NOT NULL COMMENT '인사이트 목록(tone·text)',
    `tags` JSON NOT NULL COMMENT '키워드 태그 목록',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    INDEX `ai_report_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='AI 리포트';

-- CreateTable
CREATE TABLE `ai_usage_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `model` VARCHAR(50) NOT NULL COMMENT '호출에 사용한 OpenAI 모델',
    `source` VARCHAR(20) NOT NULL COMMENT '호출 출처',
    `prompt_tokens` INTEGER NOT NULL COMMENT '입력 토큰 수',
    `completion_tokens` INTEGER NOT NULL COMMENT '출력 토큰 수',
    `total_tokens` INTEGER NOT NULL COMMENT '총 토큰 수',
    `cost_usd` DECIMAL(10, 6) NOT NULL COMMENT '비용(USD)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    INDEX `ai_usage_log_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='AI 사용량 로그';

-- CreateTable
CREATE TABLE `task` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `text` VARCHAR(300) NOT NULL COMMENT '할일 내용',
    `due_date` DATE NULL COMMENT '마감일',
    `priority` ENUM('low', 'normal', 'high') NOT NULL DEFAULT 'normal' COMMENT '우선순위',
    `memo` VARCHAR(300) NULL COMMENT '메모',
    `done` BOOLEAN NOT NULL DEFAULT false COMMENT '완료여부',
    `done_at` DATETIME(3) NULL COMMENT '완료시각(KST)',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `task_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='할일';

-- CreateTable
CREATE TABLE `goal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `name` VARCHAR(200) NOT NULL COMMENT '목표명',
    `unit` VARCHAR(10) NOT NULL COMMENT '단위(won/percent)',
    `current_val` DECIMAL(15, 2) NOT NULL COMMENT '현재값',
    `target_val` DECIMAL(15, 2) NOT NULL COMMENT '목표값',
    `pct` INTEGER NOT NULL COMMENT '진행률(%)',
    `tone` ENUM('green', 'warning', 'danger') NOT NULL DEFAULT 'green' COMMENT '진행바색',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `goal_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='목표';

-- CreateTable
CREATE TABLE `note` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `title` VARCHAR(200) NOT NULL COMMENT '제목',
    `body` TEXT NOT NULL COMMENT '본문(마크다운)',
    `tag` VARCHAR(50) NULL COMMENT '태그',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `note_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='메모';

-- CreateTable
CREATE TABLE `calendar_event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `date` DATE NOT NULL COMMENT '일정 날짜',
    `type` ENUM('pay', 'due', 'exp', 'task') NOT NULL COMMENT '일정유형',
    `title` VARCHAR(200) NOT NULL COMMENT '제목',
    `memo` VARCHAR(300) NULL COMMENT '메모',
    `recur_freq` ENUM('none', 'weekly', 'monthly', 'yearly') NOT NULL DEFAULT 'none' COMMENT '반복 주기',
    `recur_until` DATE NULL COMMENT '반복 종료일 (null = 무기한)',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `calendar_event_user_id_date_idx`(`user_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='캘린더 일정';

-- CreateTable
CREATE TABLE `security_risk` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `category` ENUM('reuse', 'weak', 'no2fa', 'breach') NOT NULL COMMENT '위험종류',
    `severity` ENUM('critical', 'danger', 'warning', 'info') NOT NULL COMMENT '심각도',
    `title` VARCHAR(200) NOT NULL COMMENT '제목',
    `description` VARCHAR(300) NOT NULL COMMENT '설명',
    `action_label` VARCHAR(20) NOT NULL COMMENT '처리버튼 라벨',
    `resolved` BOOLEAN NOT NULL DEFAULT false COMMENT '해결여부',
    `resolved_at` DATETIME(3) NULL COMMENT '해결시각(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `security_risk_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='보안 위험 요소';

-- CreateTable
CREATE TABLE `category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `domain` ENUM('transaction', 'subscription', 'asset', 'investment', 'saving', 'pay_method', 'bank', 'credential_cat', 'id_type', 'env_group') NOT NULL COMMENT '적용 도메인',
    `code` VARCHAR(50) NOT NULL COMMENT '카테고리 코드(영문)',
    `label` VARCHAR(100) NOT NULL COMMENT '표시명',
    `parent_code` VARCHAR(50) NULL COMMENT '대분류 code(소분류만, 대분류·단일계층 도메인은 NULL)',
    `sort_order` INTEGER NOT NULL DEFAULT 1 COMMENT '정렬 순서',
    `is_active` BOOLEAN NOT NULL DEFAULT true COMMENT '활성 여부',
    `created_by` INTEGER NULL COMMENT '생성자 user.id(감사용, FK 아님)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `category_domain_idx`(`domain`),
    INDEX `category_domain_parent_code_idx`(`domain`, `parent_code`),
    UNIQUE INDEX `category_domain_code_key`(`domain`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='카테고리(전역 공용)';

-- CreateTable
CREATE TABLE `login_session` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `device` VARCHAR(100) NOT NULL COMMENT '기기/브라우저',
    `device_type` ENUM('desktop', 'mobile', 'unknown') NOT NULL DEFAULT 'unknown' COMMENT '기기종류',
    `location` VARCHAR(100) NOT NULL COMMENT '위치/IP',
    `is_current` BOOLEAN NOT NULL DEFAULT false COMMENT '현재기기 여부',
    `status` ENUM('active', 'unverified') NOT NULL DEFAULT 'active' COMMENT '세션상태',
    `last_active_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '최근활동(KST)',
    `revoked_at` DATETIME(3) NULL COMMENT '로그아웃/차단 시각(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    INDEX `login_session_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='로그인 세션';

-- CreateTable
CREATE TABLE `refresh_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `session_id` INTEGER NULL COMMENT 'login_session.id FK',
    `jti` VARCHAR(36) NOT NULL COMMENT '토큰 식별자(JWT jti)',
    `expires_at` DATETIME(3) NOT NULL COMMENT '만료일(KST)',
    `revoked_at` DATETIME(3) NULL COMMENT '폐기일(KST), null=유효',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '발급일(KST)',

    UNIQUE INDEX `refresh_token_jti_key`(`jti`),
    INDEX `refresh_token_user_id_idx`(`user_id`),
    INDEX `refresh_token_session_id_idx`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='갱신 토큰 화이트리스트';

-- CreateTable
CREATE TABLE `email_login_code` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `email` VARCHAR(200) NOT NULL COMMENT '수신 이메일',
    `code_hash` VARCHAR(100) NOT NULL COMMENT '인증코드 해시',
    `expires_at` DATETIME(3) NOT NULL COMMENT '만료일(KST)',
    `consumed_at` DATETIME(3) NULL COMMENT '사용일(KST), null=미사용',
    `attempts` INTEGER NOT NULL DEFAULT 0 COMMENT '검증 시도 횟수',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '발급일(KST)',

    INDEX `email_login_code_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='이메일 로그인 인증코드';

-- CreateTable
CREATE TABLE `identity_card` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `type` ENUM('passport', 'idcard', 'license', 'cert', 'etc') NOT NULL COMMENT '종류',
    `name` VARCHAR(100) NOT NULL COMMENT '명칭',
    `number_enc` TEXT NOT NULL COMMENT '문서 번호(암호문)',
    `file_id` INTEGER NULL COMMENT 'storage_file.id FK (사본 이미지)',
    `issue_date` DATE NULL COMMENT '발급일',
    `expire_date` DATE NULL COMMENT '만료일',
    `memo` VARCHAR(300) NULL COMMENT '메모',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `identity_card_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='신원 지갑';

-- CreateTable
CREATE TABLE `credential` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `name` VARCHAR(100) NOT NULL COMMENT '서비스명',
    `url` VARCHAR(300) NULL COMMENT 'URL',
    `category` VARCHAR(50) NOT NULL COMMENT '카테고리',
    `username` VARCHAR(200) NOT NULL COMMENT '아이디',
    `password_enc` TEXT NOT NULL COMMENT '비밀번호(암호문)',
    `totp_enc` TEXT NULL COMMENT '2FA TOTP 시크릿(암호문)',
    `backup_codes_enc` TEXT NULL COMMENT '2FA 백업코드 목록(JSON 배열 암호문)',
    `password_changed_at` DATETIME(3) NULL COMMENT '비밀번호 마지막 변경 시각(KST)',
    `memo` VARCHAR(300) NULL COMMENT '메모',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `credential_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='계정 보관함';

-- CreateTable
CREATE TABLE `env_project` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `name` VARCHAR(100) NOT NULL COMMENT '프로젝트명',
    `description` VARCHAR(300) NULL COMMENT '설명',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `env_project_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='ENV 프로젝트';

-- CreateTable
CREATE TABLE `storage_folder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `parent_id` INTEGER NULL COMMENT 'storage_folder.id FK (null=루트)',
    `name` VARCHAR(200) NOT NULL COMMENT '폴더명',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `storage_folder_user_id_idx`(`user_id`),
    INDEX `storage_folder_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='파일 보관함 폴더';

-- CreateTable
CREATE TABLE `storage_file` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `folder_id` INTEGER NULL COMMENT 'storage_folder.id FK (null=루트)',
    `object_key` VARCHAR(500) NOT NULL COMMENT 'B2 오브젝트 키',
    `name` VARCHAR(300) NOT NULL COMMENT '원본 파일명',
    `size` BIGINT NOT NULL DEFAULT 0 COMMENT '파일 크기(바이트)',
    `mime_type` VARCHAR(100) NOT NULL COMMENT 'MIME 타입',
    `hash` VARCHAR(64) NULL COMMENT 'SHA-256(동일 내용 중복 제거용)',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `storage_file_user_id_idx`(`user_id`),
    INDEX `storage_file_folder_id_idx`(`folder_id`),
    INDEX `storage_file_user_id_hash_idx`(`user_id`, `hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='파일 보관함 파일';

-- CreateTable
CREATE TABLE `env_var` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `project_id` INTEGER NOT NULL COMMENT 'env_project.id FK',
    `env` ENUM('dev', 'staging', 'prod') NOT NULL COMMENT '환경',
    `group` VARCHAR(50) NULL COMMENT '그룹',
    `key` VARCHAR(150) NOT NULL COMMENT 'KEY',
    `value_enc` TEXT NOT NULL COMMENT '값(암호문)',
    `memo` VARCHAR(300) NULL COMMENT '메모',
    `deleted_at` DATETIME(3) NULL COMMENT '삭제일(KST)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '수정일(KST)',

    INDEX `env_var_user_id_idx`(`user_id`),
    INDEX `env_var_project_id_env_idx`(`project_id`, `env`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='ENV 변수';

-- CreateTable
CREATE TABLE `env_var_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `env_var_id` INTEGER NOT NULL COMMENT 'env_var.id FK',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `value_enc` TEXT NOT NULL COMMENT '이전 값(암호문)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '기록일(KST)',

    INDEX `env_var_history_env_var_id_created_at_idx`(`env_var_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='ENV 변수 값 변경 이력';

-- CreateTable
CREATE TABLE `access_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `action` ENUM('cred_reveal', 'cred_totp', 'cred_backup', 'identity_reveal', 'env_reveal', 'backup_codes_generate', 'vault_unlock', 'vault_disable', 'session_revoke', 'data_export') NOT NULL COMMENT '열람 동작',
    `target_type` VARCHAR(20) NOT NULL COMMENT '대상 종류(credential|identity|env)',
    `target_id` INTEGER NOT NULL COMMENT '대상 레코드 id',
    `target_name` VARCHAR(200) NOT NULL COMMENT '대상 표시명(열람 시점 스냅샷)',
    `ip` VARCHAR(60) NULL COMMENT '접속 IP',
    `user_agent` VARCHAR(300) NULL COMMENT 'User-Agent',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '열람일(KST)',

    INDEX `access_log_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='보관함 접근 감사 로그';

-- CreateTable
CREATE TABLE `security_score_snapshot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `date` VARCHAR(10) NOT NULL COMMENT '날짜(YYYY-MM-DD, KST)',
    `score` INTEGER NOT NULL COMMENT '보안 점수 0~100',
    `reuse` INTEGER NOT NULL DEFAULT 0 COMMENT '재사용 비밀번호 건수',
    `weak` INTEGER NOT NULL DEFAULT 0 COMMENT '취약 비밀번호 건수',
    `no2fa` INTEGER NOT NULL DEFAULT 0 COMMENT '2FA 미설정 건수',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    INDEX `security_score_snapshot_user_id_idx`(`user_id`),
    UNIQUE INDEX `security_score_snapshot_user_id_date_key`(`user_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='보안점수 일별 스냅샷';

-- CreateTable
CREATE TABLE `system_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NULL COMMENT '관련 사용자 (전역 이벤트는 null)',
    `level` VARCHAR(10) NOT NULL COMMENT 'info | warn | error',
    `category` VARCHAR(30) NOT NULL COMMENT 'recurring_buy | cron | asset 등',
    `message` TEXT NOT NULL COMMENT '메시지',
    `metadata` JSON NULL COMMENT '추가 컨텍스트',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일',

    INDEX `system_log_level_idx`(`level`),
    INDEX `system_log_category_idx`(`category`),
    INDEX `system_log_created_at_idx`(`created_at`),
    INDEX `system_log_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='시스템 로그';

-- CreateTable
CREATE TABLE `push_subscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id` INTEGER NOT NULL COMMENT 'user.id FK',
    `endpoint` VARCHAR(500) NOT NULL COMMENT '브라우저 푸시 서비스 엔드포인트 URL',
    `p256dh` VARCHAR(255) NOT NULL COMMENT '페이로드 암호화용 공개키(Base64URL)',
    `auth` VARCHAR(255) NOT NULL COMMENT '페이로드 인증 시크릿(Base64URL)',
    `user_agent` VARCHAR(300) NULL COMMENT '구독 생성 기기 식별용(선택)',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    UNIQUE INDEX `push_subscription_endpoint_key`(`endpoint`),
    INDEX `push_subscription_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='웹 푸시 구독';

-- AddForeignKey
ALTER TABLE `transaction` ADD CONSTRAINT `transaction_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saving` ADD CONSTRAINT `saving_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `investment_account` ADD CONSTRAINT `investment_account_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `investment` ADD CONSTRAINT `investment_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `investment` ADD CONSTRAINT `investment_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `investment_account`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset` ADD CONSTRAINT `asset_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `net_worth_snapshot` ADD CONSTRAINT `net_worth_snapshot_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_report` ADD CONSTRAINT `ai_report_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_usage_log` ADD CONSTRAINT `ai_usage_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `task_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal` ADD CONSTRAINT `goal_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `note` ADD CONSTRAINT `note_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_event` ADD CONSTRAINT `calendar_event_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `security_risk` ADD CONSTRAINT `security_risk_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_session` ADD CONSTRAINT `login_session_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_token` ADD CONSTRAINT `refresh_token_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_token` ADD CONSTRAINT `refresh_token_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `login_session`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `identity_card` ADD CONSTRAINT `identity_card_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `identity_card` ADD CONSTRAINT `identity_card_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `storage_file`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credential` ADD CONSTRAINT `credential_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `env_project` ADD CONSTRAINT `env_project_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `storage_folder` ADD CONSTRAINT `storage_folder_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `storage_folder` ADD CONSTRAINT `storage_folder_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `storage_folder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `storage_file` ADD CONSTRAINT `storage_file_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `storage_file` ADD CONSTRAINT `storage_file_folder_id_fkey` FOREIGN KEY (`folder_id`) REFERENCES `storage_folder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `env_var` ADD CONSTRAINT `env_var_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `env_var` ADD CONSTRAINT `env_var_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `env_project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `env_var_history` ADD CONSTRAINT `env_var_history_env_var_id_fkey` FOREIGN KEY (`env_var_id`) REFERENCES `env_var`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `access_log` ADD CONSTRAINT `access_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `security_score_snapshot` ADD CONSTRAINT `security_score_snapshot_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_subscription` ADD CONSTRAINT `push_subscription_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

