-- ============================================================
--  Doc-Nexus  — 통합 초기 마이그레이션
--  Provider : MySQL (utf8mb4_unicode_ci)
--  타임스탬프 : KST 기준 (BEFORE INSERT/UPDATE 트리거)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. 회원
-- ────────────────────────────────────────────────────────────
CREATE TABLE `user` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `google_id`  VARCHAR(100) NOT NULL                COMMENT 'Google 계정 고유 ID',
    `email`      VARCHAR(200) NOT NULL                COMMENT '이메일',
    `name`       VARCHAR(100) NOT NULL                COMMENT '이름',
    `picture`    VARCHAR(500) NULL                    COMMENT '프로필 사진 URL',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    UNIQUE INDEX `user_google_id_key`(`google_id`),
    UNIQUE INDEX `user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='회원';


-- ────────────────────────────────────────────────────────────
-- 2. 가계부 — 수입/지출, 예적금, 투자
-- ────────────────────────────────────────────────────────────
CREATE TABLE `transaction` (
    `id`                   INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`              INTEGER       NOT NULL                COMMENT 'user.id FK',
    `type`                 ENUM('income','expense','transfer') NOT NULL COMMENT '거래유형',
    `date`                 DATE          NOT NULL                COMMENT '거래일',
    `title`                VARCHAR(200)  NOT NULL                COMMENT '내역명',
    `category`             VARCHAR(50)   NOT NULL                COMMENT '카테고리코드',
    `amount`               DECIMAL(15,2) NOT NULL                COMMENT '금액(원)',
    `pay_method`           VARCHAR(50)   NOT NULL                COMMENT '결제수단',
    `memo`                 VARCHAR(300)  NULL                    COMMENT '메모',
    `is_recurring`         BOOLEAN       NOT NULL DEFAULT false  COMMENT '반복거래 여부',
    `recurring_rule`       JSON          NULL                    COMMENT '반복규칙',
    `recurring_parent_id`  INT           NULL                    COMMENT '반복 원본 transaction.id (자동 생성 회차)',
    `recurring_period`     VARCHAR(10)   NULL                    COMMENT '반복 회차 식별 (YYYY-MM / YYYY / YYYY-MM-DD)',
    `recurring_overridden` BOOLEAN       NOT NULL DEFAULT false  COMMENT '사용자 개별 수정 회차(범위 수정 보존)',
    `deleted_at`           DATETIME(3)   NULL                    COMMENT '삭제일(KST)',
    `created_at`           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`           DATETIME(3)   NOT NULL                COMMENT '수정일(KST)',

    INDEX `transaction_user_id_date_idx`(`user_id`, `date`),
    INDEX `transaction_recurring_parent_id_idx`(`recurring_parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='수입/지출 내역';

