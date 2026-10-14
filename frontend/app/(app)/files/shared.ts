// 파일 보관함 화면이 함께 쓰는 타입 · 작은 함수

export interface FolderItem {
  id: number;
  name: string;
  parentId: number | null;
  fileCount: number;
  childFolderCount: number;
  createdAt: string;
}

export interface FileItem {
  id: number;
  name: string;
  size: number;
  mimeType: string;
  folderId: number | null;
  createdAt: string;
}

export interface BreadcrumbItem { id: number; name: string; }

export interface ListResponse {
  breadcrumb: BreadcrumbItem[];
  folders: FolderItem[];
  files: FileItem[];
  totalBytes: number;
}

// 전체 검색 결과 — 항목마다 위치(루트 → 들어 있는 폴더)가 붙는다
export interface SearchResponse {
  folders: (FolderItem & { path: BreadcrumbItem[] })[];
  files: (FileItem & { path: BreadcrumbItem[] })[];
  truncated: boolean;
}

// 위치(path)가 붙을 수 있는 목록 항목
export type ShownFolder = FolderItem & { path?: BreadcrumbItem[] };
export type ShownFile = FileItem & { path?: BreadcrumbItem[] };

// 바이트 → 읽기 쉬운 크기
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// 파일 이름의 확장자(대문자) — 없으면 빈 글자
export function fileExt(name: string) {
  return name.includes('.') ? (name.split('.').pop()?.toUpperCase() ?? '') : '';
}

export const isImage = (mime: string) => mime.startsWith('image/');
export const isPdf = (mime: string) => mime === 'application/pdf';
// 글자로 미리 볼 수 있는 파일 — 백엔드 file-text.util 의 isTextPreviewable 과 같은 규칙
export const isText = (mime: string, name: string) =>
  mime.startsWith('text/') || /^application\/(json|xml|x-yaml|yaml)$/.test(mime) || /\.(txt|md|csv|tsv|log|json|ya?ml|xml|ini|conf)$/i.test(name);

// 올린 날 표시
export function fmtFileDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR');
}
