'use client';

/**
 * 파일 보관함 페이지.
 * 폴더/파일을 그리드로 보고 드래그·업로드, 폴더 생성, 문서 뷰어(PDF/이미지 목업)를 제공한다.
 * 공통 레이아웃(AppShell)·모달(Modal)을 재사용하고 데이터는 더미로 채운다. (Cloudflare R2)
 * 스타일: Tailwind + 공통 컴포넌트(Modal/Button/Field).
 */
import { useRef, useState } from 'react';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import Button, { buttonClasses } from '@/components/ui/Button';
import { Field, ModalFooter } from '@/components/ui/Field';
import {
  IconFolderPlus, IconUpload, IconDownload, IconEye, IconFolder, IconTrash,
  IconDoc, IconImage, IconClose, IconSearch,
} from '@/components/icons';

interface FileItem { type: 'pdf' | 'image'; name: string; ext: string; emoji: string; meta: string; }

// ── 더미 데이터 (TODO: GET /api/v1/files) ───────────────────────
const FOLDERS = [
  { icon: '📁', name: '보험 서류', count: 8 },
  { icon: '📁', name: '신분증 사본', count: 3 },
  { icon: '📁', name: '계약서', count: 12 },
  { icon: '🖼️', name: '사진', count: 28 },
];

const FILES: FileItem[] = [
  { type: 'pdf', name: '보험증권_2025.pdf', ext: 'PDF', emoji: '📄', meta: '1.2 MB · 2025.05.29' },
  { type: 'image', name: '영수증_20250530.jpg', ext: 'JPG', emoji: '🖼️', meta: '320 KB · 2025.05.30' },
];

const SECTION = '[font-family:var(--font-display)] text-[0.9rem] font-bold text-primary mb-3 flex items-center gap-2';
const FILE_BTN = 'flex-1 flex items-center justify-center gap-[3px] py-1.5 text-[0.72rem] text-muted transition-all border-r border-border-subtle last:border-r-0 hover:bg-surface hover:text-primary [&_svg]:w-[11px] [&_svg]:h-[11px]';

