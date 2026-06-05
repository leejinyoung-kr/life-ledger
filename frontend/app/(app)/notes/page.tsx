'use client';

/**
 * 메모 페이지.
 * 좌측 노트 목록 + 우측 마크다운 에디터(편집/미리보기 탭)로 구성된다.
 * 미리보기는 react-markdown + remark-gfm(표·체크리스트)으로 렌더하며 데이터는 API(/notes)와 연동한다.
 * 스타일: Tailwind. md-preview(마크다운 렌더 스타일)는 공통 globals 유지.
 * 모바일은 목록↔에디터 전환(노트 선택 시 에디터, "← 목록"으로 복귀).
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { notify } from '@/lib/toast';
import { useConfirm } from '@/components/ConfirmModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AppShell from '@/components/AppShell';
import Button from '@/components/ui/Button';
import { IconSearch } from '@/components/icons';
import { api } from '@/lib/api';
import { formatNoteDate, type Note } from '@/lib/note';

type EditTab = 'edit' | 'preview';

// 포맷 툴바 버튼 공통 클래스
const TB = 'w-[30px] h-[30px] rounded-[5px] flex items-center justify-center text-secondary text-[0.8rem] font-semibold transition-all cursor-pointer hover:bg-surface hover:text-primary [&_svg]:w-3.5 [&_svg]:h-3.5';
const TB_DIV = 'w-px h-5 bg-border mx-1.5 shrink-0';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<EditTab>('edit');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const { confirm, confirmElement } = useConfirm();

  // 메모 목록 조회 (선택 항목 유지, 없으면 첫 항목 선택)
  const load = useCallback(async () => {
    try {
      const list = await api.get<Note[]>('/notes');
      setNotes(list);
      setSelectedId((prev) => (prev && list.some((n) => n.id === prev) ? prev : list[0]?.id ?? null));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const note = notes.find((n) => n.id === selectedId) ?? null;

  // 노트 선택 (모바일은 에디터로 전환)
  function selectNote(id: number) {
    setSelectedId(id);
    setMobileView('editor');
  }

  // 선택 노트의 필드를 로컬 갱신 (저장 버튼으로 서버 반영)
  function patchNote(patch: Partial<Note>) {
    if (selectedId === null) return;
    setNotes((prev) => prev.map((n) => (n.id === selectedId ? { ...n, ...patch } : n)));
  }

  // 새 메모 추가 (POST 후 선택)
  async function newNote() {
    try {
      const created = await api.post<Note>('/notes', { title: '새 메모', body: '', tag: '기타' });
      setNotes((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setTab('edit');
      setMobileView('editor');
      notify.success('새 메모가 생성됐습니다.');
    } catch (e) {
      setError((e as Error).message);
      notify.error('메모 생성에 실패했습니다.');
    }
  }

  // 현재 메모 저장 (PUT)
  async function saveNote() {
    if (!note) return;
    setSaving(true); setError(null);
    try {
      const updated = await api.put<Note>(`/notes/${note.id}`, { title: note.title, body: note.body, tag: note.tag ?? '' });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      notify.saved('메모');
    } catch (e) {
      setError((e as Error).message);
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  // 현재 메모 삭제 (DELETE)
  async function deleteNote() {
    if (!note) return;
    if (!await confirm('이 메모를 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/notes/${note.id}`);
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== note.id);
        setSelectedId(next[0]?.id ?? null);
        return next;
      });
      setMobileView('list');
      notify.deleted('메모');
    } catch (e) {
      setError((e as Error).message);
      notify.deleteFailed();
    }
  }

  // 선택 영역을 prefix/suffix 로 감싸는 마크다운 삽입
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

  // 현재 줄 맨 앞에 prefix 삽입
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
  function addTag(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const v = e.currentTarget.value.trim();
    if (v) patchNote({ tag: v });
    e.currentTarget.value = '';
  }

  const filtered = notes
    .filter((n) => !search.trim() || n.title.toLowerCase().includes(search.toLowerCase()) || n.body.toLowerCase().includes(search.toLowerCase()));

  const charCount = note?.body.length ?? 0;
  const lineCount = note ? note.body.split('\n').length : 0;

  return (
    <AppShell activePath="/notes" topbarLabel="메모" bare>
      <div className="flex h-[calc(100vh-var(--header-h))] overflow-hidden max-md:h-[calc(100vh-var(--header-h)-60px)]">
        {/* 목록 패널 */}
        <div className={`w-[280px] border-r border-border flex flex-col overflow-hidden bg-background shrink-0 max-md:w-full max-md:border-r-0 ${mobileView === 'editor' ? 'max-md:hidden' : ''}`}>
          <div className="p-4 border-b border-border flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="[font-family:var(--font-display)] text-[0.9rem] font-bold text-primary">메모 <span className="text-muted font-normal text-[0.8rem]">{notes.length}개</span></span>
              <Button size="sm" onClick={newNote}>새 메모</Button>
            </div>
            <div className="relative">
              <IconSearch className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted w-[15px] h-[15px] pointer-events-none" />
              <input className="input pl-icon" type="text" placeholder="메모 검색..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} aria-label="메모 검색" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {error && <p className="px-2 py-1.5 text-[0.78rem] text-danger">⚠️ {error}</p>}
            {filtered.length === 0 && <p className="text-center text-muted py-5 text-[0.875rem]">메모가 없습니다.</p>}
            {filtered.map((n) => {
              const active = n.id === selectedId;
              return (
                <div key={n.id} className={`p-3 rounded-[var(--radius)] cursor-pointer transition-colors border border-transparent mb-0.5 hover:bg-surface ${active ? 'bg-accent-dim border-[rgba(0,192,127,0.2)]' : ''}`} onClick={() => selectNote(n.id)}>
                  <div className={`text-[0.855rem] font-semibold truncate mb-1 ${active ? 'text-accent' : 'text-primary'}`}>{n.title}</div>
                  <div className="text-[0.75rem] text-muted truncate leading-snug">{n.body.replace(/[#>*`\-|]/g, '').trim().slice(0, 40) || '내용 없음'}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[0.68rem] text-muted">{formatNoteDate(n.updatedAt)}</span>
                    {n.tag && <span className="text-[0.65rem] px-[7px] py-px rounded-full bg-elevated text-muted font-medium">{n.tag}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 에디터 패널 */}
        {note && (
          <div className={`flex-1 flex flex-col overflow-hidden bg-background ${mobileView === 'list' ? 'max-md:hidden' : ''}`}>
            {/* 포맷 툴바 */}
            <div className="flex items-center gap-1 px-5 py-2.5 border-b border-border shrink-0 flex-wrap">
              <button type="button" className={`${TB} hidden max-md:flex w-auto px-2 text-[0.78rem]`} onClick={() => setMobileView('list')}>← 목록</button>
              <div className="flex items-center gap-0.5">
                <button type="button" className={TB} onClick={() => wrap('**', '**')} title="굵게"><strong>B</strong></button>
                <button type="button" className={TB} onClick={() => wrap('*', '*')} title="기울임"><em>I</em></button>
                <button type="button" className={`${TB} line-through`} onClick={() => wrap('~~', '~~')} title="취소선">S</button>
                <button type="button" className={`${TB} [font-family:var(--font-mono)] text-[0.75rem]`} onClick={() => wrap('`', '`')} title="인라인 코드">&lt;/&gt;</button>
              </div>
              <div className={TB_DIV} />
              <div className="flex items-center gap-0.5">
                <button type="button" className={`${TB} text-[0.7rem] font-bold`} onClick={() => linePrefix('# ')} title="제목 1">H1</button>
                <button type="button" className={`${TB} text-[0.7rem] font-bold`} onClick={() => linePrefix('## ')} title="제목 2">H2</button>
                <button type="button" className={`${TB} text-[0.7rem] font-bold`} onClick={() => linePrefix('### ')} title="제목 3">H3</button>
              </div>
              <div className={TB_DIV} />
              <div className="flex items-center gap-0.5">
                <button type="button" className={TB} onClick={() => linePrefix('- ')} title="목록">•</button>
                <button type="button" className={TB} onClick={() => linePrefix('1. ')} title="번호 목록">1.</button>
                <button type="button" className={TB} onClick={() => linePrefix('- [ ] ')} title="체크리스트">☐</button>
                <button type="button" className={TB} onClick={() => linePrefix('> ')} title="인용">❝</button>
              </div>
              <div className={TB_DIV} />
              <div className="flex items-center gap-0.5">
                <button type="button" className={TB} onClick={() => wrap('\n```\n', '\n```\n')} title="코드 블록">{'{}'}</button>
                <button type="button" className={TB} onClick={() => wrap('\n---\n', '')} title="구분선">―</button>
              </div>
              <div className="ml-auto flex gap-1.5 items-center">
                <Button variant="ghost" size="sm" onClick={saveNote} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
                <Button variant="danger" size="sm" onClick={deleteNote}>삭제</Button>
              </div>
            </div>

            {/* 제목 */}
            <div className="px-6 pt-5 shrink-0">
              <input className="w-full [font-family:var(--font-display)] text-[1.4rem] font-bold text-primary border-none outline-none bg-transparent tracking-[-0.02em] placeholder:text-muted" type="text" placeholder="제목을 입력하세요..." value={note.title} onChange={(e) => patchNote({ title: e.target.value })} aria-label="메모 제목" />
            </div>

            {/* 메타: 날짜 + 태그 */}
            <div className="px-6 py-2.5 flex items-center gap-3 shrink-0 border-b border-border-subtle">
              <span className="text-[0.75rem] text-muted">{formatNoteDate(note.updatedAt)}</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {note.tag && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-elevated text-secondary text-[0.72rem] font-medium">{note.tag} <button type="button" className="text-muted hover:text-danger" onClick={removeTag} aria-label="태그 삭제">✕</button></span>}
                <input type="text" className="border-none outline-none bg-transparent text-[0.72rem] text-secondary w-[60px]" placeholder="+ 태그" onKeyDown={addTag} aria-label="태그 추가" />
              </div>
            </div>

            {/* 편집/미리보기 탭 */}
            <div className="flex px-6 border-b border-border shrink-0 mt-1">
              {(['edit', 'preview'] as const).map((t) => (
                <button key={t} type="button" className={`px-3.5 py-2 text-[0.8rem] font-medium cursor-pointer border-b-2 -mb-px transition-all ${tab === t ? 'text-accent border-accent font-semibold' : 'text-muted border-transparent hover:text-secondary'}`} onClick={() => setTab(t)}>
                  {t === 'edit' ? '편집' : '미리보기'}
                </button>
              ))}
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col">
                {tab === 'edit' ? (
                  <textarea
                    ref={editorRef}
                    className="flex-1 w-full min-h-[300px] border-none outline-none bg-transparent [font-family:var(--font-mono)] text-[0.875rem] text-primary leading-[1.8] resize-none"
                    placeholder="마크다운으로 메모를 작성하세요..."
                    value={note.body}
                    onChange={(e) => patchNote({ body: e.target.value })}
                  />
                ) : (
                  /* 마크다운 렌더 스타일은 공통 globals(.md-preview) 유지 */
                  <div className="md-preview flex-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>

            {/* 상태바 */}
            <div className="px-6 py-2 border-t border-border flex items-center gap-4 text-[0.72rem] text-muted shrink-0">
              <span>글자 수: {charCount}</span>
              <span>줄 수: {lineCount}</span>
              <span className="ml-auto">마크다운 지원</span>
            </div>
          </div>
        )}
      </div>
      {confirmElement}
    </AppShell>
  );
}
