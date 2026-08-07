-- staging 환경 미사용 결정에 따라 env_kind에서 제거. 기존 staging 값 데이터는 삭제.
DELETE FROM `env_var` WHERE `env` = 'staging';

-- AlterTable
ALTER TABLE `env_var` MODIFY `env` ENUM('dev', 'prod') NOT NULL COMMENT '환경';
