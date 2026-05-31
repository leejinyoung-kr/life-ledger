# DocNexus — API 명세

Base URL: `http://localhost:8000/api/v1`

> 상세 문서: Swagger UI → http://localhost:8000/api-docs  
> 아래 엔드포인트는 설계 명세이며, 현재 미구현 상태입니다.

## 인증

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /auth/google | Google OAuth 로그인 리다이렉트 |
| GET | /auth/google/callback | OAuth 콜백, JWT 발급 |
| POST | /auth/refresh | Access Token 갱신 |
| POST | /auth/logout | 로그아웃 |

## 대시보드 (미구현)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /dashboard/summary | 이번 달 요약 통계 |
| GET | /dashboard/budget-status | 카테고리별 예산 현황 |
| GET | /dashboard/activity | 최근 활동 목록 |

## 가계부 (미구현)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /transactions | 내역 목록 |
| POST | /transactions | 내역 추가 |
| PUT | /transactions/:id | 내역 수정 |
| DELETE | /transactions/:id | 내역 삭제 |
| GET | /transactions/export | 엑셀 내보내기 |
| POST | /transactions/import | 엑셀 가져오기 |

## 계정 보관함 (미구현)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /credentials | 목록 |
| POST | /credentials | 추가 |
| PUT | /credentials/:id | 수정 |
| DELETE | /credentials/:id | 삭제 |
| GET | /credentials/:id/decrypt | PW 복호화 |

## 파일 보관함 (미구현)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /folders | 폴더 목록 |
| POST | /folders | 폴더 생성 |
| GET | /files | 파일 목록 |
| POST | /files/upload | 파일 업로드 |
| GET | /files/:id/download | 다운로드 URL |
| DELETE | /files/:id | 파일 삭제 |

## 메모 (미구현)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /notes | 목록 |
| GET | /notes/:id | 상세 |
| POST | /notes | 생성 |
| PUT | /notes/:id | 수정 |
| DELETE | /notes/:id | 삭제 |

## AI 리포트 (미구현)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /reports/generate | 리포트 생성 |
| GET | /reports | 목록 |
| GET | /reports/:id | 상세 |
| DELETE | /reports/:id | 삭제 |

## 통합 검색 (미구현)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /search?q= | 전체 검색 |
