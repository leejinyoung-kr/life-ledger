/**
 * 메모(Note) 더미.
 * 마크다운 본문(표/체크리스트/코드블록)으로 미리보기 렌더 검증. 태그·도메인 다양하게.
 */
import type { SeedFn } from './helpers';

type NoteSeed = { title: string; tag: string | null; body: string };

const NOTES: NoteSeed[] = [
  {
    title: '월간 지출 분석 메모',
    tag: '가계부',
    body: `## 이번 달 지출 요약

- **총 지출**: ₩842,300
- **총 수입**: ₩3,200,000
- **잔액**: ₩2,357,700

## 구독 서비스 정리 필요

| 서비스 | 금액 | 상태 |
|--------|------|------|
| 넷플릭스 | ₩17,000 | 유지 |
| ChatGPT Plus | ₩28,000 | 유지 |
| Spotify | ₩10,900 | **해지 검토** |
| Adobe | ₩55,000 | **해지 검토** |

## 다음 달 목표

- [ ] 구독 서비스 2개 이상 해지
- [ ] 식비 ₩300,000 이하로 줄이기
- [ ] 교통비 대중교통 위주 유지

> 구독 과다 소비가 전체 지출의 25%를 차지하고 있어 정리가 시급함.`,
  },
  {
    title: '개발 환경 세팅 체크리스트',
    tag: '개발',
    body: `# doc-nexus 개발 환경 세팅

## 필수 설치

- [x] Node.js 20 LTS
- [x] Docker Desktop
- [ ] NestJS CLI \`npm i -g @nestjs/cli\`
- [ ] pnpm \`npm i -g pnpm\`

## 로컬 DB 세팅

\`\`\`bash
docker run -d --name doc-nexus-mysql -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 mysql:8.0
\`\`\``,
  },
  {
    title: '보험 갱신 일정',
    tag: '기타',
    body: `# 보험 갱신 일정

| 보험 종류 | 만료일 | 갱신 방법 |
|----------|--------|----------|
| 자동차보험 | 2026.09.01 | 온라인 갱신 |
| 실손보험 | 2026.11.15 | 보험사 방문 |
| 화재보험 | 2027.03.01 | 자동 갱신 |

> 자동차보험은 8월 중 비교 견적 필수`,
  },
  {
    title: 'doc-nexus 기능 아이디어',
    tag: '개발',
    body: `# doc-nexus 기능 아이디어

## 단기 (1~2주)
- [x] 파일 뷰어 (PDF.js)
- [x] 메모/노트 에디터
- [ ] 통합 검색 (top-bar)
- [ ] 대시보드 위젯 커스텀

## 장기
- [ ] 문서 에디터 (Word 대용)
- [ ] PDF 내보내기`,
  },
  {
    title: '자주 쓰는 계정 정리',
    tag: '기타',
    body: `# 자주 접속하는 계정

## 개발
- GitHub: 코드 저장소
- Vercel: 배포

## 금융
- 카카오뱅크: 주 계좌

> 상세 ID/PW는 계정 보관함 참조`,
  },
];

// 한 사용자에게 메모 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedNotes: SeedFn = async (prisma, userId) => {
  await prisma.note.deleteMany({ where: { user_id: userId } });

  for (const n of NOTES) {
    await prisma.note.create({
      data: { user_id: userId, title: n.title, body: n.body, tag: n.tag },
    });
  }
  return NOTES.length;
};
