'use client';

/**
 * 파일 보관함 페이지.
 * 폴더/파일을 그리드로 보고 드래그·업로드, 폴더 생성, 문서 뷰어(PDF/이미지 목업)를 제공한다.
 * 공통 레이아웃(AppShell)·모달(Modal)을 재사용하고 데이터는 더미로 채운다. (Cloudflare R2)
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
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

export default function FilesPage() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [folder, setFolder] = useState('루트');          // 현재 브레드크럼 위치
  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [viewer, setViewer] = useState<FileItem | null>(null); // 뷰어 대상 파일
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 인증 가드 — 토큰 없으면 로그인 페이지로. TODO: 토큰 유효성 검증 API 연동
  useEffect(() => {
    if (!localStorage.getItem('auth_token')) {
      router.replace('/login');
    }
  }, [router]);

  // 로그아웃 — 토큰 제거 후 로그인 페이지로 이동
  function logout() {
    localStorage.removeItem('auth_token');
    router.push('/login');
  }

  // 드롭존에 파일을 떨어뜨렸을 때. TODO: R2 업로드 API 연동
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    // const files = e.dataTransfer.files; → 업로드 처리
  }

  // 폴더 생성. TODO: POST /api/v1/folders
  function createFolder() {
    if (!folderName.trim()) return;
    setFolderModal(false);
    setFolderName('');
  }

  // 상단바 우측: 폴더 생성 + 파일 업로드 버튼
  const topbarRight = (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setFolderModal(true)}>
        <IconFolderPlus width={14} height={14} />폴더 생성
      </button>
      <label className="btn btn-primary">
        <IconUpload width={13} height={13} />파일 업로드
        {/* TODO: R2 업로드 API 연동 */}
        <input ref={fileInputRef} type="file" multiple hidden />
      </label>
    </>
  );

  return (
    <AppShell activePath="/files" topbarLabel="파일 보관함" topbarRight={topbarRight} onLogout={logout}>
      <div className="page-header">
        <h1 className="page-title">파일 보관함</h1>
        <p className="page-subtitle">폴더를 생성하여 파일을 정리하거나, 바로 업로드할 수 있습니다. (Cloudflare R2)</p>
      </div>

      {/* 스토리지 사용량 — TODO: GET /api/v1/files/storage */}
      <div className="storage-bar">
        <div className="storage-info">
          <span>24.51 MB 사용 중</span>
          <span>1 GB 중 <strong>2.4%</strong></span>
        </div>
        <div className="storage-track"><div className="storage-fill" /></div>
      </div>

      {/* 내보내기 */}
      <div className="excel-toolbar">
        <span className="excel-toolbar-label">내보내기</span>
        {/* TODO: 파일 목록 다운로드 API 연동 */}
        <button type="button" className="excel-btn"><IconDownload />파일 목록 다운로드</button>
      </div>

      {/* 업로드 드롭존 */}
      <div
        className={`dropzone${dragOver ? ' drag-over' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <IconUpload width={32} height={32} />
        <div>
          <div className="dropzone-title">파일을 드래그하거나 클릭하여 업로드</div>
          <div className="dropzone-hint">JPG · PNG · PDF · DOCX · 최대 50MB/파일</div>
        </div>
      </div>

      {/* OCR 안내 배너 */}
      <div className="ocr-banner">
        <span>🧾</span>
        <span className="msg">영수증 이미지를 올리면 <strong>OCR</strong>로 금액·날짜를 읽어 가계부에 자동 등록 제안합니다.</span>
        <a href="/transactions" className="btn btn-ghost btn-sm">가계부</a>
      </div>

      {/* 브레드크럼 */}
      <div className="breadcrumb">
        <a href="#" onClick={() => setFolder('루트')}>📁 전체</a>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{folder}</span>
      </div>

      {/* 필터 */}
      <div className="toolbar">
        <div className="search-wrap">
          <IconSearch className="search-icon" />
          <input className="input" type="text" placeholder="파일/폴더명 검색..." aria-label="파일 검색" />
        </div>
        <select className="input filter-select" defaultValue="전체" aria-label="유형 필터">
          <option>전체</option><option>이미지</option><option>PDF</option><option>문서</option>
        </select>
        <select className="input filter-select" defaultValue="최신순" aria-label="정렬">
          <option>최신순</option><option>이름순</option><option>크기순</option>
        </select>
        <span className="text-muted ml-auto toolbar-count">폴더 {FOLDERS.length} · 파일 51</span>
      </div>

      {/* 폴더 섹션 */}
      <div className="section-title"><IconFolder width={16} height={16} />폴더</div>
      <div className="folder-grid">
        {FOLDERS.map((f) => (
          <div className="folder-card" key={f.name} onClick={() => setFolder(f.name)}>
            <div className="folder-icon">{f.icon}</div>
            <div className="folder-name">{f.name}</div>
            <div className="folder-meta">파일 {f.count}개</div>
          </div>
        ))}
        <div className="folder-card new-folder" onClick={() => setFolderModal(true)}>
          <IconFolderPlus width={24} height={24} />
          <div className="new-label">새 폴더</div>
        </div>
      </div>

      {/* 파일 섹션 */}
      <div className="section-title"><IconDoc width={16} height={16} />미분류 파일</div>
      <div className="file-grid">
        {FILES.map((file) => (
          <div className="file-card" key={file.name} onClick={() => setViewer(file)}>
            <div className="file-thumb">{file.emoji}<span className="file-badge">{file.ext}</span></div>
            <div className="file-info">
              <div className="file-name">{file.name}</div>
              <div className="file-meta">{file.meta}</div>
            </div>
            {/* 액션 클릭은 카드 뷰어 열기로 전파되지 않도록 차단 */}
            <div className="file-actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="file-btn" onClick={() => setViewer(file)}><IconEye width={11} height={11} />보기</button>
              <button type="button" className="file-btn"><IconDownload width={11} height={11} />다운</button>
              <button type="button" className="file-btn"><IconFolder width={11} height={11} />이동</button>
              <button type="button" className="file-btn danger"><IconTrash width={11} height={11} />삭제</button>
            </div>
          </div>
        ))}
      </div>

      {/* 폴더 생성 모달 */}
      <Modal
        open={folderModal}
        onClose={() => setFolderModal(false)}
        title="새 폴더 생성"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setFolderModal(false)}>취소</button>
            <button type="button" className="btn btn-primary" onClick={createFolder}>생성</button>
          </>
        }
      >
        <label className="input-group">
          <span className="input-label">폴더 이름</span>
          <input type="text" className="input" placeholder="예: 보험 서류" value={folderName} onChange={(e) => setFolderName(e.target.value)} />
        </label>
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
    <div className="viewer-header">
      <span className="viewer-icon">{file.type === 'pdf' ? '📄' : '🖼️'}</span>
      <span className="viewer-filename">{file.name}</span>
      <div className="viewer-header-actions">
        {/* TODO: R2 presigned URL 다운로드 */}
        <button type="button" className="btn btn-ghost btn-sm"><IconDownload width={13} height={13} />다운로드</button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="닫기">
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
      className="viewer-modal"
      header={header}
      footer={
        <span className="viewer-meta">
          {file.type === 'pdf' ? 'PDF 문서 · 실제 구현 시 PDF.js 사용' : '이미지 · 실제 구현 시 R2 presigned URL 사용'}
        </span>
      }
    >
      <div className="viewer-content">
        {file.type === 'pdf' ? (
          // TODO: PDF.js 로 브라우저 내 렌더링
          <div className="viewer-mock">
            <IconDoc width={64} height={64} />
            <div className="viewer-mock-name">{file.name}</div>
            <div className="viewer-mock-desc">실제 구현 시 <strong>PDF.js</strong>로 브라우저 내 렌더링됩니다. 현재는 목업 상태입니다.</div>
          </div>
        ) : (
          // TODO: R2 presigned URL 로 이미지 로드
          <div className="viewer-mock">
            <div className="viewer-img-frame">
              <IconImage width={48} height={48} />
              <span className="viewer-meta">{file.name}</span>
            </div>
            <div className="viewer-mock-desc">실제 구현 시 Cloudflare R2 presigned URL로 이미지를 로드합니다.</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
