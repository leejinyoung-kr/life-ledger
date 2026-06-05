'use client';

/**
 * 공통 통합 검색바.
 * 가계부/계정/파일/메모를 한 입력창에서 검색하고 타입별로 그룹핑해 드롭다운으로 보여준다.
 * ⌘K / Ctrl+K 단축키로 포커스, Esc 로 닫기.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

type SearchType = 'tx' | 'note' | 'cred' | 'id' | 'env';

interface SearchEntry {
  type: SearchType;
  icon: string;
  title: string;
  sub: string;
  href: string;
}

// 타입 코드 → 한글 라벨
const TYPE_LABEL: Record<SearchType, string> = { tx: '가계부', note: '메모', cred: '계정', id: '신원', env: 'ENV' };

// 정규식 특수문자 이스케이프 (검색어를 안전하게 하이라이트하기 위함)
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 검색어와 일치하는 부분을 <mark> 로 강조.
// 캡처 그룹으로 split 하면 홀수 인덱스가 매칭 부분 → 인덱스 패리티로 판별 (정규식 lastIndex 부작용 회피).
function highlight(text: string, q: string) {
  if (!q) return text;
  const re = new RegExp(`(${escapeRegExp(q)})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-accent-dim text-accent rounded-[2px]">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // 검색어 변경 시 디바운스 후 통합 검색 API 호출
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      api.get<SearchEntry[]>(`/search?q=${encodeURIComponent(q)}`)
        .then((r) => { if (!cancelled) setResults(r); })
        .catch(() => { if (!cancelled) setResults([]); });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  // ⌘K/Ctrl+K → 검색창 포커스, Esc → 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // 결과를 타입별로 묶고 타입당 최대 3개로 제한
  const groups = results.reduce<Record<string, SearchEntry[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  const isEmpty = query.trim() !== '' && results.length === 0;

  return (
    <div className="relative flex items-center flex-1 max-w-[480px] max-[600px]:hidden">
      <IconSearchInline />
      <input
        ref={inputRef}
        className="w-full h-[34px] bg-surface border border-border rounded-[var(--radius)] pl-8 pr-[70px] text-[0.82rem] text-primary outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-dim)]"
        type="text"
        placeholder="통합 검색... (가계부·메모·계정·신원·ENV)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setOpen(true); } }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        autoComplete="off"
      />
      <span className="absolute right-2.5 text-[0.68rem] text-muted bg-elevated border border-border rounded-[4px] px-[5px] py-px pointer-events-none [font-family:var(--font-mono)] max-[900px]:hidden">⌘K</span>

      <div className={`${open ? 'block' : 'hidden'} absolute top-[calc(100%+6px)] left-0 w-full min-w-[320px] bg-background border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] z-[300] overflow-hidden`}>
        {isEmpty ? (
          <div className="p-6 text-center text-[0.855rem] text-muted">검색 결과가 없습니다.</div>
        ) : !query.trim() ? (
          <div className="p-6 text-center text-[0.855rem] text-muted">가계부·메모·계정·신원·ENV를 검색하세요.</div>
        ) : (
          Object.entries(groups).map(([type, items]) => (
            <div key={type}>
              <div className="px-3.5 pt-2.5 pb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted bg-surface border-b border-border-subtle">{TYPE_LABEL[type as SearchType]}</div>
              {items.slice(0, 3).map((item, i) => (
                <SearchResultRow key={i} item={item} query={query} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const ICON_BG: Record<SearchType, string> = {
  tx: 'bg-accent-dim', note: 'bg-elevated', cred: 'bg-blue-dim', id: 'bg-amber-dim', env: 'bg-accent-dim',
};

// 검색 결과 한 줄
function SearchResultRow({ item, query }: { item: SearchEntry; query: string }) {
  return (
    <a className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors border-b border-border-subtle last:border-b-0 hover:bg-surface no-underline" href={item.href}>
      <div className={`w-8 h-8 rounded-[var(--radius)] flex items-center justify-center text-[0.9rem] shrink-0 ${ICON_BG[item.type]}`}>{item.icon}</div>
      <div>
        <div className="text-[0.855rem] font-medium text-primary">{query ? highlight(item.title, query) : item.title}</div>
        <div className="text-[0.75rem] text-muted mt-px">{item.sub}</div>
      </div>
      <span className="ml-auto text-[0.68rem] px-[7px] py-px rounded-full bg-elevated text-muted shrink-0">{TYPE_LABEL[item.type]}</span>
    </a>
  );
}

// 검색바 좌측 돋보기 아이콘
function IconSearchInline() {
  return (
    <svg className="absolute left-2.5 w-[15px] h-[15px] text-muted pointer-events-none shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
