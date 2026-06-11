-- AlterTable
ALTER TABLE `access_log` MODIFY `action` ENUM('cred_reveal', 'cred_totp', 'cred_backup', 'identity_reveal', 'env_reveal', 'backup_codes_generate', 'vault_unlock', 'vault_disable', 'session_revoke', 'data_export') NOT NULL;
