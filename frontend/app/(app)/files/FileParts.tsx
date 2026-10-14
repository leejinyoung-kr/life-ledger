'use client';

import Image from 'next/image';
import { useApiQuery } from '@/lib/query';
import Button from '@/components/ui/Button';
import MoreMenu, { type MoreMenuItem } from '@/components/ui/MoreMenu';
import { Card } from '@/components/ui/Card';
import {
  IconFolder, IconFileImage, IconFileArchive, IconDoc, IconFileBlank, IconInbox, IconTrash, IconDownload, IconChevronRight,
} from '@/components/icons';
import {
  fileExt, fmtFileDate, formatBytes, isImage,
  type BreadcrumbItem, type ShownFile, type ShownFolder,
} from './shared';

// 확장자 표식 · 아이콘을 고르는 종류
function FileGlyph({ mime, size }: { mime: string; size: number }) {
  if (isImage(mime)) return <IconFileImage width={size} height={size} />;
  if (/zip|compressed|rar|7z|tar/.test(mime)) return <IconFileArchive width={size} height={size} />;
  if (mime === 'application/pdf' || mime.startsWith('text/') || /word|sheet|excel|presentation|powerpoint/.test(mime)) return <IconDoc width={size} height={size} />;
  return <IconFileBlank width={size} height={size} />;
}

// 이미지 파일의 미리보기 주소 — 조회 때마다 만료되는 주소라 4분만 캐시한다
function useThumbUrl(file: ShownFile) {
  const q = useApiQuery<{ url: string }>(['file-thumb', file.id], `/files/${file.id}/url?disposition=inline`, {
    enabled: isImage(file.mimeType),
    staleTime: 4 * 60 * 1000,
    retry: false,
  });
  return q.data?.url ?? null;
}

// 폴더 경로 줄 "전체 / 보험 / 2026" — 칸을 누르면 그 폴더로 이동 (브레드크럼 · 검색 결과 위치 공용)
export function FolderTrail({ crumbs, onNavigate, size = 'md' }: { crumbs: BreadcrumbItem[]; onNavigate: (id?: number) => void; size?: 'md' | 'sm' }) {
  return (
    <div className={`flex items-center gap-1.5 text-muted flex-wrap min-w-0 ${size === 'sm' ? 'text-[0.7rem]' : 'text-[0.875rem]'}`}>
      <IconFolder width={size === 'sm' ? 12 : 16} height={size === 'sm' ? 12 : 16} className="text-accent shrink-0" />
      <Button variant="link" size="inline" onClick={() => onNavigate(undefined)}>전체</Button>
      {crumbs.map((crumb) => (
        <span key={crumb.id} className="flex items-center gap-1.5 min-w-0">
          <IconChevronRight width={13} height={13} className="shrink-0" />
          <Button variant="link" size="inline" onClick={() => onNavigate(crumb.id)}>{crumb.name}</Button>
        </span>
      ))}
    </div>
  );
}

// 파일이 없을 때 쓰는 점선 안내 상자 — 아이콘 · 제목 · 설명
export function FileEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="bg-background border border-border rounded-panel shadow-card px-5 py-9 flex flex-col items-center gap-2 text-center">
      <IconInbox width={28} height={28} className="text-muted" />
      <span className="text-[1.125rem] font-bold text-primary">{title}</span>
      {hint && <span className="text-[0.8125rem] text-muted">{hint}</span>}
    </div>
  );
}

// 폴더 타일 — 누르면 들어간다. 전체 검색 결과면 위치(path)를 함께 보여 준다. 관리는 더보기 하나
export function FolderCard({ folder, onOpen, onDelete, onNavigate }: {
  folder: ShownFolder;
  onOpen: () => void;
  onDelete: () => void;
  onNavigate: (id?: number) => void;
}) {
  return (
    <Card hover="tile" onClick={onOpen} aria-label={`폴더 ${folder.name} 열기`} className="flex items-center gap-2 pl-3 pr-1 py-2.5">
      <IconFolder width={20} height={20} className="text-accent shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col leading-[1.35]">
        <span className="text-[0.8125rem] text-primary truncate">{folder.name}</span>
        <span className="text-[0.72rem] text-muted">
          파일 {folder.fileCount}개{folder.childFolderCount > 0 ? ` · 폴더 ${folder.childFolderCount}개` : ''}
        </span>
        {folder.path && (
          <div onClick={(e) => e.stopPropagation()}>
            <FolderTrail crumbs={folder.path} onNavigate={onNavigate} size="sm" />
          </div>
        )}
      </div>
      <MoreMenu items={[{ label: '삭제', icon: <IconTrash />, danger: true, onSelect: onDelete }]} />
    </Card>
  );
}

