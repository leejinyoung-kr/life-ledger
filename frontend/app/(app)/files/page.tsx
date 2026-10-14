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
import { localDate } from '@/lib/finance';
import { countFolders, fromDroppedEntries, fromFileList, splitUploadable, type UploadItem } from '@/lib/folderUpload';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import QueryState from '@/components/QueryState';
import Modal from '@/components/Modal';
import ConfirmModal, { useConfirm } from '@/components/ConfirmModal';
import Button, { buttonClasses } from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput';
import Segmented from '@/components/ui/Segmented';
import IconButton from '@/components/ui/IconButton';
import { Field, ModalFooter } from '@/components/ui/Field';
import { Card } from '@/components/ui/Card';
import EmptyState from '@/components/EmptyState';
import {
  IconFolderPlus, IconUpload, IconFolder, IconTrash, IconDownload,
  IconDoc, IconImage, IconClose,
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

// 전체 검색 결과 — 항목마다 위치(루트 → 들어 있는 폴더)가 붙는다
interface SearchResponse {
  folders: (FolderItem & { path: BreadcrumbItem[] })[];
  files: (FileItem & { path: BreadcrumbItem[] })[];
  truncated: boolean;
}

// ZIP 으로 받기 전 요약
interface ZipSummary {
  fileCount: number;
  totalBytes: number;
  maxBytes: number;
}

// 비우기 전 요약
interface ClearSummary {
  folderCount: number;
  fileCount: number;
  totalBytes: number;
}

// 비우기 확인에서 그대로 입력해야 하는 낱말 (실수로 누르는 것 막기)
const CLEAR_WORD = '비우기';

type SearchScope = 'all' | 'here';

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
  // 업로드 진행 — 몇 번째 파일인지 · 실패 수 · 지금 파일 이름과 진행률
  const [upload, setUpload] = useState<{ done: number; total: number; failed: number; current: string; percent: number } | null>(null);
  const [viewer, setViewer] = useState<FileItem | null>(null);
  const [pendingSearch, setPendingSearch] = useState('');
  const [search, setSearch] = useState('');
  // 검색 범위 — 전체(모든 폴더, 서버 검색) / 현재 폴더(지금 목록에서 거르기)
  const [scope, setScope] = useState<SearchScope>('all');
  const [zipping, setZipping] = useState(false);
  // ZIP 받는 진행 — 받은 바이트 / 원본 합계(대략 ZIP 크기). 첫 바이트 전에는 null
  const [zipProgress, setZipProgress] = useState<{ received: number; total: number } | null>(null);
  // 비우기 — 요약을 받으면 확인 창을 띄운다
  const [clearPlan, setClearPlan] = useState<ClearSummary | null>(null);
  const [clearWord, setClearWord] = useState('');
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();

  // 검색 버튼(또는 Enter) 클릭 시에만 실제 필터에 반영
  function handleSearch() {
    setSearch(pendingSearch);
  }

  // 현재 폴더 목록 (React Query — folderId 별 캐시)
  const listQs = useMemo(() => {
    const params = new URLSearchParams();
    if (currentFolderId !== undefined) params.set('folderId', String(currentFolderId));
    return params.toString();
  }, [currentFolderId]);
  const dataQuery = useApiQuery<ListResponse>(qk.files.list(currentFolderId), `/files${listQs ? `?${listQs}` : ''}`);
  const data = dataQuery.data ?? { breadcrumb: [], folders: [], files: [], totalBytes: 0 };
  // 변이 후 파일 트리 무효화 (전체 검색 결과도 같이)
  const reload = () => invalidate(qk.files.all);

  const searchingAll = scope === 'all' && search.trim() !== '';
  const searchQuery = useApiQuery<SearchResponse>(
    qk.files.search(search.trim()),
    `/files/search?q=${encodeURIComponent(search.trim())}`,
    { enabled: searchingAll },
  );

  // 폴더 클릭 — 해당 폴더로 진입
  function handleEnterFolder(id: number) {
    setCurrentFolderId(id);
    setSearch('');
    setPendingSearch('');
  }

  // 브레드크럼 클릭 — 루트 또는 상위 폴더로 이동
  function handleNavigateTo(id?: number) {
    setCurrentFolderId(id);
    setSearch('');
    setPendingSearch('');
  }

  // 파일·폴더 업로드 — 한 파일씩 차례로 올리고, 실패한 파일은 건너뛰고 끝에 모아 알린다.
  // 폴더가 섞여 있으면 먼저 확인받는다 (같은 이름 폴더가 이미 있으면 그 안에 합쳐진다)
  async function handleUpload(raw: UploadItem[]) {
    if (raw.length === 0) return;
    const { ok, tooBig } = splitUploadable(raw);
    if (ok.length === 0) {
      notify.error(tooBig.length ? `50MB 를 넘는 파일만 있습니다 (${tooBig.length}개).` : '올릴 파일이 없습니다.');
      return;
    }
    const folders = countFolders(ok);
    if (folders > 0) {
      const where = data.breadcrumb.at(-1)?.name;
      const bytes = ok.reduce((sum, it) => sum + it.file.size, 0);
      const big = tooBig.length ? ` 50MB 를 넘는 ${tooBig.length}개는 빠집니다.` : '';
      const msg = `폴더 ${folders}개 · 파일 ${ok.length}개(${formatBytes(bytes)})를 ${where ? `"${where}" 폴더` : '맨 위(루트)'}에 올릴까요? 같은 이름 폴더가 있으면 그 안에 합쳐집니다.${big}`;
      if (!await confirm(msg, 'primary')) return;
    }

    const failures: { name: string; reason: string }[] = tooBig.map((it) => ({ name: it.file.name, reason: '50MB 초과' }));
    setUploading(true);
    try {
      for (let i = 0; i < ok.length; i++) {
        const { file, dir } = ok[i];
        const label = dir ? `${dir}/${file.name}` : file.name;
        setUpload({ done: i, total: ok.length, failed: failures.length, current: label, percent: 0 });
        const params = new URLSearchParams();
        if (currentFolderId !== undefined) params.set('folderId', String(currentFolderId));
        if (dir) params.set('path', dir);
        try {
          await apiUploadProgress(`/files/upload?${params}`, file, (percent) => setUpload((u) => (u ? { ...u, percent } : u)));
        } catch (e) {
          failures.push({ name: label, reason: (e as Error).message || '업로드 실패' });
        }
      }
    } finally {
      setUploading(false);
      setUpload(null);
      reload();
    }

    const uploaded = ok.length - (failures.length - tooBig.length);
    if (failures.length === 0) notify.success(`${uploaded}개 업로드 완료`);
    else {
      const sample = failures.slice(0, 3).map((f) => `${f.name}(${f.reason})`).join(', ');
      notify.error(`${uploaded}개 올림 · ${failures.length}개 실패 — ${sample}${failures.length > 3 ? ' 외' : ''}`);
    }
  }

  // 드롭 — 폴더가 섞여 있으면 안쪽까지 읽어 상대 경로를 붙인다.
  // 항목(entry)은 이벤트가 끝나면 비워지므로 여기서 바로 꺼내 둔다
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const entries = Array.from(e.dataTransfer.items)
      .map((it) => it.webkitGetAsEntry?.() ?? null)
      .filter((en): en is FileSystemEntry => en !== null);
    if (entries.some((en) => en.isDirectory)) {
      fromDroppedEntries(entries).then(handleUpload).catch(() => notify.error('폴더를 읽지 못했습니다.'));
    } else {
      handleUpload(fromFileList(e.dataTransfer.files));
    }
  }

  // 고른 파일·폴더 업로드 후 input 을 비워 같은 것을 다시 골라도 change 가 나게 한다
  function handlePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const items = fromFileList(e.target.files ?? []);
    e.target.value = '';
    handleUpload(items);
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

  // 지금 폴더(루트면 보관함 전체)를 하위 폴더까지 ZIP 으로 받기 — 먼저 개수·용량을 보여 주고 확인받는다
  async function handleDownloadZip() {
    const qs = currentFolderId !== undefined ? `?folderId=${currentFolderId}` : '';
    const where = data.breadcrumb.at(-1)?.name;
    setZipping(true);
    try {
      const s = await api.get<ZipSummary>(`/files/zip/summary${qs}`);
      if (s.fileCount === 0) {
        notify.error('받을 파일이 없습니다.');
        return;
      }
      if (s.totalBytes > s.maxBytes) {
        notify.error(`한 번에 받을 수 있는 용량(${formatBytes(s.maxBytes)})을 넘습니다 — ${formatBytes(s.totalBytes)}. 하위 폴더별로 나눠 받으세요.`);
        return;
      }
      if (!await confirm(`${where ? `"${where}" 폴더` : '보관함 전체'}의 파일 ${s.fileCount}개(${formatBytes(s.totalBytes)})를 ZIP 으로 받을까요?`, 'primary')) return;
      await api.download(`/files/zip${qs}`, `${where ?? '파일보관함'}_${localDate()}.zip`, (received) => setZipProgress({ received, total: s.totalBytes }));
      notify.success('ZIP 을 받았습니다.');
    } catch (e) {
      notify.error((e as Error).message || 'ZIP 다운로드에 실패했습니다.');
    } finally {
      setZipping(false);
      setZipProgress(null);
    }
  }

  // 지금 폴더(루트면 보관함 전체) 비우기 준비 — 지울 개수·용량을 받아 확인 창을 띄운다
  async function handleClearAsk() {
    const qs = currentFolderId !== undefined ? `?folderId=${currentFolderId}` : '';
    setClearing(true);
    try {
      const s = await api.get<ClearSummary>(`/files/clear/summary${qs}`);
      if (s.fileCount === 0 && s.folderCount === 0) {
        notify.error('지울 파일이 없습니다.');
        return;
      }
      setClearWord('');
      setClearPlan(s);
    } catch (e) {
      notify.error((e as Error).message || '비우기 준비에 실패했습니다.');
    } finally {
      setClearing(false);
    }
  }

  // 비우기 실행
  async function handleClear() {
    const qs = currentFolderId !== undefined ? `?folderId=${currentFolderId}` : '';
    setClearing(true);
    try {
      const r = await api.del<{ deletedFiles: number; deletedFolders: number }>(`/files/clear${qs}`);
      notify.success(`폴더 ${r.deletedFolders}개 · 파일 ${r.deletedFiles}개를 지웠습니다.`);
      setClearPlan(null);
      reload();
    } catch (e) {
      notify.error((e as Error).message || '비우기에 실패했습니다.');
    } finally {
      setClearing(false);
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

  // 보여 줄 목록 — 전체 검색이면 서버 결과(위치 포함), 아니면 현재 폴더 목록을 이름으로 거른 것
  const lower = search.toLowerCase();
  const shownFolders: (FolderItem & { path?: BreadcrumbItem[] })[] = searchingAll
    ? (searchQuery.data?.folders ?? [])
    : data.folders.filter((f) => f.name.toLowerCase().includes(lower));
  const shownFiles: (FileItem & { path?: BreadcrumbItem[] })[] = searchingAll
    ? (searchQuery.data?.files ?? [])
    : data.files.filter((f) => f.name.toLowerCase().includes(lower));

  // 검색어 지우기 — 현재 폴더 목록으로 돌아간다
  function handleClearSearch() {
    setSearch('');
    setPendingSearch('');
  }

  return (
    <AppShell activePath="/files">
      <PageHeader
        title="파일 보관함"
        description="폴더를 생성하여 파일을 정리하거나, 바로 업로드할 수 있습니다."
        actions={
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" onClick={() => setFolderModal(true)}>폴더 생성</Button>
            <label className={buttonClasses('ghost') + (uploading ? ' opacity-60 pointer-events-none' : '')}>
              폴더 업로드
              {/* webkitdirectory 는 React 타입에 없어 ref 로 붙인다 — 폴더를 고르면 안의 파일이 상대 경로와 함께 들어온다 */}
              <input ref={(el) => el?.setAttribute('webkitdirectory', '')} type="file" multiple hidden onChange={handlePicked} />
            </label>
            <label className={buttonClasses('primary') + (uploading ? ' opacity-60 pointer-events-none' : '')}>
              {uploading ? '업로드 중…' : '파일 업로드'}
              <input ref={fileInputRef} type="file" multiple hidden onChange={handlePicked} />
            </label>
          </div>
        }
      />

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
        className={`border-2 border-dashed rounded-panel px-6 py-9 flex flex-col items-center gap-3 text-center cursor-pointer transition-all mb-5 [&>svg]:text-muted ${dragOver ? 'border-accent bg-accent-dim' : 'border-border hover:border-accent hover:bg-accent-dim'}`}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <IconUpload width={32} height={32} />
        <div>
          <div className="text-[0.875rem] text-secondary font-medium">파일이나 폴더를 드래그하거나 클릭하여 업로드</div>
          <div className="text-[0.78rem] text-muted mt-1">이미지 · 동영상 · 오디오 · 문서(PDF/Word/Excel/PPT/TXT) · 최대 50MB/파일</div>
        </div>
      </div>

      {/* 업로드 진행률 */}
      {upload && (
        <div className="mb-5">
          <div className="flex justify-between text-[0.78rem] text-secondary mb-1">
            <span className="truncate">{upload.current}</span>
            <span className="text-muted shrink-0 ml-2">
              {upload.done + 1} / {upload.total}{upload.failed ? ` · 실패 ${upload.failed}` : ''} · {upload.percent}%
            </span>
          </div>
          <div className="h-1.5 bg-elevated rounded-[3px] overflow-hidden">
            <div className="h-full rounded-[3px] bg-accent transition-[width]" style={{ width: `${((upload.done + upload.percent / 100) / upload.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* 브레드크럼 + 지금 폴더(루트면 전체) ZIP 다운로드 */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <FolderTrail crumbs={data.breadcrumb} onNavigate={handleNavigateTo} />
        {currentFolderId === undefined && (
          <span className="text-border text-[0.82rem] ml-1">— 루트</span>
        )}
        <Button variant="ghost" size="sm" className="ml-auto" loading={zipping} loadingLabel={zipProgress ? `ZIP 받는 중 ${formatBytes(zipProgress.received)} / 약 ${formatBytes(zipProgress.total)}` : 'ZIP 준비 중…'} onClick={handleDownloadZip}>
          <IconDownload />{currentFolderId === undefined ? '전체 다운로드' : '이 폴더 다운로드'}
        </Button>
        <Button variant="danger" size="sm" loading={clearing && !clearPlan} loadingLabel="확인 중…" onClick={handleClearAsk}>
          <IconTrash />{currentFolderId === undefined ? '전체 비우기' : '이 폴더 비우기'}
        </Button>
      </div>

      {/* 검색 — 범위(전체 / 현재 폴더) + 검색어 */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <Segmented
          label="검색 범위"
          variant="joined"
          items={[{ value: 'all', label: '전체' }, { value: 'here', label: '현재 폴더' }]}
          value={scope}
          onChange={setScope}
        />
        <SearchInput
          label="파일 검색"
          className="flex-1 min-w-[200px]"
          placeholder={scope === 'all' ? '모든 폴더에서 파일/폴더명 검색...' : '현재 폴더에서 파일/폴더명 검색...'}
          value={pendingSearch}
          onChange={(e) => setPendingSearch(e.target.value)}
          onEnter={handleSearch}
        />
        <Button onClick={handleSearch}>검색</Button>
        {search && <Button variant="ghost" onClick={handleClearSearch}>지우기</Button>}
        <span className="text-muted ml-auto text-[0.82rem]">
          폴더 {shownFolders.length} · 파일 {shownFiles.length}
          {searchingAll && searchQuery.data?.truncated ? ' (앞쪽 일부만 표시)' : ''}
        </span>
      </div>
      {searchingAll && (
        <p className="text-[0.78rem] text-muted -mt-2 mb-4">
          &quot;{search.trim()}&quot; — 모든 폴더에서 찾은 결과예요. 위치를 누르면 그 폴더로 이동합니다.
        </p>
      )}

      <QueryState
        query={searchingAll ? searchQuery : dataQuery}
        errorMessage={searchingAll ? '검색하지 못했습니다.' : '파일 목록을 불러오지 못했습니다.'}
      >
        <>
          {/* 폴더 섹션 — 검색 중에는 새 폴더 타일을 숨긴다 */}
          {(shownFolders.length > 0 || !search) && (
            <div className="mb-7">
              <div className={SECTION}><IconFolder width={16} height={16} />폴더</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                {shownFolders.map((f) => (
                  <FolderCard
                    key={f.id}
                    folder={f}
                    onOpen={() => handleEnterFolder(f.id)}
                    onDelete={() => handleDeleteFolder(f)}
                    onNavigate={handleNavigateTo}
                  />
                ))}
                {!search && (
                  <div
                    {...clickable(() => setFolderModal(true))}
                    aria-label="새 폴더 생성"
                    className="flex flex-col items-center justify-center gap-2 px-3 py-5 border border-dashed border-border rounded-panel text-muted cursor-pointer transition-all hover:border-accent hover:text-accent hover:bg-accent-dim"
                    onClick={() => setFolderModal(true)}
                  >
                    <IconFolderPlus width={24} height={24} />
                    <div className="text-[0.82rem] font-medium">새 폴더</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 파일 섹션 */}
          <div className={SECTION}><IconDoc width={16} height={16} />파일</div>
          {shownFiles.length === 0 ? (
            <EmptyState size="lg" message={search ? '검색 결과가 없습니다.' : '파일이 없습니다.'} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {shownFiles.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onView={() => setViewer(file)}
                  onDownload={() => handleDownloadFile(file)}
                  onDelete={() => handleDeleteFile(file)}
                  onNavigate={handleNavigateTo}
                />
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
      <ConfirmModal
        open={clearPlan !== null}
        title={currentFolderId === undefined ? '보관함 전체 비우기' : `"${data.breadcrumb.at(-1)?.name ?? ''}" 폴더 비우기`}
        message={clearPlan ? `폴더 ${clearPlan.folderCount}개 · 파일 ${clearPlan.fileCount}개(${formatBytes(clearPlan.totalBytes)})를 지웁니다. 되돌릴 수 없어요. 계속하려면 "${CLEAR_WORD}"를 입력하세요.` : ''}
        confirmLabel="비우기"
        confirmDisabled={clearWord.trim() !== CLEAR_WORD}
        loading={clearing}
        loadingLabel="지우는 중…"
        onConfirm={handleClear}
        onCancel={() => setClearPlan(null)}
      >
        <input
          className="input text-center"
          autoFocus
          value={clearWord}
          placeholder={CLEAR_WORD}
          aria-label="확인 낱말"
          onChange={(e) => setClearWord(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && clearWord.trim() === CLEAR_WORD) handleClear(); }}
        />
      </ConfirmModal>
    </AppShell>
  );
}

// ── 목록 요소 ────────────────────────────────────────────────────────────────

// 폴더 경로 줄 "📁 전체 / 보험 / 2026" — 칸을 누르면 그 폴더로 이동 (브레드크럼 · 검색 결과 위치 공용)
function FolderTrail({ crumbs, onNavigate, size = 'md' }: { crumbs: BreadcrumbItem[]; onNavigate: (id?: number) => void; size?: 'md' | 'sm' }) {
  return (
    <div className={`flex items-center gap-1.5 text-muted flex-wrap min-w-0 ${size === 'sm' ? 'text-[0.7rem]' : 'text-[0.82rem]'}`}>
      <Button variant="link" size="inline" onClick={() => onNavigate(undefined)}>📁 전체</Button>
      {crumbs.map((crumb) => (
        <span key={crumb.id} className="flex items-center gap-1.5 min-w-0">
          <span className="text-border">/</span>
          <Button variant="link" size="inline" onClick={() => onNavigate(crumb.id)}>{crumb.name}</Button>
        </span>
      ))}
    </div>
  );
}

// 폴더 타일 — 누르면 들어간다. 전체 검색 결과면 위치(path)를 함께 보여 준다
function FolderCard({ folder, onOpen, onDelete, onNavigate }: {
  folder: FolderItem & { path?: BreadcrumbItem[] };
  onOpen: () => void;
  onDelete: () => void;
  onNavigate: (id?: number) => void;
}) {
  return (
    <Card
      hover="tile"
      onClick={onOpen}
      aria-label={`폴더 ${folder.name} 열기`}
      className="flex flex-col items-center gap-2 px-3 pt-5 pb-3.5 text-center group relative"
    >
      <div className="text-[2rem] leading-none">📁</div>
      <div className="text-[0.82rem] font-semibold text-primary break-all">{folder.name}</div>
      <div className="text-[0.72rem] text-muted">
        파일 {folder.fileCount}개{folder.childFolderCount > 0 ? ` · 폴더 ${folder.childFolderCount}개` : ''}
      </div>
      {folder.path && (
        <div onClick={(e) => e.stopPropagation()}>
          <FolderTrail crumbs={folder.path} onNavigate={onNavigate} size="sm" />
        </div>
      )}
      <button
        type="button"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 w-6 h-6 flex items-center justify-center rounded text-muted hover:text-danger hover:bg-surface transition-all"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label="폴더 삭제"
      >
        <IconTrash width={12} height={12} />
      </button>
    </Card>
  );
}

// 파일 카드 — 누르면 미리보기. 전체 검색 결과면 위치(path)를 함께 보여 준다
function FileCard({ file, onView, onDownload, onDelete, onNavigate }: {
  file: FileItem & { path?: BreadcrumbItem[] };
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onNavigate: (id?: number) => void;
}) {
  return (
    <Card clip onClick={onView} aria-label={`${file.name} 미리보기`}>
      <div className="h-[100px] bg-surface flex items-center justify-center text-[2rem] border-b border-border relative">
        {fileEmoji(file.mimeType)}
        <span className="absolute top-[7px] right-[7px] px-1.5 py-px rounded-full text-[0.6rem] [font-family:var(--font-mono)] bg-[rgba(15,25,35,0.5)] text-white uppercase">
          {fileExt(file.name)}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-[0.8rem] font-medium text-primary truncate mb-0.5">{file.name}</div>
        <div className="text-[0.7rem] text-muted">{formatBytes(file.size)} · {new Date(file.createdAt).toLocaleDateString('ko-KR')}</div>
        {file.path && (
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <FolderTrail crumbs={file.path} onNavigate={onNavigate} size="sm" />
          </div>
        )}
      </div>
      <div className="flex border-t border-border-subtle" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={FILE_BTN} onClick={onView}>보기</button>
        <button type="button" className={FILE_BTN} onClick={onDownload}>다운</button>
        <button type="button" className={`${FILE_BTN} hover:text-danger`} onClick={onDelete}>삭제</button>
      </div>
    </Card>
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
        <IconButton label="닫기" variant="bordered" size="lg" onClick={onClose}>
          <IconClose width={16} height={16} />
        </IconButton>
      </div>
    </div>
  );

  return (
    <Modal open={!!file} onClose={onClose} title={file.name} size="lg" header={header} footer={
      <span className="text-[0.78rem] text-muted">{formatBytes(file.size)} · {file.mimeType}</span>
    }>
      <div className="bg-elevated flex items-center justify-center min-h-[400px] rounded-ui -m-6 overflow-hidden">
        {isImage ? (
          previewUrl ? (
            // 만료되는 presigned URL 이라 next/image 최적화 프록시 대신 unoptimized 로 직접 로드
            <div className="relative w-full h-[70vh]">
              <Image src={previewUrl} alt={file.name} fill unoptimized className="object-contain" />
            </div>
          ) : (
            <div className="w-full max-w-[480px] aspect-[4/3] bg-[linear-gradient(135deg,var(--bg-surface)_0%,var(--bg-elevated)_100%)] border border-border rounded-ui flex flex-col items-center justify-center gap-3 [&>svg]:text-muted">
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