CREATE TABLE `saving` (
    `id`             INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`        INTEGER       NOT NULL                COMMENT 'user.id FK',
    `bank`           VARCHAR(100)  NOT NULL                COMMENT '은행/기관',
    `name`           VARCHAR(100)  NOT NULL                COMMENT '상품명',
    `type`           ENUM('savings','deposit','subscription','etc') NOT NULL COMMENT '예적금유형',
    `interest_rate`  DECIMAL(5,2)  NOT NULL                COMMENT '금리(%)',
    `monthly_amount` DECIMAL(15,2) NOT NULL                COMMENT '월 납입액(원)',
    `start_date`     DATE          NOT NULL                COMMENT '가입일',
    `maturity_date`  DATE          NULL                    COMMENT '만기일',
    `balance`        DECIMAL(15,2) NOT NULL                COMMENT '현재 잔액(원)',
    `memo`           VARCHAR(300)  NULL                    COMMENT '메모',
    `deleted_at`     DATETIME(3)   NULL                    COMMENT '삭제일(KST)',
    `created_at`     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`     DATETIME(3)   NOT NULL                COMMENT '수정일(KST)',

    INDEX `saving_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='예적금';

CREATE TABLE `investment` (
    `id`            INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`       INTEGER       NOT NULL                COMMENT 'user.id FK',
    `name`          VARCHAR(100)  NOT NULL                COMMENT '종목명',
    `type`          ENUM('domestic_stock','foreign_stock','foreign_etf','domestic_etf','crypto','etc') NOT NULL COMMENT '투자유형',
    `principal`     DECIMAL(15,2) NOT NULL                COMMENT '투자원금(원)',
    `current_value` DECIMAL(15,2) NOT NULL                COMMENT '현재 평가금액(원)',
    `purchase_date` DATE          NULL                    COMMENT '최초 매수일',
    `memo`          VARCHAR(300)  NULL                    COMMENT '메모',
    `deleted_at`    DATETIME(3)   NULL                    COMMENT '삭제일(KST)',
    `created_at`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`    DATETIME(3)   NOT NULL                COMMENT '수정일(KST)',

    INDEX `investment_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='투자';


-- ────────────────────────────────────────────────────────────
-- 3. 구독 관리
-- ────────────────────────────────────────────────────────────
CREATE TABLE `subscription` (
    `id`                INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`           INTEGER       NOT NULL                COMMENT 'user.id FK',
    `name`              VARCHAR(100)  NOT NULL                COMMENT '서비스명',
    `category`          VARCHAR(50)   NOT NULL                COMMENT '카테고리코드',
    `amount`            DECIMAL(15,2) NOT NULL                COMMENT '결제금액(원)',
    `cycle`             ENUM('monthly','yearly','weekly') NOT NULL DEFAULT 'monthly' COMMENT '결제주기',
    `status`            ENUM('active','trial','paused')   NOT NULL DEFAULT 'active'  COMMENT '상태',
    `next_payment_date` DATE          NOT NULL                COMMENT '다음 결제일',
    `pay_method`        VARCHAR(50)   NOT NULL                COMMENT '결제수단',
    `last_used_at`      DATE          NULL                    COMMENT '마지막 사용일',
    `memo`              VARCHAR(300)  NULL                    COMMENT '메모',
    `deleted_at`        DATETIME(3)   NULL                    COMMENT '해지일(KST)',
    `created_at`        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`        DATETIME(3)   NOT NULL                COMMENT '수정일(KST)',

    INDEX `subscription_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='구독';


-- ────────────────────────────────────────────────────────────
-- 4. 자산 종합 — 자산/부채, 순자산 스냅샷
-- ────────────────────────────────────────────────────────────
CREATE TABLE `asset` (
    `id`            INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`       INTEGER       NOT NULL                COMMENT 'user.id FK',
    `type`          ENUM('cash','savings','investment','realestate','debt','etc') NOT NULL COMMENT '자산유형',
    `name`          VARCHAR(100)  NOT NULL                COMMENT '자산명',
    `amount`        DECIMAL(15,2) NOT NULL                COMMENT '금액(원)',
    `interest_rate` DECIMAL(5,2)  NULL                    COMMENT '금리(%)',
    `memo`          VARCHAR(300)  NULL                    COMMENT '메모',
    `deleted_at`    DATETIME(3)   NULL                    COMMENT '삭제일(KST)',
    `created_at`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`    DATETIME(3)   NOT NULL                COMMENT '수정일(KST)',

    INDEX `asset_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='자산/부채';

CREATE TABLE `net_worth_snapshot` (
    `id`           INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`      INTEGER       NOT NULL                COMMENT 'user.id FK',
    `month`        VARCHAR(7)    NOT NULL                COMMENT '기준월(YYYY-MM)',
    `total_assets` DECIMAL(15,2) NOT NULL                COMMENT '총자산(원)',
    `total_debt`   DECIMAL(15,2) NOT NULL                COMMENT '총부채(원)',
    `created_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    UNIQUE INDEX `net_worth_snapshot_user_id_month_key`(`user_id`, `month`),
    INDEX `net_worth_snapshot_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='순자산 월별 스냅샷';


-- ────────────────────────────────────────────────────────────
-- 5. 월별 예산 오버라이드 및 이월
-- ────────────────────────────────────────────────────────────
CREATE TABLE `monthly_budget` (
    `id`                  INTEGER      NOT NULL AUTO_INCREMENT                                                        COMMENT '고유번호',
    `user_id`             INTEGER      NOT NULL                                                                       COMMENT 'user.id FK',
    `year_month`          VARCHAR(7)   NOT NULL                                                                       COMMENT '예산 적용 월(YYYY-MM)',
    `category`            VARCHAR(50)  NOT NULL                                                                       COMMENT '카테고리 코드(food·transport…)',
    `amount`              INTEGER      NOT NULL                                                                       COMMENT '이 달 오버라이드 예산(원, 0=기본값 유지)',
    `carried_over_amount` INTEGER      NOT NULL DEFAULT 0                                                            COMMENT '전달 잔여 이월 금액(원)',
    `created_at`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)                                         COMMENT '생성일(KST)',
    `updated_at`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)          COMMENT '수정일(KST)',

    UNIQUE INDEX `uq_user_yearmonth_category`(`user_id`, `year_month`, `category`),
    INDEX `idx_monthly_budget_user_month`(`user_id`, `year_month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='월별 예산 오버라이드 및 이월';


-- ────────────────────────────────────────────────────────────
-- 6. 사용자 설정
-- ────────────────────────────────────────────────────────────
CREATE TABLE `user_settings` (
    `id`             INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`        INTEGER      NOT NULL                COMMENT 'user.id FK',
    `display_name`   VARCHAR(100) NULL                    COMMENT '표시 이름',
    `notif_budget`   BOOLEAN      NOT NULL DEFAULT true   COMMENT '예산 초과 알림',
    `notif_monthly`  BOOLEAN      NOT NULL DEFAULT true   COMMENT '월간 리포트 자동생성 알림',
    `notif_upload`   BOOLEAN      NOT NULL DEFAULT false  COMMENT '파일 업로드 완료 알림',
    `session_expiry` VARCHAR(10)  NOT NULL DEFAULT '7d'   COMMENT '세션 자동만료',
    `pw_auto_hide`   VARCHAR(10)  NOT NULL DEFAULT '10s'  COMMENT '비밀번호 자동숨김',
    `claude_api_key` VARCHAR(200) NULL                    COMMENT 'Claude API 키',
    `claude_model`   VARCHAR(50)  NOT NULL DEFAULT 'claude-sonnet-4-6' COMMENT 'Claude 모델',
    `budgets`        JSON         NOT NULL                COMMENT '카테고리별 월 예산',
    `categories`     JSON         NOT NULL                COMMENT '카테고리 목록',
    `widgets`        JSON         NOT NULL                COMMENT '대시보드 위젯 표시/순서',
    `menu_order`     JSON         NULL                    COMMENT '사이드바 1차 메뉴 순서(key 배열)',
    `created_at`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`     DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    UNIQUE INDEX `user_settings_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='사용자 설정';


-- ────────────────────────────────────────────────────────────
-- 7. 알림
-- ────────────────────────────────────────────────────────────
CREATE TABLE `notification` (
    `id`          INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`     INTEGER      NOT NULL                COMMENT 'user.id FK',
    `group`       ENUM('ledger','system')          NOT NULL COMMENT '알림그룹',
    `tone`        ENUM('warning','success','info') NOT NULL COMMENT '톤',
    `title`       VARCHAR(200) NOT NULL                COMMENT '제목',
    `description` VARCHAR(500) NOT NULL                COMMENT '내용',
    `source`      VARCHAR(50)  NOT NULL                COMMENT '발생처 라벨',
    `read_at`     DATETIME(3)  NULL                    COMMENT '읽은시각(KST)',
    `occurred_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '발생시각(화면표시용)',
    `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    INDEX `notification_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='알림';


-- ────────────────────────────────────────────────────────────
-- 8. 할일 / 목표
-- ────────────────────────────────────────────────────────────
CREATE TABLE `task` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`    INTEGER      NOT NULL                COMMENT 'user.id FK',
    `text`       VARCHAR(300) NOT NULL                COMMENT '할일 내용',
    `due_date`   DATE         NULL                    COMMENT '마감일',
    `priority`   ENUM('low','normal','high') NOT NULL DEFAULT 'normal' COMMENT '우선순위',
    `memo`       VARCHAR(300) NULL                    COMMENT '메모',
    `done`       BOOLEAN      NOT NULL DEFAULT false  COMMENT '완료여부',
    `done_at`    DATETIME(3)  NULL                    COMMENT '완료시각(KST)',
    `deleted_at` DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `task_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='할일';

CREATE TABLE `goal` (
    `id`          INTEGER       NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`     INTEGER       NOT NULL                COMMENT 'user.id FK',
    `name`        VARCHAR(200)  NOT NULL                COMMENT '목표명',
    `unit`        VARCHAR(10)   NOT NULL                COMMENT '단위(won/percent)',
    `current_val` DECIMAL(15,2) NOT NULL                COMMENT '현재값',
    `target_val`  DECIMAL(15,2) NOT NULL                COMMENT '목표값',
    `pct`         INTEGER       NOT NULL                COMMENT '진행률(%)',
    `tone`        ENUM('green','warning','danger') NOT NULL DEFAULT 'green' COMMENT '진행바색',
    `deleted_at`  DATETIME(3)   NULL                    COMMENT '삭제일(KST)',
    `created_at`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`  DATETIME(3)   NOT NULL                COMMENT '수정일(KST)',

    INDEX `goal_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='목표';


-- ────────────────────────────────────────────────────────────
-- 9. 메모
-- ────────────────────────────────────────────────────────────
CREATE TABLE `note` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`    INTEGER      NOT NULL                COMMENT 'user.id FK',
    `title`      VARCHAR(200) NOT NULL                COMMENT '제목',
    `body`       TEXT         NOT NULL                COMMENT '본문(마크다운)',
    `tag`        VARCHAR(50)  NULL                    COMMENT '태그',
    `deleted_at` DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `note_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='메모';


-- ────────────────────────────────────────────────────────────
-- 10. 캘린더
-- ────────────────────────────────────────────────────────────
CREATE TABLE `calendar_event` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`    INTEGER      NOT NULL                COMMENT 'user.id FK',
    `date`       DATE         NOT NULL                COMMENT '일정 날짜',
    `type`       ENUM('pay','due','exp','task') NOT NULL COMMENT '일정유형',
    `title`      VARCHAR(200) NOT NULL                COMMENT '제목',
    `memo`       VARCHAR(300) NULL                    COMMENT '메모',
    `deleted_at` DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `calendar_event_user_id_date_idx`(`user_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='캘린더 일정';


-- ────────────────────────────────────────────────────────────
-- 11. 보안 센터 — 위험 요소, 로그인 세션
-- ────────────────────────────────────────────────────────────
CREATE TABLE `security_risk` (
    `id`           INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`      INTEGER      NOT NULL                COMMENT 'user.id FK',
    `category`     ENUM('reuse','weak','no2fa','breach')      NOT NULL COMMENT '위험종류',
    `severity`     ENUM('critical','danger','warning','info') NOT NULL COMMENT '심각도',
    `title`        VARCHAR(200) NOT NULL                COMMENT '제목',
    `description`  VARCHAR(300) NOT NULL                COMMENT '설명',
    `action_label` VARCHAR(20)  NOT NULL                COMMENT '처리버튼 라벨',
    `resolved`     BOOLEAN      NOT NULL DEFAULT false  COMMENT '해결여부',
    `resolved_at`  DATETIME(3)  NULL                    COMMENT '해결시각(KST)',
    `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`   DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `security_risk_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='보안 위험 요소';

CREATE TABLE `login_session` (
    `id`             INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`        INTEGER      NOT NULL                COMMENT 'user.id FK',
    `device`         VARCHAR(100) NOT NULL                COMMENT '기기/브라우저',
    `device_type`    ENUM('desktop','mobile','unknown') NOT NULL DEFAULT 'unknown' COMMENT '기기종류',
    `location`       VARCHAR(100) NOT NULL                COMMENT '위치/IP',
    `is_current`     BOOLEAN      NOT NULL DEFAULT false  COMMENT '현재기기 여부',
    `status`         ENUM('active','unverified') NOT NULL DEFAULT 'active' COMMENT '세션상태',
    `last_active_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '최근활동(KST)',
    `revoked_at`     DATETIME(3)  NULL                    COMMENT '로그아웃/차단 시각(KST)',
    `created_at`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',

    INDEX `login_session_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='로그인 세션';


-- ────────────────────────────────────────────────────────────
-- 12. 카테고리 (설정 > 카테고리 관리)
-- ────────────────────────────────────────────────────────────
CREATE TABLE `category` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`    INTEGER      NOT NULL                COMMENT 'user.id FK',
    `domain`     ENUM(
                     'transaction',
                     'subscription',
                     'asset',
                     'investment',
                     'saving',
                     'pay_method',
                     'credential_cat',
                     'id_type',
                     'env_group'
                 ) NOT NULL COMMENT '적용 도메인',
    `code`       VARCHAR(50)  NOT NULL                COMMENT '카테고리 코드(영문)',
    `label`      VARCHAR(100) NOT NULL                COMMENT '표시명',
    `sort_order` INTEGER      NOT NULL DEFAULT 1      COMMENT '정렬 순서',
    `is_active`  BOOLEAN      NOT NULL DEFAULT true   COMMENT '활성 여부',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `category_user_id_domain_idx`(`user_id`, `domain`),
    UNIQUE INDEX `category_user_id_domain_code_key`(`user_id`, `domain`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='카테고리';


-- ────────────────────────────────────────────────────────────
-- 13. 보안 금고 — 신원 지갑, 계정 보관함, ENV 관리
-- ────────────────────────────────────────────────────────────
CREATE TABLE `identity_card` (
    `id`          INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`     INTEGER      NOT NULL                COMMENT 'user.id FK',
    `type`        ENUM('passport','idcard','license','cert','etc') NOT NULL COMMENT '종류',
    `name`        VARCHAR(100) NOT NULL                COMMENT '명칭',
    `number_enc`  TEXT         NOT NULL                COMMENT '문서 번호(암호문)',
    `issue_date`  DATE         NULL                    COMMENT '발급일',
    `expire_date` DATE         NULL                    COMMENT '만료일',
    `memo`        VARCHAR(300) NULL                    COMMENT '메모',
    `deleted_at`  DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`  DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `identity_card_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='신원 지갑';

CREATE TABLE `credential` (
    `id`           INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`      INTEGER      NOT NULL                COMMENT 'user.id FK',
    `name`         VARCHAR(100) NOT NULL                COMMENT '서비스명',
    `url`          VARCHAR(300) NULL                    COMMENT 'URL',
    `category`     VARCHAR(50)  NOT NULL                COMMENT '카테고리',
    `username`     VARCHAR(200) NOT NULL                COMMENT '아이디',
    `password_enc` TEXT         NOT NULL                COMMENT '비밀번호(암호문)',
    `totp_enc`     TEXT         NULL                    COMMENT '2FA TOTP 시크릿(암호문)',
    `memo`         VARCHAR(300) NULL                    COMMENT '메모',
    `deleted_at`   DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`   DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `credential_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='계정 보관함';

CREATE TABLE `env_project` (
    `id`          INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`     INTEGER      NOT NULL                COMMENT 'user.id FK',
    `name`        VARCHAR(100) NOT NULL                COMMENT '프로젝트명',
    `description` VARCHAR(300) NULL                    COMMENT '설명',
    `deleted_at`  DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at`  DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `env_project_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='ENV 프로젝트';

CREATE TABLE `env_var` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT COMMENT '고유번호',
    `user_id`    INTEGER      NOT NULL                COMMENT 'user.id FK',
    `project_id` INTEGER      NOT NULL                COMMENT 'env_project.id FK',
    `env`        ENUM('dev','staging','prod') NOT NULL COMMENT '환경',
    `group`      VARCHAR(50)  NULL                    COMMENT '그룹',
    `key`        VARCHAR(150) NOT NULL                COMMENT 'KEY',
    `value_enc`  TEXT         NOT NULL                COMMENT '값(암호문)',
    `memo`       VARCHAR(300) NULL                    COMMENT '메모',
    `deleted_at` DATETIME(3)  NULL                    COMMENT '삭제일(KST)',
    `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '생성일(KST)',
    `updated_at` DATETIME(3)  NOT NULL                COMMENT '수정일(KST)',

    INDEX `env_var_user_id_idx`(`user_id`),
    INDEX `env_var_project_id_env_idx`(`project_id`, `env`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='ENV 변수';


-- ============================================================
-- Foreign Keys
-- ============================================================
ALTER TABLE `transaction`      ADD CONSTRAINT `transaction_user_id_fkey`           FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `saving`           ADD CONSTRAINT `saving_user_id_fkey`                FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `investment`       ADD CONSTRAINT `investment_user_id_fkey`            FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `subscription`     ADD CONSTRAINT `subscription_user_id_fkey`          FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `asset`            ADD CONSTRAINT `asset_user_id_fkey`                 FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `net_worth_snapshot` ADD CONSTRAINT `net_worth_snapshot_user_id_fkey`  FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `monthly_budget`   ADD CONSTRAINT `monthly_budget_user_id_fkey`        FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE `user_settings`    ADD CONSTRAINT `user_settings_user_id_fkey`         FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `notification`     ADD CONSTRAINT `notification_user_id_fkey`          FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `task`             ADD CONSTRAINT `task_user_id_fkey`                  FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `goal`             ADD CONSTRAINT `goal_user_id_fkey`                  FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `note`             ADD CONSTRAINT `note_user_id_fkey`                  FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `calendar_event`   ADD CONSTRAINT `calendar_event_user_id_fkey`        FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `security_risk`    ADD CONSTRAINT `security_risk_user_id_fkey`         FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `login_session`    ADD CONSTRAINT `login_session_user_id_fkey`         FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `category`         ADD CONSTRAINT `category_user_id_fkey`              FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `identity_card`    ADD CONSTRAINT `identity_card_user_id_fkey`         FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `credential`       ADD CONSTRAINT `credential_user_id_fkey`            FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `env_project`      ADD CONSTRAINT `env_project_user_id_fkey`           FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `env_var`          ADD CONSTRAINT `env_var_user_id_fkey`               FOREIGN KEY (`user_id`)     REFERENCES `user`(`id`)         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `env_var`          ADD CONSTRAINT `env_var_project_id_fkey`            FOREIGN KEY (`project_id`)  REFERENCES `env_project`(`id`)  ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================
-- KST 타임스탬프 트리거
-- ============================================================
CREATE TRIGGER `tr_user_bi`              BEFORE INSERT ON `user`              FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_user_bu`              BEFORE UPDATE ON `user`              FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_transaction_bi`       BEFORE INSERT ON `transaction`       FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_transaction_bu`       BEFORE UPDATE ON `transaction`       FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_saving_bi`            BEFORE INSERT ON `saving`            FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_saving_bu`            BEFORE UPDATE ON `saving`            FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_investment_bi`        BEFORE INSERT ON `investment`        FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_investment_bu`        BEFORE UPDATE ON `investment`        FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_subscription_bi`      BEFORE INSERT ON `subscription`      FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_subscription_bu`      BEFORE UPDATE ON `subscription`      FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_asset_bi`             BEFORE INSERT ON `asset`             FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_asset_bu`             BEFORE UPDATE ON `asset`             FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_net_worth_snapshot_bi` BEFORE INSERT ON `net_worth_snapshot` FOR EACH ROW SET NEW.created_at = NOW();

CREATE TRIGGER `tr_user_settings_bi`     BEFORE INSERT ON `user_settings`     FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_user_settings_bu`     BEFORE UPDATE ON `user_settings`     FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_notification_bi`      BEFORE INSERT ON `notification`      FOR EACH ROW SET NEW.created_at = NOW();

CREATE TRIGGER `tr_task_bi`              BEFORE INSERT ON `task`              FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_task_bu`              BEFORE UPDATE ON `task`              FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_goal_bi`              BEFORE INSERT ON `goal`              FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_goal_bu`              BEFORE UPDATE ON `goal`              FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_note_bi`              BEFORE INSERT ON `note`              FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_note_bu`              BEFORE UPDATE ON `note`              FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_calendar_event_bi`    BEFORE INSERT ON `calendar_event`    FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_calendar_event_bu`    BEFORE UPDATE ON `calendar_event`    FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_security_risk_bi`     BEFORE INSERT ON `security_risk`     FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_security_risk_bu`     BEFORE UPDATE ON `security_risk`     FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_login_session_bi`     BEFORE INSERT ON `login_session`     FOR EACH ROW SET NEW.created_at = NOW();

CREATE TRIGGER `tr_category_bi`          BEFORE INSERT ON `category`          FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_category_bu`          BEFORE UPDATE ON `category`          FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_identity_card_bi`     BEFORE INSERT ON `identity_card`     FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_identity_card_bu`     BEFORE UPDATE ON `identity_card`     FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_credential_bi`        BEFORE INSERT ON `credential`        FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_credential_bu`        BEFORE UPDATE ON `credential`        FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_env_project_bi`       BEFORE INSERT ON `env_project`       FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_env_project_bu`       BEFORE UPDATE ON `env_project`       FOR EACH ROW SET NEW.updated_at = NOW();

CREATE TRIGGER `tr_env_var_bi`           BEFORE INSERT ON `env_var`           FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_env_var_bu`           BEFORE UPDATE ON `env_var`           FOR EACH ROW SET NEW.updated_at = NOW();
