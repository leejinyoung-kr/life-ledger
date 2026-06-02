'use client';

/**
 * 공통 통합 검색바.
 * 가계부/계정/파일/메모를 한 입력창에서 검색하고 타입별로 그룹핑해 드롭다운으로 보여준다.
 * ⌘K / Ctrl+K 단축키로 포커스, Esc 로 닫기.
 */
import { useEffect, useRef, useState } from 'react';

type SearchType = 'tx' | 'cred' | 'file' | 'note';

interface SearchEntry {
  type: SearchType;
  icon: string;
  title: string;
  sub: string;
  href: string;
}

// 타입 코드 → 한글 라벨
const TYPE_LABEL: Record<SearchType, string> = { tx: '가계부', cred: '계정', file: '파일', note: '메모' };

// TODO: API 연동 — GET /api/v1/search?q= 결과로 대체. 현재는 더미 데이터.
const SEARCH_DATA: SearchEntry[] = [
  { type: 'tx',   icon: '💰', title: '월급 +₩3,200,000',        sub: '2025.05.25 · 가계부',   href: '#' },
  { type: 'tx',   icon: '☕', title: '스타벅스 -₩6,500',          sub: '2025.05.31 · 가계부',   href: '#' },
  { type: 'tx',   icon: '📺', title: '넷플릭스 -₩17,000',         sub: '2025.05.29 · 가계부',   href: '#' },
  { type: 'cred', icon: '🐙', title: 'GitHub',                  sub: 'myusername · 개발',     href: '#' },
  { type: 'cred', icon: '🏦', title: '카카오뱅크',                sub: '010-1234-5678 · 금융',  href: '#' },
  { type: 'cred', icon: '📦', title: '쿠팡',                     sub: 'user@email.com · 쇼핑', href: '#' },
  { type: 'file', icon: '📄', title: '보험증권_2025.pdf',         sub: '1.2MB · 파일 보관함',   href: '#' },
  { type: 'file', icon: '🖼️', title: '주민등록등본_250415.jpg',   sub: '845KB · 파일 보관함',   href: '#' },
  { type: 'note', icon: '📝', title: '월간 지출 분석 메모',        sub: '2025.05.31 · 메모',     href: '#' },
  { type: 'note', icon: '📝', title: '개발 환경 세팅 체크리스트',   sub: '2025.05.28 · 메모',     href: '#' },
];

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
      <mark key={i} className="search-mark">
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
  const inputRef = useRef<HTMLInputElement>(null);

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

  // 검색어로 더미 데이터 필터 (제목/부제목 부분일치)
  const results = query.trim()
    ? SEARCH_DATA.filter(
        (d) =>
          d.title.toLowerCase().includes(query.toLowerCase()) ||
          d.sub.toLowerCase().includes(query.toLowerCase()),
      )
    : SEARCH_DATA.slice(0, 4); // 빈 입력 시 최근 항목 4개

  // 결과를 타입별로 묶고 타입당 최대 3개로 제한
  const groups = results.reduce<Record<string, SearchEntry[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  const isEmpty = query.trim() !== '' && results.length === 0;

  return (
    <div className="global-search-wrap">
      <IconSearchInline />
      <input
        ref={inputRef}
        className="global-search-input"
        type="text"
        placeholder="통합 검색... (가계부, 계정, 파일, 메모)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        autoComplete="off"
      />
      <span className="global-search-shortcut">⌘K</span>

      <div className={`search-dropdown${open ? ' open' : ''}`}>
        {isEmpty ? (
          <div className="search-empty">검색 결과가 없습니다.</div>
        ) : !query.trim() ? (
          <>
            <div className="search-section-label">최근 항목</div>
            {results.map((item, i) => (
              <SearchResultRow key={i} item={item} query="" />
            ))}
          </>
        ) : (
          Object.entries(groups).map(([type, items]) => (
            <div key={type}>
              <div className="search-section-label">{TYPE_LABEL[type as SearchType]}</div>
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

// 검색 결과 한 줄
function SearchResultRow({ item, query }: { item: SearchEntry; query: string }) {
  return (
    <a className="search-result-item" href={item.href}>
      <div className={`search-result-icon ${item.type}`}>{item.icon}</div>
      <div>
        <div className="search-result-title">{query ? highlight(item.title, query) : item.title}</div>
        <div className="search-result-sub">{item.sub}</div>
      </div>
      <span className="search-result-badge">{TYPE_LABEL[item.type]}</span>
    </a>
  );
}

// 검색바 좌측 돋보기 아이콘
function IconSearchInline() {
  return (
    <svg className="global-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
