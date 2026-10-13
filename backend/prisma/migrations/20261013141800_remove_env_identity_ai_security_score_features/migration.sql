-- 공개 준비 1단계: ENV 보관함 · 신원 지갑 · AI 리포트 · 보안 점수 기능 제거.
-- enum 값을 줄이기 전에 그 값을 쓰는 행을 먼저 지운다 (안 지우면 ALTER 가 실패한다).
DELETE FROM `access_log` WHERE `action` IN ('env_reveal', 'identity_reveal');
DELETE FROM `category` WHERE `domain` IN ('env_group', 'id_type');

-- DropForeignKey
ALTER TABLE `ai_report` DROP FOREIGN KEY `ai_report_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ai_usage_log` DROP FOREIGN KEY `ai_usage_log_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `security_risk` DROP FOREIGN KEY `security_risk_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `identity_card` DROP FOREIGN KEY `identity_card_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `identity_card` DROP FOREIGN KEY `identity_card_file_id_fkey`;

-- DropForeignKey
ALTER TABLE `env_project` DROP FOREIGN KEY `env_project_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `env_var` DROP FOREIGN KEY `env_var_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `env_var` DROP FOREIGN KEY `env_var_project_id_fkey`;

-- DropForeignKey
ALTER TABLE `env_var_history` DROP FOREIGN KEY `env_var_history_env_var_id_fkey`;

-- DropForeignKey
ALTER TABLE `security_score_snapshot` DROP FOREIGN KEY `security_score_snapshot_user_id_fkey`;

-- AlterTable
ALTER TABLE `user_settings` DROP COLUMN `menu_order`,
    DROP COLUMN `notif_monthly`,
    DROP COLUMN `openai_api_key`,
    DROP COLUMN `openai_model`,
    DROP COLUMN `widgets`;

-- AlterTable
ALTER TABLE `category` MODIFY `domain` ENUM('transaction', 'subscription', 'asset', 'investment', 'saving', 'pay_method', 'bank', 'credential_cat') NOT NULL;

-- AlterTable
ALTER TABLE `access_log` MODIFY `action` ENUM('cred_reveal', 'cred_totp', 'cred_backup', 'backup_codes_generate', 'vault_unlock', 'vault_disable', 'session_revoke', 'data_export') NOT NULL;

-- DropTable
DROP TABLE `ai_report`;

-- DropTable
DROP TABLE `ai_usage_log`;

-- DropTable
DROP TABLE `security_risk`;

-- DropTable
DROP TABLE `identity_card`;

-- DropTable
DROP TABLE `env_project`;

-- DropTable
DROP TABLE `env_var`;

-- DropTable
DROP TABLE `env_var_history`;

-- DropTable
DROP TABLE `security_score_snapshot`;
