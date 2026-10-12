import { folderPath, safeSegment, subtreeIds, uniquePath, zipPaths, type FolderNode } from './file-path.util';

// 루트: 보험(1) ─ 2026(2) ─ 영수증(3), 사진(4)
const FOLDERS: FolderNode[] = [
  { id: 1, name: '보험', parent_id: null },
  { id: 2, name: '2026', parent_id: 1 },
  { id: 3, name: '영수증', parent_id: 2 },
  { id: 4, name: '사진', parent_id: null },
];
const byId = new Map(FOLDERS.map((f) => [f.id, f]));

describe('file-path.util', () => {
  it('folderPath 는 루트부터 그 폴더까지 이어 준다', () => {
    expect(folderPath(byId, 3).map((c) => c.name)).toEqual(['보험', '2026', '영수증']);
    expect(folderPath(byId, null)).toEqual([]);
  });

  it('folderPath 는 순환이 있어도 멈춘다', () => {
    const loop = new Map<number, FolderNode>([[1, { id: 1, name: 'a', parent_id: 2 }], [2, { id: 2, name: 'b', parent_id: 1 }]]);
    expect(folderPath(loop, 1).map((c) => c.name)).toEqual(['b', 'a']);
  });

  it('subtreeIds 는 자기 자신과 모든 하위 폴더를 모은다', () => {
    expect([...subtreeIds(FOLDERS, 1)].sort()).toEqual([1, 2, 3]);
    expect([...subtreeIds(FOLDERS, 4)]).toEqual([4]);
  });

  it('safeSegment 는 구분자·금지 문자를 바꾸고 끝의 점을 뗀다', () => {
    expect(safeSegment('a/b\\c:d*?.pdf')).toBe('a_b_c_d__.pdf');
    expect(safeSegment('메모. ')).toBe('메모');
    expect(safeSegment('...')).toBe('_');
  });

  it('uniquePath 는 겹치면 확장자 앞에 번호를 붙인다 (대소문자 무시)', () => {
    const used = new Set<string>();
    expect(uniquePath(used, '보험/a.pdf')).toBe('보험/a.pdf');
    expect(uniquePath(used, '보험/A.pdf')).toBe('보험/A (2).pdf');
    expect(uniquePath(used, '보험/a.pdf')).toBe('보험/a (3).pdf');
    expect(uniquePath(used, 'README')).toBe('README');
    expect(uniquePath(used, 'README')).toBe('README (2)');
  });

  it('zipPaths 는 받는 폴더 기준 상대 경로를 만든다', () => {
    const files = [
      { id: 10, name: 'a.pdf', folder_id: 1 },
      { id: 11, name: 'b.jpg', folder_id: 3 },
      { id: 12, name: 'b.jpg', folder_id: 3 },
      { id: 13, name: 'root.txt', folder_id: null },
    ];
    expect([...zipPaths(byId, null, files).values()]).toEqual(['보험/a.pdf', '보험/2026/영수증/b.jpg', '보험/2026/영수증/b (2).jpg', 'root.txt']);
    expect([...zipPaths(byId, 2, files.slice(1, 2)).values()]).toEqual(['영수증/b.jpg']);
  });
});
