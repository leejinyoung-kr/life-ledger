-- 시각 컬럼을 UTC → KST 벽시계로 옮긴다 (infra ADR 0008). 앱은 같은 배포부터 core-db withKstDateTime 으로 KST 를 쓰고 읽는다
-- 대상은 information_schema 의 datetime 열 전부 (25개 표 · 65개 열, 2026-10-28 DB 와 schema.prisma 대조). DATE 열(12개)은 이미 한국 날짜라 건드리지 않는다
-- 데이터만 바꾸고 DDL 을 섞지 않아 한 트랜잭션으로 묶인다. 되돌리기: 같은 목록을 - INTERVAL 9 HOUR
START TRANSACTION;

UPDATE `user` SET
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `transaction` SET
    `deleted_at` = `deleted_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `transaction_favorite` SET
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `saving` SET
    `deleted_at` = `deleted_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `investment_account` SET
    `deleted_at` = `deleted_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `investment` SET
    `deleted_at` = `deleted_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `recurring_schedule` SET
    `deleted_at` = `deleted_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `subscription` SET
    `deleted_at` = `deleted_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `net_worth_snapshot` SET
    `created_at` = `created_at` + INTERVAL 9 HOUR;

UPDATE `user_settings` SET
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `notification` SET
    `read_at` = `read_at` + INTERVAL 9 HOUR,
    `occurred_at` = `occurred_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR;

UPDATE `calendar_event` SET
    `deleted_at` = `deleted_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `holiday` SET
    `created_at` = `created_at` + INTERVAL 9 HOUR;

UPDATE `category` SET
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `login_session` SET
    `last_active_at` = `last_active_at` + INTERVAL 9 HOUR,
    `revoked_at` = `revoked_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR;

UPDATE `refresh_token` SET
    `expires_at` = `expires_at` + INTERVAL 9 HOUR,
    `revoked_at` = `revoked_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR;

UPDATE `email_login_code` SET
    `expires_at` = `expires_at` + INTERVAL 9 HOUR,
    `consumed_at` = `consumed_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR;

UPDATE `credential` SET
    `password_changed_at` = `password_changed_at` + INTERVAL 9 HOUR,
    `deleted_at` = `deleted_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `storage_folder` SET
    `deleted_at` = `deleted_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `storage_file` SET
    `deleted_at` = `deleted_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

UPDATE `access_log` SET
    `created_at` = `created_at` + INTERVAL 9 HOUR;

UPDATE `job_run` SET
    `started_at` = `started_at` + INTERVAL 9 HOUR,
    `lease_until` = `lease_until` + INTERVAL 9 HOUR,
    `finished_at` = `finished_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR;

UPDATE `system_log` SET
    `created_at` = `created_at` + INTERVAL 9 HOUR;

UPDATE `push_subscription` SET
    `created_at` = `created_at` + INTERVAL 9 HOUR;

UPDATE `outbox_message` SET
    `available_at` = `available_at` + INTERVAL 9 HOUR,
    `claimed_until` = `claimed_until` + INTERVAL 9 HOUR,
    `sent_at` = `sent_at` + INTERVAL 9 HOUR,
    `created_at` = `created_at` + INTERVAL 9 HOUR,
    `updated_at` = `updated_at` + INTERVAL 9 HOUR;

COMMIT;