// 파일 카드(격자) — 이미지는 썸네일, 그 밖은 아이콘 + 확장자 표식. 누르면 보기 창, 관리는 더보기 하나
export function FileCard({ file, onView, onDownload, onDelete, onNavigate }: {
  file: ShownFile;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onNavigate: (id?: number) => void;
}) {
  const thumb = useThumbUrl(file);
  const items: MoreMenuItem[] = [
    { label: '다운로드', icon: <IconDownload />, onSelect: onDownload },
    { label: '삭제', icon: <IconTrash />, danger: true, onSelect: onDelete },
  ];
  return (
    <Card clip onClick={onView} aria-label={`${file.name} 보기`} className="flex flex-col min-w-0">
      <div className="h-25 grid place-items-center border-b border-border-subtle relative">
        {thumb ? (
          <div className="absolute inset-1.25">
            {/* 만료되는 presigned URL 이라 next/image 최적화 프록시 대신 unoptimized 로 직접 로드 */}
            <Image src={thumb} alt={file.name} fill unoptimized className="object-cover" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted">
            <FileGlyph mime={file.mimeType} size={28} />
            {fileExt(file.name) && <span className="text-[0.6875rem] tracking-[0.08em] px-1.5 py-px border border-border rounded-[2px]">{fileExt(file.name)}</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 pl-2.5 pr-1 py-2">
        <div className="flex-1 min-w-0 flex flex-col leading-[1.35]">
          <span className="text-[0.8125rem] text-primary truncate">{file.name}</span>
          <span className="text-[0.72rem] text-muted">{formatBytes(file.size)} · {fmtFileDate(file.createdAt)}</span>
          {file.path && (
            <div onClick={(e) => e.stopPropagation()}>
              <FolderTrail crumbs={file.path} onNavigate={onNavigate} size="sm" />
            </div>
          )}
        </div>
        <MoreMenu items={items} />
      </div>
    </Card>
  );
}

// 파일 목록(표) — 행을 누르면 보기 창, 관리 열은 더보기 하나, 크기는 오른쪽. 휴대폰은 이름 아래에 종류 · 크기 · 날짜
export function FileList({ folders, files, onOpenFolder, onView, onDownload, onDeleteFile, onDeleteFolder, onNavigate }: {
  folders: ShownFolder[];
  files: ShownFile[];
  onOpenFolder: (id: number) => void;
  onView: (f: ShownFile) => void;
  onDownload: (f: ShownFile) => void;
  onDeleteFile: (f: ShownFile) => void;
  onDeleteFolder: (f: ShownFolder) => void;
  onNavigate: (id?: number) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="th-left w-10"><span className="sr-only">종류 아이콘</span></th>
            <th className="th-left">이름</th>
            <th className="th-left max-md:hidden">종류</th>
            <th className="th-right max-md:hidden">크기</th>
            <th className="th-left max-md:hidden">올린 날</th>
            <th className="th-right"><span className="sr-only">관리</span></th>
          </tr>
        </thead>
        <tbody>
          {folders.map((f) => (
            <tr key={`d${f.id}`} className="cursor-pointer" onClick={() => onOpenFolder(f.id)}>
              <td><span className="w-8 h-8 grid place-items-center border border-border rounded-ui text-accent"><IconFolder width={16} height={16} /></span></td>
              <td>
                <div className="flex flex-col leading-[1.35] min-w-0">
                  <span className="truncate">{f.name}</span>
                  <span className="text-[0.75rem] text-muted md:hidden">폴더 · 파일 {f.fileCount}개</span>
                  {f.path && <div onClick={(e) => e.stopPropagation()}><FolderTrail crumbs={f.path} onNavigate={onNavigate} size="sm" /></div>}
                </div>
              </td>
              <td className="text-muted max-md:hidden">폴더</td>
              <td className="td-right td-mono text-muted max-md:hidden">파일 {f.fileCount}개</td>
              <td className="td-mono text-muted max-md:hidden">{fmtFileDate(f.createdAt)}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end"><MoreMenu items={[{ label: '삭제', icon: <IconTrash />, danger: true, onSelect: () => onDeleteFolder(f) }]} /></div>
              </td>
            </tr>
          ))}
          {files.map((f) => (
            <FileRow key={`f${f.id}`} file={f} onView={() => onView(f)} onDownload={() => onDownload(f)} onDelete={() => onDeleteFile(f)} onNavigate={onNavigate} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 파일 목록의 한 행 — 이미지는 작은 썸네일, 그 밖은 아이콘 칸
function FileRow({ file, onView, onDownload, onDelete, onNavigate }: {
  file: ShownFile;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onNavigate: (id?: number) => void;
}) {
  const thumb = useThumbUrl(file);
  const ext = fileExt(file.name);
  return (
    <tr className="cursor-pointer" onClick={onView}>
      <td>
        {thumb ? (
          <span className="relative block w-8 h-8 overflow-hidden rounded-ui border border-border">
            <Image src={thumb} alt="" fill unoptimized className="object-cover" />
          </span>
        ) : (
          <span className="w-8 h-8 grid place-items-center border border-border rounded-ui text-muted"><FileGlyph mime={file.mimeType} size={16} /></span>
        )}
      </td>
      <td>
        <div className="flex flex-col leading-[1.35] min-w-0">
          <span className="truncate">{file.name}</span>
          <span className="text-[0.75rem] text-muted md:hidden">{ext && `${ext} · `}{formatBytes(file.size)} · {fmtFileDate(file.createdAt)}</span>
          {file.path && <div onClick={(e) => e.stopPropagation()}><FolderTrail crumbs={file.path} onNavigate={onNavigate} size="sm" /></div>}
        </div>
      </td>
      <td className="text-[0.75rem] text-muted tracking-[0.06em] max-md:hidden">{ext}</td>
      <td className="td-right td-mono text-muted max-md:hidden">{formatBytes(file.size)}</td>
      <td className="td-mono text-muted max-md:hidden">{fmtFileDate(file.createdAt)}</td>
      <td onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end">
          <MoreMenu items={[
            { label: '다운로드', icon: <IconDownload />, onSelect: onDownload },
            { label: '삭제', icon: <IconTrash />, danger: true, onSelect: onDelete },
          ]} />
        </div>
      </td>
    </tr>
  );
}
