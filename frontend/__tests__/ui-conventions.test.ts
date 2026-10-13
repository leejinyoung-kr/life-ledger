import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

// 공통 UI 규칙 소스 검사 — 새 화면이 공통 요소를 건너뛰고 날 것으로 만드는 것을 막는다 (규칙은 life-ledger/CLAUDE.md "프론트 공통 요소")
const ROOT = path.resolve(__dirname, '..');

// app · components 아래 tsx 파일 목록 (경로는 / 구분자로 통일)
function sources(dir: string, out: { rel: string; text: string }[] = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) sources(full, out);
    else if (e.name.endsWith('.tsx')) out.push({ rel: path.relative(ROOT, full).split(path.sep).join('/'), text: fs.readFileSync(full, 'utf8') });
  }
  return out;
}

const FILES = [...sources(path.join(ROOT, 'app')), ...sources(path.join(ROOT, 'components'))];

// 정규식에 걸리는 파일:줄 목록 (except 에 든 파일은 제외)
function offenders(re: RegExp, except: string[] = []) {
  const hits: string[] = [];
  for (const f of FILES) {
    if (except.includes(f.rel)) continue;
    f.text.split(/\r?\n/).forEach((line, i) => {
      if (re.test(line)) hits.push(`${f.rel}:${i + 1}`);
    });
  }
  return hits;
}

// 여는 태그 전체 문자열 (속성 안의 > 와 {} 를 건너뛴다)
function openTags(text: string, tag: string) {
  const tags: { tag: string; line: number }[] = [];
  const re = new RegExp(`<${tag}(?![A-Za-z])`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let depth = 0;
    let quote: string | null = null;
    let i = m.index;
    for (; i < text.length; i++) {
      const c = text[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth <= 0) break;
    }
    tags.push({ tag: text.slice(m.index, i + 1), line: text.slice(0, m.index).split('\n').length });
  }
  return tags;
}

describe('공통 UI 규칙', () => {
  it('페이지 제목 h1 은 PageHeader 안에만 있다', () => {
    expect(offenders(/text-\[1\.55rem\] font-bold tracking-\[-0\.03em\]/, ['components/PageHeader.tsx'])).toEqual([]);
    expect(offenders(/<h1\b/, ['components/PageHeader.tsx', 'app/login/page.tsx'])).toEqual([]);
  });

  it('is-invalid · 옛 아이콘 버튼 상수는 쓰지 않는다 (Field error · IconButton 사용)', () => {
    expect(offenders(/is-invalid|ICON_BTN|NAV_BTN_34|icon-btn/)).toEqual([]);
  });

  it('체크박스 input 은 .checkbox 클래스를 가진다', () => {
    const bad: string[] = [];
    for (const f of FILES) {
      for (const t of openTags(f.text, 'input')) {
        if (/type="checkbox"/.test(t.tag) && !/className="[^"]*\bcheckbox\b/.test(t.tag)) bad.push(`${f.rel}:${t.line}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('모서리 · 그림자는 rounded-ui · rounded-panel · shadow-card 같은 토큰 유틸로 쓴다', () => {
    expect(offenders(/rounded-(t-)?\[var\(--radius|rounded-\(--radius|shadow-\[var\(--shadow|shadow-\(--shadow/)).toEqual([]);
  });

  it('검색 입력은 SearchInput 으로 쓴다 (돋보기 아이콘을 직접 얹지 않는다)', () => {
    expect(offenders(/<IconSearch className="absolute/, ['components/ui/SearchInput.tsx'])).toEqual([]);
  });

  it('테이블 빈 행은 TableEmptyRow 로 쓴다', () => {
    expect(offenders(/<td colSpan=\{\d+\} className="td-center td-muted">/, ['components/TableEmptyRow.tsx'])).toEqual([]);
  });

  it('직접 적은 빨간색(#dc2626 등)을 쓰지 않는다', () => {
    expect(offenders(/#dc2626|#F04438|#d32f1e/i)).toEqual([]);
  });
});
