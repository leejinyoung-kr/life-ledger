'use client';

/**
 * 메모 페이지.
 * 좌측 노트 목록 + 우측 마크다운 에디터(편집/미리보기 탭)로 구성된다.
 * 미리보기는 react-markdown + remark-gfm(표·체크리스트)으로 렌더하며 데이터는 API(/notes)와 연동한다.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AppShell from '@/components/AppShell';
import { IconSearch, IconPlus } from '@/components/icons';
import { api } from '@/lib/api';
import { formatNoteDate, type Note } from '@/lib/note';

type EditTab = 'edit' | 'preview';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<EditTab>('edit');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

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
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // 현재 메모 저장 (PUT)
  async function saveNote() {
    if (!note) return;
    setSaving(true); setError(null);
    try {
      const updated = await api.put<Note>(`/notes/${note.id}`, { title: note.title, body: note.body, tag: note.tag ?? '' });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // 현재 메모 삭제 (DELETE)
  async function deleteNote() {
    if (!note || !window.confirm('이 메모를 삭제할까요?')) return;
    try {
      await api.del(`/notes/${note.id}`);
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== note.id);
        setSelectedId(next[0]?.id ?? null);
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
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
            {error && <p className="ledger-note is-error">⚠️ {error}</p>}
            {filtered.length === 0 && <p className="muted-note notif-empty">메모가 없습니다.</p>}
            {filtered.map((n) => (
              <div key={n.id} className={`note-item${n.id === selectedId ? ' active' : ''}`} onClick={() => setSelectedId(n.id)}>
                <div className="note-item-title">{n.title}</div>
                <div className="note-item-preview">{n.body.replace(/[#>*`\-|]/g, '').trim().slice(0, 40) || '내용 없음'}</div>
                <div className="note-item-meta">
                  <span className="note-item-date">{formatNoteDate(n.updatedAt)}</span>
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
                <button type="button" className="btn btn-ghost" title="저장" onClick={saveNote} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
                <button type="button" className="btn btn-danger" onClick={deleteNote} title="삭제">삭제</button>
              </div>
            </div>

            {/* 제목 */}
            <div className="editor-title-row">
              <input className="editor-title-input" type="text" placeholder="제목을 입력하세요..." value={note.title} onChange={(e) => patchNote({ title: e.target.value })} aria-label="메모 제목" />
            </div>

            {/* 메타: 날짜 + 태그 */}
            <div className="editor-meta-row">
              <span className="editor-date">{formatNoteDate(note.updatedAt)}</span>
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
