'use client';

/**
 * 공통 통합 검색.
 * 데스크톱은 "가계부 · 계정 검색" 상자, 휴대폰은 돋보기 버튼을 두고, 누르거나 ⌘K(Ctrl+K) 시 중앙 팔레트를 띄운다.
 * 가계부/계정을 한 입력창에서 검색하고 타입별로 그룹핑해 보여준다. Esc 로 닫기.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApiQuery } from '@/lib/query';
import { IconClock, IconKey, IconSearch, IconWon } from './icons';

type SearchType = 'tx' | 'cred';

interface SearchEntry {
  type: SearchType;
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
      <mark key={i} className="bg-accent-dim text-accent-dark rounded-[2px]">
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
      {/* 데스크톱 트리거 — 검색 상자 모양 (⌘K 힌트 포함) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex max-md:hidden items-center gap-2.5 w-[340px] max-w-[50%] h-9 px-2.5 border border-border rounded-ui text-muted text-[0.84rem] text-left transition-colors hover:border-muted"
        aria-label="통합 검색 열기"
      >
        <IconSearchBtn />
        <span className="flex-1">가계부 · 계정 검색</span>
        <span className="text-[0.6875rem] border border-border rounded-[2px] px-1.5">{isMac ? '⌘K' : 'Ctrl K'}</span>
      </button>
      {/* 휴대폰 트리거 — 44px 돋보기 버튼 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden max-md:flex w-11 h-11 items-center justify-center rounded-ui text-muted shrink-0 hover:bg-hover [&_svg]:w-5 [&_svg]:h-5"
        aria-label="통합 검색 열기"
      >
        <IconSearchBtn />
      </button>

      {/* 검색 팔레트 모달 — 상단바 안에서 그리면 그 쌓임 순서에 갇혀 사이드바를 못 덮으므로 body 에 그린다 */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[300] bg-backdrop flex items-start justify-center pt-[12vh] px-4 animate-[fadeIn_0.2s_ease]"
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
                placeholder="가계부 · 계정 검색"
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
                    className={`px-2.5 py-1 rounded-full text-[0.72rem] font-medium whitespace-nowrap transition-colors ${filter === f.key ? 'border border-accent bg-accent-dim text-accent-dark' : 'border border-border text-muted hover:text-primary'}`}
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
                        className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left border-b border-border-subtle last:border-b-0 hover:bg-hover"
                      >
                        <IconClock width={15} height={15} className="text-muted shrink-0" />
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
        </div>,
        document.body,
      )}
    </>
  );
}

// 결과 종류 → 아이콘 (서버가 주는 이모지 대신)
const TYPE_ICON: Record<SearchType, React.ReactNode> = {
  tx: <IconWon width={16} height={16} />,
  cred: <IconKey width={16} height={16} />,
};

// 검색 결과 한 줄
function SearchResultRow({ item, query, onPick }: { item: SearchEntry; query: string; onPick?: () => void }) {
  return (
    <a className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors border-b border-border-subtle last:border-b-0 hover:bg-hover no-underline" href={item.href} onClick={onPick}>
      <div className="w-8 h-8 rounded-ui border border-border flex items-center justify-center text-muted shrink-0">{TYPE_ICON[item.type]}</div>
      <div>
        <div className="text-[0.855rem] text-primary">{query ? highlight(item.title, query) : item.title}</div>
        <div className="text-[0.75rem] text-muted mt-px">{item.sub}</div>
      </div>
      <span className="ml-auto text-[0.72rem] text-muted shrink-0">{TYPE_LABEL[item.type]}</span>
    </a>
  );
}

// 팔레트 입력창 좌측 돋보기 아이콘 (absolute)
function IconSearchInline() {
  return <IconSearch className="absolute left-3 w-4 h-4 text-muted pointer-events-none shrink-0" />;
}

// 트리거 버튼용 돋보기 아이콘
function IconSearchBtn() {
  return <IconSearch className="w-[18px] h-[18px] shrink-0" />;
}
