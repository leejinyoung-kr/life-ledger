-- OpenAI API 키를 AES-256-GCM 암호문('v1:iv:tag:cipher')으로 저장하도록 변경.
-- 암호문이 평문보다 길어(특히 sk-proj 키) 200 으로는 부족 → 512 로 확장.
ALTER TABLE `user_settings`
    MODIFY `openai_api_key` VARCHAR(512) NULL COMMENT 'OpenAI API 키 (AES-256-GCM 암호문)';
