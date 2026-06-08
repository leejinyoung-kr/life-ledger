-- AI 제공자 전환: Claude → OpenAI (AI 리포트)
-- user_settings 의 claude_* 컬럼을 openai_* 로 리네임하고 기본 모델을 gpt-4o-mini 로 변경
ALTER TABLE `user_settings`
  CHANGE COLUMN `claude_api_key` `openai_api_key` VARCHAR(200) NULL                              COMMENT 'OpenAI API 키',
  CHANGE COLUMN `claude_model`   `openai_model`   VARCHAR(50)  NOT NULL DEFAULT 'gpt-4o-mini'    COMMENT 'AI 리포트 생성 모델';

-- 기존 행 정리: Claude 모델/키는 OpenAI 에서 무효이므로 기본값으로 되돌림
UPDATE `user_settings` SET `openai_model`   = 'gpt-4o-mini' WHERE `openai_model`   LIKE 'claude-%';
UPDATE `user_settings` SET `openai_api_key` = NULL          WHERE `openai_api_key` LIKE 'sk-ant-%';
