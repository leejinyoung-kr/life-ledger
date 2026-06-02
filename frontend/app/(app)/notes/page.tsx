'use client';

/**
 * 메모 페이지.
 * 좌측 노트 목록 + 우측 마크다운 에디터(편집/미리보기 탭)로 구성된다.
 * 미리보기는 react-markdown + remark-gfm(표·체크리스트)으로 렌더하며 데이터는 더미.
 */
import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AppShell from '@/components/AppShell';
import { IconSearch, IconPlus } from '@/components/icons';

interface Note { title: string; date: string; tag: string; body: string; }

// ── 더미 데이터 (TODO: GET /api/v1/notes) ───────────────────────
const INITIAL_NOTES: Note[] = [
  {
    title: '월간 지출 분석 메모', date: '2025년 5월 31일', tag: '가계부',
    body: `## 이번 달 지출 요약

- **총 지출**: ₩842,300
- **총 수입**: ₩3,200,000
- **잔액**: ₩2,357,700

## 구독 서비스 정리 필요

| 서비스 | 금액 | 상태 |
|--------|------|------|
| 넷플릭스 | ₩17,000 | 유지 |
| ChatGPT Plus | ₩27,000 | 유지 |
| Spotify | ₩10,900 | **해지 검토** |
| Adobe | ₩77,000 | **해지 검토** |

## 다음 달 목표

- [ ] 구독 서비스 2개 이상 해지
- [ ] 식비 ₩300,000 이하로 줄이기
- [ ] 교통비 대중교통 위주 유지

> 구독 과다 소비가 전체 지출의 25%를 차지하고 있어 정리가 시급함.

---

*마지막 수정: 2025.05.31*`,
  },
  {
    title: '개발 환경 세팅 체크리스트', date: '2025년 5월 28일', tag: '개발',
    body: `# doc-nexus 개발 환경 세팅

## 필수 설치

- [x] Node.js 20 LTS
- [x] Docker Desktop
- [ ] NestJS CLI \`npm i -g @nestjs/cli\`
- [ ] pnpm \`npm i -g pnpm\`

## 로컬 DB 세팅

\`\`\`bash
docker run -d --name doc-nexus-mysql -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 mysql:8.0
\`\`\`

## 환경 변수

\`\`\`
DATABASE_URL=mysql://root:root@localhost:3306/doc_nexus
CLAUDE_API_KEY=sk-ant-...
\`\`\``,
  },
  {
    title: '보험 갱신 일정', date: '2025년 5월 20일', tag: '기타',
    body: `# 보험 갱신 일정

| 보험 종류 | 만료일 | 갱신 방법 |
|----------|--------|----------|
| 자동차보험 | 2025.09.01 | 온라인 갱신 |
| 실손보험 | 2025.11.15 | 보험사 방문 |
| 화재보험 | 2026.03.01 | 자동 갱신 |

> 자동차보험은 8월 중 비교 견적 필수`,
  },
  {
    title: 'doc-nexus 기능 아이디어', date: '2025년 5월 15일', tag: '개발',
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
    title: '자주 쓰는 계정 정리', date: '2025년 5월 10일', tag: '기타',
    body: `# 자주 접속하는 계정

## 개발
- GitHub: 코드 저장소
- Vercel: 배포

## 금융
- 카카오뱅크: 주 계좌

> 상세 ID/PW는 계정 보관함 참조`,
  },
];

