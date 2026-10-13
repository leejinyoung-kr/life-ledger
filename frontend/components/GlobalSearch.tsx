'use client';

/**
 * 공통 통합 검색.
 * 헤더엔 돋보기 아이콘 트리거만 두고, 클릭/⌘K(Ctrl+K) 시 중앙 모달 팔레트를 띄운다.
 * 가계부/계정/파일을 한 입력창에서 검색하고 타입별로 그룹핑해 보여준다. Esc 로 닫기.
 */
import { useEffect, useRef, useState } from 'react';
import { useApiQuery } from '@/lib/query';

type SearchType = 'tx' | 'cred';

interface SearchEntry {
  type: SearchType;
  icon: string;
  title: string;
  sub: string;
  href: string;
}

// 타입 코드 → 한글 라벨
const TYPE_LABEL: Record<SearchType, string> = { tx: '가계부', cred: '계정' };

// 도메인 필터 칩 (전체 + 타입별)
const FILTERS: { key: SearchType | 'all'; label: string }[] = [
  { key: 'all', label: '전체' }, { key: 'tx', label: '가계부' },
  { key: 'cred', label: '계정' },
];

// 최근 검색어 (localStorage, 최대 6개)
const RECENT_KEY = 'll_recent_search';
function loadRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[]; } catch { return []; }
}
function saveRecent(q: string): string[] {
  const t = q.trim();
  if (!t) return loadRecent();
  const list = [t, ...loadRecent().filter((x) => x !== t)].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  return list;
}

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

function useIsMac() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 클라이언트 마운트 시점에 플랫폼 감지 (SSR 시 navigator 없음)
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
  }, []);
  return isMac;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<SearchType | 'all'>('all');
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMac = useIsMac();

  // 최근 검색어 초기 로드
  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage는 클라이언트 마운트 후에만 접근 가능
  useEffect(() => { setRecent(loadRecent()); }, []);

  // 검색어 확정 시 최근 검색어에 기록 (Enter·결과 클릭)
  const commitRecent = () => setRecent(saveRecent(query));

  // 입력 디바운스 (200ms) → 디바운스된 검색어로 쿼리 키 구성
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  // 통합 검색 — 디바운스된 검색어가 있을 때만 조회(React Query 캐시)
  const results = useApiQuery<SearchEntry[]>(
    ['search', debounced],
    `/search?q=${encodeURIComponent(debounced)}`,
    { enabled: debounced.length > 0 },
  ).data ?? [];

  // ⌘K/Ctrl+K → 팔레트 토글, Esc → 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // 팔레트 열릴 때 입력창 포커스
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // 도메인 필터 적용 후 타입별 그룹화
  const filtered = filter === 'all' ? results : results.filter((r) => r.type === filter);
  const groups = filtered.reduce<Record<string, SearchEntry[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  const isEmpty = query.trim() !== '' && filtered.length === 0;

  return (
    <>
      {/* 헤더 트리거 — 돋보기 아이콘 버튼 (⌘K 힌트 포함) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-9 px-2.5 rounded-ui text-secondary transition-colors shrink-0 hover:bg-surface hover:text-primary"
        aria-label="통합 검색 열기"
      >
        <IconSearchBtn />
        <span className="text-[0.68rem] text-muted bg-elevated border border-border rounded-[4px] px-[5px] py-px [font-family:var(--font-mono)] max-[900px]:hidden">
          {isMac ? '⌘K' : 'Ctrl K'}
        </span>
      </button>

      {/* 검색 팔레트 모달 */}
      {open && (
        <div
          className="fixed inset-0 z-[300] bg-[rgba(15,25,35,0.45)] backdrop-blur-[4px] flex items-start justify-center pt-[12vh] px-4 animate-[fadeIn_0.2s_ease]"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[560px] bg-background border border-border rounded-panel shadow-overlay overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* 입력 */}
            <div className="relative flex items-center border-b border-border-subtle">
              <IconSearchInline />
              <input
                ref={inputRef}
                className="w-full h-12 bg-transparent pl-9 pr-3 text-[0.9rem] text-primary outline-none placeholder:text-muted"
                type="text"
                placeholder="가계부·계정 통합 검색..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitRecent(); } }}
                autoComplete="off"
              />
            </div>

            {/* 도메인 필터 칩 (검색어 있을 때만) */}
            {query.trim() && (
              <div className="flex gap-1.5 px-3 py-2 border-b border-border-subtle bg-surface overflow-x-auto">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`px-2.5 py-1 rounded-full text-[0.72rem] font-medium whitespace-nowrap transition-colors ${filter === f.key ? 'bg-accent text-white' : 'bg-elevated text-secondary hover:text-primary'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            <div className="max-h-[60vh] overflow-y-auto">
              {isEmpty ? (
                <div className="p-6 text-center text-[0.855rem] text-muted">검색 결과가 없습니다.</div>
              ) : !query.trim() ? (
                recent.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5 bg-surface border-b border-border-subtle">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted">최근 검색</span>
                      <button type="button" onClick={() => { localStorage.removeItem(RECENT_KEY); setRecent([]); }} className="text-[0.68rem] text-muted hover:text-danger">지우기</button>
                    </div>
                    {recent.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => { setQuery(q); inputRef.current?.focus(); }}
                        className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left border-b border-border-subtle last:border-b-0 hover:bg-surface"
                      >
                        <span className="text-muted text-[0.85rem]">🕘</span>
                        <span className="text-[0.84rem] text-secondary">{q}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-[0.855rem] text-muted">가계부·계정을 검색하세요.</div>
                )
              ) : (
                Object.entries(groups).map(([type, items]) => (
                  <div key={type}>
                    <div className="px-3.5 pt-2.5 pb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted bg-surface border-b border-border-subtle">{TYPE_LABEL[type as SearchType]}</div>
                    {items.slice(0, 3).map((item, i) => (
                      <SearchResultRow key={i} item={item} query={query} onPick={() => { commitRecent(); setOpen(false); }} />
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const ICON_BG: Record<SearchType, string> = {
  tx: 'bg-accent-dim', cred: 'bg-blue-dim',
};

// 검색 결과 한 줄
function SearchResultRow({ item, query, onPick }: { item: SearchEntry; query: string; onPick?: () => void }) {
  return (
    <a className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors border-b border-border-subtle last:border-b-0 hover:bg-surface no-underline" href={item.href} onClick={onPick}>
      <div className={`w-8 h-8 rounded-ui flex items-center justify-center text-[0.9rem] shrink-0 ${ICON_BG[item.type]}`}>{item.icon}</div>
      <div>
        <div className="text-[0.855rem] font-medium text-primary">{query ? highlight(item.title, query) : item.title}</div>
        <div className="text-[0.75rem] text-muted mt-px">{item.sub}</div>
      </div>
      <span className="ml-auto text-[0.68rem] px-[7px] py-px rounded-full bg-elevated text-muted shrink-0">{TYPE_LABEL[item.type]}</span>
    </a>
  );
}

// 팔레트 입력창 좌측 돋보기 아이콘 (absolute)
function IconSearchInline() {
  return (
    <svg className="absolute left-3 w-[16px] h-[16px] text-muted pointer-events-none shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

// 헤더 트리거 버튼용 돋보기 아이콘 (inline)
function IconSearchBtn() {
  return (
    <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
