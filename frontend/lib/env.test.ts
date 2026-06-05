import { describe, it, expect } from 'vitest';
import { groupVars, toEnvText, type EnvVar } from './env';

const v = (id: number, key: string, group: string | null): EnvVar => ({
  id, env: 'dev', group, key, valueMasked: '••', memo: null,
});

describe('groupVars', () => {
  it('그룹별로 묶되 등장 순서 유지', () => {
    const out = groupVars([v(1, 'A', 'DB'), v(2, 'B', 'Auth'), v(3, 'C', 'DB')]);
    expect(out.map((g) => g.group)).toEqual(['DB', 'Auth']);
    expect(out[0].items.map((i) => i.key)).toEqual(['A', 'C']);
  });

  it('그룹 없음(null) → 기타', () => {
    const out = groupVars([v(1, 'A', null)]);
    expect(out[0].group).toBe('기타');
  });
});

describe('toEnvText', () => {
  it('그룹 주석 포함 .env 직렬화', () => {
    const text = toEnvText('proj', 'dev', [
      { key: 'A', value: '1', group: 'DB' },
      { key: 'B', value: '2', group: 'DB' },
      { key: 'C', value: '3', group: null },
    ]);
    expect(text).toBe('# proj - dev\n\n# DB\nA=1\nB=2\nC=3\n');
  });

  it('빈 목록 → 헤더만', () => {
    expect(toEnvText('p', 'prod', [])).toBe('# p - prod\n');
  });
});