type EditTab = 'edit' | 'preview';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES);
  const [idx, setIdx] = useState(0);
  const [tab, setTab] = useState<EditTab>('edit');
  const [search, setSearch] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const note = notes[idx];

  // 현재 노트의 필드 갱신 (제목/본문/태그)
  function patchNote(patch: Partial<Note>) {
    setNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, ...patch } : n)));
  }

  // 새 메모 추가 후 선택. TODO: POST /api/v1/notes
  function newNote() {
    setNotes((prev) => [{ title: '새 메모', date: '방금 전', tag: '기타', body: '' }, ...prev]);
    setIdx(0);
    setTab('edit');
  }

  // 현재 메모 삭제. TODO: DELETE /api/v1/notes/:id
  function deleteNote() {
    setNotes((prev) => prev.filter((_, i) => i !== idx));
    setIdx(0);
  }

  // 선택 영역을 prefix/suffix 로 감싸는 마크다운 삽입 (굵게·코드 등)
  function wrap(prefix: string, suffix: string) {
    const ta = editorRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const next = value.slice(0, s) + prefix + value.slice(s, e) + suffix + value.slice(e);
    patchNote({ body: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = s + prefix.length;
      ta.selectionEnd = e + prefix.length;
    });
  }

  // 현재 줄 맨 앞에 prefix 삽입 (제목·목록·체크리스트 등)
  function linePrefix(prefix: string) {
    const ta = editorRef.current;
    if (!ta) return;
    const { selectionStart: s, value } = ta;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    patchNote({ body: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s + prefix.length;
    });
  }

  // 현재 노트의 태그 제거
  function removeTag() {
    patchNote({ tag: '' });
  }

  // 태그 입력 후 Enter 로 추가
  function addTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const v = e.currentTarget.value.trim();
    if (v) patchNote({ tag: v });
    e.currentTarget.value = '';
  }

  const filtered = notes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => !search.trim() || n.title.toLowerCase().includes(search.toLowerCase()) || n.body.toLowerCase().includes(search.toLowerCase()));

  const charCount = note?.body.length ?? 0;
  const lineCount = note ? note.body.split('\n').length : 0;

  const topbarRight = (
    <button type="button" className="btn btn-primary" onClick={newNote}>
      <IconPlus width={13} height={13} />새 메모
    </button>
  );

  return (
    <AppShell activePath="/notes" topbarLabel="메모" topbarRight={topbarRight} bare>
      <div className="notes-layout">
        {/* 목록 패널 */}
        <div className="notes-list-panel">
          <div className="notes-list-header">
            <span className="notes-list-title">메모 <span className="count">{notes.length}개</span></span>
            <div className="search-wrap">
              <IconSearch className="search-icon" />
              <input className="input" type="text" placeholder="메모 검색..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="메모 검색" />
            </div>
          </div>
          <div className="notes-list-scroll">
            {filtered.map(({ n, i }) => (
              <div key={i} className={`note-item${i === idx ? ' active' : ''}`} onClick={() => setIdx(i)}>
                <div className="note-item-title">{n.title}</div>
                <div className="note-item-preview">{n.body.replace(/[#>*`\-|]/g, '').trim().slice(0, 40) || '내용 없음'}</div>
                <div className="note-item-meta">
                  <span className="note-item-date">{n.date}</span>
                  {n.tag && <span className="note-tag">{n.tag}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 에디터 패널 */}
        {note && (
          <div className="notes-editor-panel">
            {/* 포맷 툴바 */}
            <div className="editor-toolbar">
              <div className="editor-toolbar-group">
                <button type="button" className="tb-btn" onClick={() => wrap('**', '**')} title="굵게"><strong>B</strong></button>
                <button type="button" className="tb-btn" onClick={() => wrap('*', '*')} title="기울임"><em>I</em></button>
                <button type="button" className="tb-btn strike" onClick={() => wrap('~~', '~~')} title="취소선">S</button>
                <button type="button" className="tb-btn mono" onClick={() => wrap('`', '`')} title="인라인 코드">&lt;/&gt;</button>
              </div>
              <div className="toolbar-divider" />
              <div className="editor-toolbar-group">
                <button type="button" className="tb-btn head" onClick={() => linePrefix('# ')} title="제목 1">H1</button>
                <button type="button" className="tb-btn head" onClick={() => linePrefix('## ')} title="제목 2">H2</button>
                <button type="button" className="tb-btn head" onClick={() => linePrefix('### ')} title="제목 3">H3</button>
              </div>
              <div className="toolbar-divider" />
              <div className="editor-toolbar-group">
                <button type="button" className="tb-btn" onClick={() => linePrefix('- ')} title="목록">•</button>
                <button type="button" className="tb-btn" onClick={() => linePrefix('1. ')} title="번호 목록">1.</button>
                <button type="button" className="tb-btn" onClick={() => linePrefix('- [ ] ')} title="체크리스트">☐</button>
                <button type="button" className="tb-btn" onClick={() => linePrefix('> ')} title="인용">❝</button>
              </div>
              <div className="toolbar-divider" />
              <div className="editor-toolbar-group">
                <button type="button" className="tb-btn" onClick={() => wrap('\n```\n', '\n```\n')} title="코드 블록">{'{}'}</button>
                <button type="button" className="tb-btn" onClick={() => wrap('\n---\n', '')} title="구분선">―</button>
              </div>
              <div className="tb-spacer">
                {/* TODO: 저장 API 연동 */}
                <button type="button" className="btn btn-ghost" title="저장">저장</button>
                <button type="button" className="btn btn-danger" onClick={deleteNote} title="삭제">삭제</button>
              </div>
            </div>

            {/* 제목 */}
            <div className="editor-title-row">
              <input className="editor-title-input" type="text" placeholder="제목을 입력하세요..." value={note.title} onChange={(e) => patchNote({ title: e.target.value })} aria-label="메모 제목" />
            </div>

            {/* 메타: 날짜 + 태그 */}
            <div className="editor-meta-row">
              <span className="editor-date">{note.date}</span>
              <div className="tag-input-wrap">
                {note.tag && <span className="tag-pill">{note.tag} <button type="button" onClick={removeTag} aria-label="태그 삭제">✕</button></span>}
                <input type="text" className="tag-add-input" placeholder="+ 태그" onKeyDown={addTag} aria-label="태그 추가" />
              </div>
            </div>

            {/* 편집/미리보기 탭 */}
            <div className="editor-tabs">
              <button type="button" className={`editor-tab${tab === 'edit' ? ' active' : ''}`} onClick={() => setTab('edit')}>편집</button>
              <button type="button" className={`editor-tab${tab === 'preview' ? ' active' : ''}`} onClick={() => setTab('preview')}>미리보기</button>
            </div>

            {/* 본문 */}
            <div className="editor-body">
              {tab === 'edit' ? (
                <div className="editor-pane">
                  <textarea
                    ref={editorRef}
                    className="md-textarea"
                    placeholder="마크다운으로 메모를 작성하세요..."
                    value={note.body}
                    onChange={(e) => patchNote({ body: e.target.value })}
                  />
                </div>
              ) : (
                <div className="editor-pane">
                  <div className="md-preview">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            {/* 상태바 */}
            <div className="editor-statusbar">
              <span>글자 수: {charCount}</span>
              <span>줄 수: {lineCount}</span>
              <span className="right">마크다운 지원</span>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
