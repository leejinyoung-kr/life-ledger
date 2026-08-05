-- AlterTable
ALTER TABLE `env_var` ADD COLUMN `location` VARCHAR(150) NULL COMMENT 'env 파일 위치 (예: backend/.env, frontend/.env.local)';
