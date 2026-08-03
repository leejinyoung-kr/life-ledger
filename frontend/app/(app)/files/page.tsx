'use client';

/**
 * 파일 보관함 페이지.
 * 중첩 폴더 탐색(브레드크럼), 업로드, 다운로드, 삭제를 B2 백엔드 API와 연동한다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { notify } from '@/lib/toast';
import { api, apiUploadProgress } from '@/lib/api';
import { useApiQuery, useInvalidate } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import { clickable } from '@/lib/a11y';
import AppShell from '@/components/AppShell';
import QueryState from '@/components/QueryState';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/ConfirmModal';
import Button, { buttonClasses } from '@/components/ui/Button';
import { Field, ModalFooter } from '@/components/ui/Field';
import { NAV_BTN_34 } from '@/components/ui/styles';
import {
  IconFolderPlus, IconUpload, IconFolder, IconTrash,
  IconDoc, IconImage, IconClose, IconSearch,
} from '@/components/icons';

// ── 타입 ────────────────────────────────────────────────────────────────────

interface FolderItem {
  id: number;
  name: string;
  parentId: number | null;
  fileCount: number;
  childFolderCount: number;
  createdAt: string;
}

interface FileItem {
  id: number;
  name: string;
  size: number;
  mimeType: string;
  folderId: number | null;
  createdAt: string;
}

interface BreadcrumbItem { id: number; name: string; }

interface ListResponse {
  breadcrumb: BreadcrumbItem[];
  folders: FolderItem[];
  files: FileItem[];
  totalBytes: number;
}

// ── 유틸 ────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function fileEmoji(mime: string) {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime === 'application/pdf') return '📄';
  return '📎';
}

function fileExt(name: string) {
  return name.split('.').pop()?.toUpperCase() ?? '';
}

const FREE_BYTES = 10 * 1024 ** 3; // 10GB

const SECTION = '[font-family:var(--font-display)] text-[0.9rem] font-bold text-primary mb-3 flex items-center gap-2';
const FILE_BTN = 'flex-1 flex items-center justify-center gap-[3px] py-1.5 text-[0.72rem] text-muted transition-all border-r border-border-subtle last:border-r-0 hover:bg-surface hover:text-primary [&_svg]:w-[11px] [&_svg]:h-[11px]';

// ── 페이지 ───────────────────────────────────────────────────────────────────

export default function FilesPage() {
  const [currentFolderId, setCurrentFolderId] = useState<number | undefined>(undefined);
  const [dragOver, setDragOver] = useState(false);
  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ name: string; percent: number }[]>([]);
  const [viewer, setViewer] = useState<FileItem | null>(null);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();

  // 현재 폴더 목록 (React Query — folderId 별 캐시)
  const listQs = useMemo(() => {
    const params = new URLSearchParams();
    if (currentFolderId !== undefined) params.set('folderId', String(currentFolderId));
    return params.toString();
  }, [currentFolderId]);
  const dataQuery = useApiQuery<ListResponse>(qk.files.list(currentFolderId), `/files${listQs ? `?${listQs}` : ''}`);
  const data = dataQuery.data ?? { breadcrumb: [], folders: [], files: [], totalBytes: 0 };
  // 변이 후 파일 트리 무효화
  const reload = () => invalidate(qk.files.all);

  // 폴더 클릭 — 해당 폴더로 진입
  function handleEnterFolder(id: number) {
    setCurrentFolderId(id);
    setSearch('');
  }

  // 브레드크럼 클릭 — 루트 또는 상위 폴더로 이동
  function handleNavigateTo(id?: number) {
    setCurrentFolderId(id);
    setSearch('');
  }

  // 파일 업로드
  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploading(true);
    setUploadQueue(files.map((f) => ({ name: f.name, percent: 0 })));
    try {
      const uploadParams = new URLSearchParams();
      if (currentFolderId !== undefined) uploadParams.set('folderId', String(currentFolderId));
      const uploadQs = uploadParams.toString();
      for (let i = 0; i < files.length; i++) {
        const idx = i;
        await apiUploadProgress(`/files/upload${uploadQs ? `?${uploadQs}` : ''}`, files[idx], (percent) => {
          setUploadQueue((q) => q.map((item, j) => (j === idx ? { ...item, percent } : item)));
        });
      }
      notify.success('업로드 완료');
      reload();
    } catch {
      notify.error('업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      setUploadQueue([]);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  // 폴더 생성
  async function handleCreateFolder() {
    if (!folderName.trim()) return;
    setSaving(true);
    try {
      await api.post('/files/folders', { name: folderName.trim(), parentId: currentFolderId ?? null });
      notify.success('폴더가 생성되었습니다.');
      setFolderModal(false);
      setFolderName('');
      reload();
    } catch {
      notify.error('폴더 생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  // 파일 다운로드
  async function handleDownloadFile(file: FileItem) {
    try {
      const { url } = await api.get<{ url: string }>(`/files/${file.id}/url`);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
    } catch {
      notify.error('다운로드 URL 발급에 실패했습니다.');
    }
  }

  // 파일 삭제
  async function handleDeleteFile(file: FileItem) {
    if (!await confirm(`"${file.name}" 파일을 삭제할까요?`, 'danger')) return;
    try {
      await api.del(`/files/${file.id}`);
      notify.success('삭제되었습니다.');
      reload();
    } catch {
      notify.error('삭제에 실패했습니다.');
    }
  }

  // 폴더 삭제
  async function handleDeleteFolder(folder: FolderItem) {
    if (!await confirm(`"${folder.name}" 폴더를 삭제할까요?`, 'danger')) return;
    try {
      await api.del(`/files/folders/${folder.id}`);
      notify.success('폴더가 삭제되었습니다.');
      reload();
    } catch {
      notify.error('폴더 삭제에 실패했습니다.');
    }
  }

  const usagePct = Math.min((data.totalBytes / FREE_BYTES) * 100, 100);

  const filteredFolders = data.folders.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredFiles = data.files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell activePath="/files" topbarLabel="파일 보관함">
      <div className="mb-7">
        <div className="flex items-center justify-between gap-4">
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">파일 보관함</h1>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" onClick={() => setFolderModal(true)}>폴더 생성</Button>
            <label className={buttonClasses('primary') + (uploading ? ' opacity-60 pointer-events-none' : '')}>
              {uploading ? '업로드 중…' : '파일 업로드'}
              <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
            </label>
          </div>
        </div>
        <p className="text-sm text-secondary mt-1.5 break-keep">폴더를 생성하여 파일을 정리하거나, 바로 업로드할 수 있습니다.</p>
      </div>

      {/* 스토리지 사용량 */}
      <div className="mb-5">
        <div className="flex justify-between text-[0.8rem] mb-1.5 text-secondary [&_strong]:text-accent">
          <span>{formatBytes(data.totalBytes)} 사용 중</span>
          <span>10 GB 중 <strong>{usagePct.toFixed(1)}%</strong></span>
        </div>
        <div className="h-1.5 bg-elevated rounded-[3px] overflow-hidden">
          <div className="h-full rounded-[3px] bg-accent transition-all" style={{ width: `${usagePct}%` }} />
        </div>
      </div>

      {/* 업로드 드롭존 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="파일 업로드 — 드래그하거나 클릭"
        className={`border-2 border-dashed rounded-[var(--radius-lg)] px-6 py-9 flex flex-col items-center gap-3 text-center cursor-pointer transition-all mb-5 [&>svg]:text-muted ${dragOver ? 'border-accent bg-accent-dim' : 'border-border hover:border-accent hover:bg-accent-dim'}`}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <IconUpload width={32} height={32} />
        <div>
          <div className="text-[0.875rem] text-secondary font-medium">파일을 드래그하거나 클릭하여 업로드</div>
          <div className="text-[0.78rem] text-muted mt-1">이미지 · 동영상 · 오디오 · 문서(PDF/Word/Excel/PPT/TXT) · 최대 50MB/파일</div>
        </div>
      </div>

      {/* 업로드 진행률 */}
      {uploadQueue.length > 0 && (
        <div className="flex flex-col gap-2 mb-5">
          {uploadQueue.map((item, i) => (
            <div key={`${item.name}-${i}`}>
              <div className="flex justify-between text-[0.78rem] text-secondary mb-1">
                <span className="truncate">{item.name}</span>
                <span className="text-muted shrink-0 ml-2">{item.percent}%</span>
              </div>
              <div className="h-1.5 bg-elevated rounded-[3px] overflow-hidden">
                <div className="h-full rounded-[3px] bg-accent transition-[width]" style={{ width: `${item.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 브레드크럼 */}
      <div className="flex items-center gap-1.5 text-[0.82rem] text-muted mb-4 flex-wrap">
        <button type="button" className="text-accent hover:opacity-70" onClick={() => handleNavigateTo(undefined)}>
          📁 전체
        </button>
        {data.breadcrumb.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1.5">
            <span className="text-border">/</span>
            <button type="button" className="text-accent hover:opacity-70" onClick={() => handleNavigateTo(crumb.id)}>
              {crumb.name}
            </button>
          </span>
        ))}
        {currentFolderId === undefined && (
          <span className="text-border ml-1">— 루트</span>
        )}
      </div>

      {/* 검색 + 필터 */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted w-[15px] h-[15px] pointer-events-none" />
          <input className="input pl-icon" type="text" placeholder="파일/폴더명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="파일 검색" />
        </div>
        <span className="text-muted ml-auto text-[0.82rem]">
          폴더 {filteredFolders.length} · 파일 {filteredFiles.length}
        </span>
      </div>

      <QueryState query={dataQuery} errorMessage="파일 목록을 불러오지 못했습니다.">
        <>
          {/* 폴더 섹션 */}
          {filteredFolders.length > 0 && (
            <>
              <div className={SECTION}><IconFolder width={16} height={16} />폴더</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-7">
                {filteredFolders.map((f) => (
                  <div
                    key={f.id}
                    {...clickable(() => handleEnterFolder(f.id))}
                    aria-label={`폴더 ${f.name} 열기`}
                    className="flex flex-col items-center gap-2 px-3 pt-5 pb-3.5 bg-background border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] cursor-pointer transition-all text-center hover:border-accent hover:bg-accent-dim hover:-translate-y-px group relative"
                    onClick={() => handleEnterFolder(f.id)}
                  >
                    <div className="text-[2rem] leading-none">📁</div>
                    <div className="text-[0.82rem] font-semibold text-primary break-all">{f.name}</div>
                    <div className="text-[0.72rem] text-muted">
                      파일 {f.fileCount}개{f.childFolderCount > 0 ? ` · 폴더 ${f.childFolderCount}개` : ''}
                    </div>
                    <button
                      type="button"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-muted hover:text-danger hover:bg-surface transition-all"
                      onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f); }}
                      aria-label="폴더 삭제"
                    >
                      <IconTrash width={12} height={12} />
                    </button>
                  </div>
                ))}
                <div
                  {...clickable(() => setFolderModal(true))}
                  aria-label="새 폴더 생성"
                  className="flex flex-col items-center justify-center gap-2 px-3 py-5 border border-dashed border-border rounded-[var(--radius-lg)] text-muted cursor-pointer transition-all hover:border-accent hover:text-accent hover:bg-accent-dim"
                  onClick={() => setFolderModal(true)}
                >
                  <IconFolderPlus width={24} height={24} />
                  <div className="text-[0.82rem] font-medium">새 폴더</div>
                </div>
              </div>
            </>
          )}

          {/* 폴더가 없을 때 새 폴더 버튼만 */}
          {filteredFolders.length === 0 && !search && (
            <div className="mb-7">
              <div className={SECTION}><IconFolder width={16} height={16} />폴더</div>
              <div
                {...clickable(() => setFolderModal(true))}
                aria-label="새 폴더 생성"
                className="inline-flex flex-col items-center justify-center gap-2 px-6 py-5 border border-dashed border-border rounded-[var(--radius-lg)] text-muted cursor-pointer transition-all hover:border-accent hover:text-accent hover:bg-accent-dim"
                onClick={() => setFolderModal(true)}
              >
                <IconFolderPlus width={24} height={24} />
                <div className="text-[0.82rem] font-medium">새 폴더</div>
              </div>
            </div>
          )}

          {/* 파일 섹션 */}
          <div className={SECTION}><IconDoc width={16} height={16} />파일</div>
          {filteredFiles.length === 0 ? (
            <div className="text-center py-10 text-muted text-sm">파일이 없습니다.</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  {...clickable(() => setViewer(file))}
                  aria-label={`${file.name} 미리보기`}
                  className="bg-background border border-border rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)] transition-all cursor-pointer hover:border-accent hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                  onClick={() => setViewer(file)}
                >
                  <div className="h-[100px] bg-surface flex items-center justify-center text-[2rem] border-b border-border relative">
                    {fileEmoji(file.mimeType)}
                    <span className="absolute top-[7px] right-[7px] px-1.5 py-px rounded-full text-[0.6rem] [font-family:var(--font-mono)] bg-[rgba(15,25,35,0.5)] text-white uppercase">
                      {fileExt(file.name)}
                    </span>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="text-[0.8rem] font-medium text-primary truncate mb-0.5">{file.name}</div>
                    <div className="text-[0.7rem] text-muted">{formatBytes(file.size)} · {new Date(file.createdAt).toLocaleDateString('ko-KR')}</div>
                  </div>
                  <div className="flex border-t border-border-subtle" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className={FILE_BTN} onClick={() => setViewer(file)}>보기</button>
                    <button type="button" className={FILE_BTN} onClick={() => handleDownloadFile(file)}>다운</button>
                    <button type="button" className={`${FILE_BTN} hover:text-danger`} onClick={() => handleDeleteFile(file)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      </QueryState>

      {/* 폴더 생성 모달 */}
      <Modal
        open={folderModal}
        onClose={() => { setFolderModal(false); setFolderName(''); }}
        title="새 폴더 생성"
        footer={
          <ModalFooter
            onClose={() => { setFolderModal(false); setFolderName(''); }}
            onSave={handleCreateFolder}
            saving={saving}
            saveLabel="생성"
          />
        }
      >
        <Field label="폴더 이름">
          <input
            type="text"
            className="input"
            placeholder="예: 보험 서류"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            autoFocus
          />
        </Field>
        {currentFolderId !== undefined && (
          <p className="text-[0.78rem] text-muted mt-2">
            현재 폴더 안에 생성됩니다.
          </p>
        )}
      </Modal>

      {/* 파일 뷰어 모달 */}
      <ViewerModal file={viewer} onClose={() => setViewer(null)} onDownload={handleDownloadFile} />

      {confirmElement}
    </AppShell>
  );
}

// ── 뷰어 모달 ────────────────────────────────────────────────────────────────

function ViewerModal({
  file,
  onClose,
  onDownload,
}: {
  file: FileItem | null;
  onClose: () => void;
  onDownload: (f: FileItem) => void;
}) {
  const [loadedPreview, setLoadedPreview] = useState<{ id: number; url: string } | null>(null);

  useEffect(() => {
    if (!file) return;
    const isPreviewable = file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf';
    if (!isPreviewable) return;
    let cancelled = false;
    api.get<{ url: string }>(`/files/${file.id}/url?disposition=inline`).then(({ url }) => {
      if (!cancelled) setLoadedPreview({ id: file.id, url });
    }).catch(() => {
      if (!cancelled) notify.error('미리보기 URL 발급에 실패했습니다.');
    });
    return () => { cancelled = true; };
  }, [file]);

  if (!file) return null;
  const previewUrl = loadedPreview?.id === file.id ? loadedPreview.url : null;
  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';

  const header = (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
      <span className="text-[1.2rem]">{fileEmoji(file.mimeType)}</span>
      <span className="text-[0.875rem] font-semibold text-primary flex-1 truncate">{file.name}</span>
      <div className="flex gap-1.5 items-center">
        <Button variant="ghost" size="sm" onClick={() => onDownload(file)}>다운로드</Button>
        <button
          type="button"
          className={NAV_BTN_34}
          onClick={onClose}
          aria-label="닫기"
        >
          <IconClose width={16} height={16} />
        </button>
      </div>
    </div>
  );

  return (
    <Modal open={!!file} onClose={onClose} title={file.name} className="max-w-[860px]" header={header} footer={
      <span className="text-[0.78rem] text-muted">{formatBytes(file.size)} · {file.mimeType}</span>
    }>
      <div className="bg-elevated flex items-center justify-center min-h-[400px] rounded-[var(--radius)] -m-6 overflow-hidden">
        {isImage ? (
          previewUrl ? (
            // 만료되는 presigned URL 이라 next/image 최적화 프록시 대신 unoptimized 로 직접 로드
            <div className="relative w-full h-[70vh]">
              <Image src={previewUrl} alt={file.name} fill unoptimized className="object-contain" />
            </div>
          ) : (
            <div className="w-full max-w-[480px] aspect-[4/3] bg-[linear-gradient(135deg,var(--bg-surface)_0%,var(--bg-elevated)_100%)] border border-border rounded-[var(--radius)] flex flex-col items-center justify-center gap-3 [&>svg]:text-muted">
              <IconImage width={48} height={48} />
              <span className="text-[0.78rem] text-muted">불러오는 중…</span>
            </div>
          )
        ) : isPdf ? (
          previewUrl ? (
            <iframe src={previewUrl} title={file.name} className="w-full h-[70vh] border-0" />
          ) : (
            <div className="text-center px-6 py-12 flex flex-col items-center gap-4 [&>svg]:text-muted">
              <IconDoc width={64} height={64} />
              <div className="[font-family:var(--font-display)] text-base font-bold text-primary">{file.name}</div>
              <span className="text-[0.78rem] text-muted">불러오는 중…</span>
            </div>
          )
        ) : (
          <div className="text-center px-6 py-12 flex flex-col items-center gap-4 [&>svg]:text-muted">
            <IconDoc width={64} height={64} />
            <div className="text-[0.855rem] text-secondary">{file.name}</div>
            <Button variant="ghost" size="sm" onClick={() => onDownload(file)}>다운로드</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
