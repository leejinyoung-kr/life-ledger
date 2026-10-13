// 파일 보관함 경로 계산 (순수 함수) — 전체 검색의 위치 표시와 ZIP 안 경로 만들기에 쓴다

export interface FolderNode {
  id: number;
  name: string;
  parent_id: number | null;
}

export interface Crumb {
  id: number;
  name: string;
}

// 루트 → 해당 폴더까지의 경로 (폴더 자신 포함). 끊긴 부모·순환이 있으면 거기서 멈춘다
export function folderPath(byId: Map<number, FolderNode>, folderId: number | null): Crumb[] {
  const path: Crumb[] = [];
  const seen = new Set<number>();
  let cur = folderId;
  while (cur !== null && !seen.has(cur)) {
    seen.add(cur);
    const f = byId.get(cur);
    if (!f) break;
    path.unshift({ id: f.id, name: f.name });
    cur = f.parent_id;
  }
  return path;
}

// 폴더와 그 아래 모든 하위 폴더 id
export function subtreeIds(folders: FolderNode[], rootId: number): Set<number> {
  const children = new Map<number, number[]>();
  for (const f of folders) {
    if (f.parent_id === null) continue;
    const list = children.get(f.parent_id) ?? [];
    list.push(f.id);
    children.set(f.parent_id, list);
  }
  const ids = new Set<number>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    for (const c of children.get(queue.shift()!) ?? []) {
      if (ids.has(c)) continue;
      ids.add(c);
      queue.push(c);
    }
  }
  return ids;
}

// ZIP 안 경로 한 칸으로 쓸 수 있게 — 구분자·Windows 금지 문자는 _ 로, 끝의 점·공백은 뗀다
export function safeSegment(name: string): string {
  // eslint-disable-next-line no-control-regex -- 제어 문자도 파일명에 못 쓴다
  const cleaned = name.normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/, '').trim();
  return cleaned || '_';
}

// 같은 경로가 이미 있으면 "이름 (2).확장자" 처럼 번호를 붙인다 (대소문자 무시 — Windows 에서 풀 때 겹치지 않게)
export function uniquePath(used: Set<string>, path: string): string {
  const slash = path.lastIndexOf('/');
  const dir = path.slice(0, slash + 1);
  const file = path.slice(slash + 1);
  const dot = file.lastIndexOf('.');
  const base = dot > 0 ? file.slice(0, dot) : file;
  const ext = dot > 0 ? file.slice(dot) : '';
  let candidate = path;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${dir}${base} (${n})${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

// 파일마다 ZIP 안 경로 — rootId(받는 폴더) 아래 상대 경로, rootId 가 null 이면 보관함 전체 기준
export function zipPaths(
  byId: Map<number, FolderNode>,
  rootId: number | null,
  files: { id: number; name: string; folder_id: number | null }[],
): Map<number, string> {
  const used = new Set<string>();
  const out = new Map<number, string>();
  for (const f of files) {
    const crumbs = folderPath(byId, f.folder_id);
    const start = rootId === null ? 0 : crumbs.findIndex((c) => c.id === rootId) + 1;
    const dirs = crumbs.slice(start).map((c) => safeSegment(c.name));
    out.set(f.id, uniquePath(used, [...dirs, safeSegment(f.name)].join('/')));
  }
  return out;
}
