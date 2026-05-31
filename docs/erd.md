# DocNexus — ERD

## 테이블 목록

| 테이블 | 설명 |
|--------|------|
| User | 사용자 |
| Menu | 사용자별 메뉴 설정 |
| Transaction | 수입/지출 내역 |
| Budget | 카테고리별 예산 |
| Credential | 계정 보관함 (암호화) |
| File | 파일 메타데이터 |
| Folder | 폴더 구조 |
| Note | 메모/노트 |
| Saving | 예적금 |
| Investment | 투자 |
| Notification | 알림 |
| Report | AI 리포트 |
| WidgetSetting | 대시보드 위젯 설정 |

## 주요 관계

```
User 1 ─── N Transaction
User 1 ─── N Budget
User 1 ─── N Credential
User 1 ─── N Folder
Folder 1 ─── N File
User 1 ─── N Note
User 1 ─── N Saving
User 1 ─── N Investment
User 1 ─── N Notification
User 1 ─── N Report
User 1 ─── 1 WidgetSetting
User 1 ─── N Menu
```

## 스키마 (Prisma)

> Prisma 미구현 — `backend/prisma/schema.prisma` 파일 없음
