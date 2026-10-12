/**
 * 파일 보관함 업로드 준비 — 폴더 선택(webkitdirectory) · 드래그한 폴더를 "파일 + 상대 폴더 경로" 목록으로 바꾼다.
 * 서버는 업로드마다 path(상대 폴더 경로)를 받아 그 폴더를 찾거나 만들어 넣는다.
 */

// 올릴 파일 하나 — dir 은 현재 폴더 기준 상대 경로("보험/2026"), 그냥 고른 파일이면 ''
export interface UploadItem {
  file: File;
  dir: string;
}

// 서버 업로드 상한 (core-storage 와 같은 값)
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// OS 가 만드는 숨김·임시 파일 — 폴더째 올릴 때 굳이 보관할 필요가 없다
export function isSystemFile(name: string): boolean {
  return /^(\.DS_Store|Thumbs\.db|desktop\.ini|\._.*|~\$.*)$/i.test(name);
}

// webkitRelativePath("보험/2026/a.pdf") → 들어 있는 폴더 경로("보험/2026")
export function relDirOf(relativePath: string): string {
  const i = relativePath.lastIndexOf('/');
  return i < 0 ? '' : relativePath.slice(0, i);
}

// <input type="file" webkitdirectory> 로 고른 파일 목록 → 업로드 목록
export function fromFileList(list: FileList | File[]): UploadItem[] {
  return Array.from(list).map((file) => ({ file, dir: relDirOf(file.webkitRelativePath ?? '') }));
}

// 업로드 전에 거를 것 — 시스템 파일은 조용히 빼고, 50MB 넘는 파일은 따로 돌려준다
export function splitUploadable(items: UploadItem[]): { ok: UploadItem[]; tooBig: UploadItem[] } {
  const ok: UploadItem[] = [];
  const tooBig: UploadItem[] = [];
  for (const it of items) {
    if (isSystemFile(it.file.name)) continue;
    (it.file.size > MAX_UPLOAD_BYTES ? tooBig : ok).push(it);
  }
  return { ok, tooBig };
}

// 업로드 목록에 들어 있는 폴더 수 (중간 폴더 포함 — "a/b" 는 a, a/b 두 개)
export function countFolders(items: UploadItem[]): number {
  const dirs = new Set<string>();
  for (const { dir } of items) {
    const parts = dir.split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  return dirs.size;
}

// 드롭한 항목(파일·폴더) → 업로드 목록. 항목(entry)은 drop 이벤트 안에서 바로 꺼내 두어야 해서(이벤트가 끝나면 비워진다)
// 호출하는 쪽이 dataTransfer.items 에서 webkitGetAsEntry() 로 먼저 꺼내 넘긴다
export async function fromDroppedEntries(entries: FileSystemEntry[]): Promise<UploadItem[]> {
  const out: UploadItem[] = [];
  async function walk(entry: FileSystemEntry, dir: string) {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      out.push({ file, dir });
      return;
    }
    if (!entry.isDirectory) return;
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const sub = dir ? `${dir}/${entry.name}` : entry.name;
    // readEntries 는 한 번에 일부(크롬 100개)만 주므로 빈 배열이 올 때까지 반복한다
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (batch.length === 0) break;
      for (const e of batch) await walk(e, sub);
    }
  }
  for (const e of entries) await walk(e, '');
  return out;
}
