-- DropForeignKey
ALTER TABLE `ai_report` DROP FOREIGN KEY `ai_report_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ai_usage_log` DROP FOREIGN KEY `ai_usage_log_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `asset` DROP FOREIGN KEY `asset_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `calendar_event` DROP FOREIGN KEY `calendar_event_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `credential` DROP FOREIGN KEY `credential_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `env_project` DROP FOREIGN KEY `env_project_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `env_var` DROP FOREIGN KEY `env_var_project_id_fkey`;

-- DropForeignKey
ALTER TABLE `env_var` DROP FOREIGN KEY `env_var_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `goal` DROP FOREIGN KEY `goal_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `identity_card` DROP FOREIGN KEY `identity_card_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `investment` DROP FOREIGN KEY `investment_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `login_session` DROP FOREIGN KEY `login_session_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `net_worth_snapshot` DROP FOREIGN KEY `net_worth_snapshot_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `note` DROP FOREIGN KEY `note_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `notification_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `push_subscription` DROP FOREIGN KEY `push_subscription_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `saving` DROP FOREIGN KEY `saving_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `security_risk` DROP FOREIGN KEY `security_risk_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `storage_file` DROP FOREIGN KEY `storage_file_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `storage_folder` DROP FOREIGN KEY `storage_folder_parent_id_fkey`;

-- DropForeignKey
ALTER TABLE `storage_folder` DROP FOREIGN KEY `storage_folder_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `subscription` DROP FOREIGN KEY `subscription_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `task` DROP FOREIGN KEY `task_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `transaction` DROP FOREIGN KEY `transaction_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `user_settings` DROP FOREIGN KEY `user_settings_user_id_fkey`;

-- AlterTable
ALTER TABLE `ai_usage_log` ALTER COLUMN `cost_usd` DROP DEFAULT;

-- AddForeignKey
ALTER TABLE `transaction` ADD CONSTRAINT `transaction_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saving` ADD CONSTRAINT `saving_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `investment` ADD CONSTRAINT `investment_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE `identity_card` ADD CONSTRAINT `identity_card_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