export default function FilesPage() {
  const [dragOver, setDragOver] = useState(false);
  const [folder, setFolder] = useState('루트');          // 현재 브레드크럼 위치
  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [viewer, setViewer] = useState<FileItem | null>(null); // 뷰어 대상 파일
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 드롭존에 파일을 떨어뜨렸을 때. TODO: R2 업로드 API 연동
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  // 폴더 생성. TODO: POST /api/v1/folders
  function createFolder() {
    if (!folderName.trim()) return;
    setFolderModal(false);
    setFolderName('');
  }

  return (
    <AppShell activePath="/files" topbarLabel="파일 보관함">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">파일 보관함</h1>
          <p className="text-sm text-secondary mt-1.5">폴더를 생성하여 파일을 정리하거나, 바로 업로드할 수 있습니다. (Cloudflare R2)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setFolderModal(true)}><IconFolderPlus width={14} height={14} />폴더 생성</Button>
          <label className={buttonClasses('primary')}>
            <IconUpload width={13} height={13} />파일 업로드
            <input ref={fileInputRef} type="file" multiple hidden />
          </label>
        </div>
      </div>

      {/* 스토리지 사용량 — TODO: GET /api/v1/files/storage */}
      <div className="mb-5">
        <div className="flex justify-between text-[0.8rem] mb-1.5 text-secondary [&_strong]:text-accent">
          <span>24.51 MB 사용 중</span>
          <span>1 GB 중 <strong>2.4%</strong></span>
        </div>
        <div className="h-1.5 bg-elevated rounded-[3px] overflow-hidden"><div className="h-full rounded-[3px] bg-accent w-[2.4%]" /></div>
      </div>

      {/* 내보내기 */}
      <div className="flex gap-2 flex-wrap items-center mb-5 px-4 py-3 bg-surface border border-border rounded-[var(--radius)]">
        <span className="text-[0.75rem] font-semibold text-muted whitespace-nowrap mr-1">내보내기</span>
        <button type="button" className="excel-btn"><IconDownload />파일 목록 다운로드</button>
      </div>

      {/* 업로드 드롭존 */}
      <div
        className={`border-2 border-dashed rounded-[var(--radius-lg)] px-6 py-9 flex flex-col items-center gap-3 text-center cursor-pointer transition-all mb-5 [&>svg]:text-muted ${dragOver ? 'border-accent bg-accent-dim' : 'border-border hover:border-accent hover:bg-accent-dim'}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <IconUpload width={32} height={32} />
        <div>
          <div className="text-[0.875rem] text-secondary font-medium">파일을 드래그하거나 클릭하여 업로드</div>
          <div className="text-[0.78rem] text-muted mt-1">JPG · PNG · PDF · DOCX · 최대 50MB/파일</div>
        </div>
      </div>

      {/* OCR 안내 배너 */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-accent-dim border border-[rgba(0,192,127,0.2)] rounded-[var(--radius)] mb-5 text-[0.82rem]">
        <span>🧾</span>
        <span className="flex-1 text-secondary">영수증 이미지를 올리면 <strong>OCR</strong>로 금액·날짜를 읽어 가계부에 자동 등록 제안합니다.</span>
        <Button href="/transactions" variant="ghost" size="sm">가계부</Button>
      </div>

      {/* 브레드크럼 */}
      <div className="flex items-center gap-1.5 text-[0.82rem] text-muted mb-4 flex-wrap">
        <a href="#" className="text-accent hover:opacity-70" onClick={() => setFolder('루트')}>📁 전체</a>
        <span className="text-border">/</span>
        <span className="text-primary font-medium">{folder}</span>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted w-[15px] h-[15px] pointer-events-none" />
          <input className="input pl-[34px]" type="text" placeholder="파일/폴더명 검색..." aria-label="파일 검색" />
        </div>
        <select className="input w-auto min-w-[110px] shrink-0" defaultValue="전체" aria-label="유형 필터">
          <option>전체</option><option>이미지</option><option>PDF</option><option>문서</option>
        </select>
        <select className="input w-auto min-w-[110px] shrink-0" defaultValue="최신순" aria-label="정렬">
          <option>최신순</option><option>이름순</option><option>크기순</option>
        </select>
        <span className="text-muted ml-auto text-[0.82rem]">폴더 {FOLDERS.length} · 파일 51</span>
      </div>

      {/* 폴더 섹션 */}
      <div className={SECTION}><IconFolder width={16} height={16} />폴더</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-7">
        {FOLDERS.map((f) => (
          <div className="flex flex-col items-center gap-2 px-3 pt-5 pb-3.5 bg-background border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] cursor-pointer transition-all text-center hover:border-accent hover:bg-accent-dim hover:-translate-y-px" key={f.name} onClick={() => setFolder(f.name)}>
            <div className="text-[2rem] leading-none">{f.icon}</div>
            <div className="text-[0.82rem] font-semibold text-primary break-all">{f.name}</div>
            <div className="text-[0.72rem] text-muted">파일 {f.count}개</div>
          </div>
        ))}
        <div className="flex flex-col items-center justify-center gap-2 px-3 py-5 border border-dashed border-border rounded-[var(--radius-lg)] text-muted cursor-pointer transition-all hover:border-accent hover:text-accent hover:bg-accent-dim" onClick={() => setFolderModal(true)}>
          <IconFolderPlus width={24} height={24} />
          <div className="text-[0.82rem] font-medium">새 폴더</div>
        </div>
      </div>

      {/* 파일 섹션 */}
      <div className={SECTION}><IconDoc width={16} height={16} />미분류 파일</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {FILES.map((file) => (
          <div className="bg-background border border-border rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)] transition-all cursor-pointer hover:border-accent hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]" key={file.name} onClick={() => setViewer(file)}>
            <div className="h-[100px] bg-surface flex items-center justify-center text-[2rem] border-b border-border relative">
              {file.emoji}<span className="absolute top-[7px] right-[7px] px-1.5 py-px rounded-full text-[0.6rem] [font-family:var(--font-mono)] bg-[rgba(15,25,35,0.5)] text-white uppercase">{file.ext}</span>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[0.8rem] font-medium text-primary truncate mb-0.5">{file.name}</div>
              <div className="text-[0.7rem] text-muted">{file.meta}</div>
            </div>
            <div className="flex border-t border-border-subtle" onClick={(e) => e.stopPropagation()}>
              <button type="button" className={FILE_BTN} onClick={() => setViewer(file)}><IconEye width={11} height={11} />보기</button>
              <button type="button" className={FILE_BTN}><IconDownload width={11} height={11} />다운</button>
              <button type="button" className={FILE_BTN}><IconFolder width={11} height={11} />이동</button>
              <button type="button" className={`${FILE_BTN} hover:text-danger`}><IconTrash width={11} height={11} />삭제</button>
            </div>
          </div>
        ))}
      </div>

      {/* 폴더 생성 모달 */}
      <Modal open={folderModal} onClose={() => setFolderModal(false)} title="새 폴더 생성" footer={<ModalFooter onClose={() => setFolderModal(false)} onSave={createFolder} saving={false} saveLabel="생성" />}>
        <Field label="폴더 이름">
          <input type="text" className="input" placeholder="예: 보험 서류" value={folderName} onChange={(e) => setFolderName(e.target.value)} />
        </Field>
      </Modal>

      {/* 문서 뷰어 모달 */}
      <ViewerModal file={viewer} onClose={() => setViewer(null)} />
    </AppShell>
  );
}

// 문서 뷰어 모달 — PDF/이미지 목업 렌더링
function ViewerModal({ file, onClose }: { file: FileItem | null; onClose: () => void }) {
  if (!file) return null;

  const header = (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
      <span className="text-[1.2rem]">{file.type === 'pdf' ? '📄' : '🖼️'}</span>
      <span className="text-[0.875rem] font-semibold text-primary flex-1 truncate">{file.name}</span>
      <div className="flex gap-1.5 items-center">
        <Button variant="ghost" size="sm"><IconDownload width={13} height={13} />다운로드</Button>
        <button type="button" className="w-[34px] h-[34px] inline-flex items-center justify-center rounded-[var(--radius)] text-secondary border border-border transition-all hover:bg-surface hover:text-primary" onClick={onClose} aria-label="닫기">
          <IconClose width={16} height={16} />
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      open={!!file}
      onClose={onClose}
      title={file.name}
      className="max-w-[860px]"
      header={header}
      footer={<span className="text-[0.78rem] text-muted">{file.type === 'pdf' ? 'PDF 문서 · 실제 구현 시 PDF.js 사용' : '이미지 · 실제 구현 시 R2 presigned URL 사용'}</span>}
    >
      <div className="bg-elevated flex items-center justify-center min-h-[400px] rounded-[var(--radius)] -m-6">
        {file.type === 'pdf' ? (
          <div className="text-center px-6 py-12 flex flex-col items-center gap-4 [&>svg]:text-muted">
            <IconDoc width={64} height={64} />
            <div className="[font-family:var(--font-display)] text-base font-bold text-primary">{file.name}</div>
            <div className="text-[0.855rem] text-secondary max-w-[320px] leading-relaxed">실제 구현 시 <strong>PDF.js</strong>로 브라우저 내 렌더링됩니다. 현재는 목업 상태입니다.</div>
          </div>
        ) : (
          <div className="text-center px-6 py-12 flex flex-col items-center gap-4">
            <div className="w-full max-w-[480px] aspect-[4/3] bg-[linear-gradient(135deg,var(--bg-surface)_0%,var(--bg-elevated)_100%)] border border-border rounded-[var(--radius)] flex flex-col items-center justify-center gap-3 [&>svg]:text-muted">
              <IconImage width={48} height={48} />
              <span className="text-[0.78rem] text-muted">{file.name}</span>
            </div>
            <div className="text-[0.855rem] text-secondary max-w-[320px] leading-relaxed">실제 구현 시 Cloudflare R2 presigned URL로 이미지를 로드합니다.</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
