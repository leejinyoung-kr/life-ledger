'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { IconClose, IconDownload, IconDoc, IconImage } from '@/components/icons';
import { fileExt, fmtFileDate, formatBytes, isImage, isPdf, type FileItem } from './shared';

// 파일 보기 창 — 이미지 / PDF 는 미리보기, 그 밖은 내려받기 안내
export default function ViewerModal({ file, onClose, onDownload, onDelete }: {
  file: FileItem | null;
  onClose: () => void;
  onDownload: (f: FileItem) => void;
  onDelete: (f: FileItem) => void;
}) {
  const [loadedPreview, setLoadedPreview] = useState<{ id: number; url: string } | null>(null);

  useEffect(() => {
    if (!file) return;
    if (!isImage(file.mimeType) && !isPdf(file.mimeType)) return;
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
  const image = isImage(file.mimeType);
  const pdf = isPdf(file.mimeType);
  const ext = fileExt(file.name);

  const header = (
    <div className="flex items-start gap-3 px-5 py-3.5 border-b border-border-subtle shrink-0">
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="[font-family:var(--font-display)] text-[1.25rem] font-semibold leading-tight text-primary truncate">{file.name}</span>
        <span className="text-[0.78rem] text-muted">{ext && `${ext} · `}{formatBytes(file.size)} · {fmtFileDate(file.createdAt)}</span>
      </div>
      <IconButton label="닫기" variant="bordered" size="lg" onClick={onClose}><IconClose width={16} height={16} /></IconButton>
    </div>
  );

  return (
    <Modal
      open={!!file}
      onClose={onClose}
      title={file.name}
      size="lg"
      header={header}
      footer={
        <>
          <Button variant="danger" className="mr-auto" onClick={() => onDelete(file)}>삭제</Button>
          <Button variant="ghost" onClick={onClose}>닫기</Button>
          <Button onClick={() => onDownload(file)}><IconDownload />다운로드</Button>
        </>
      }
    >
      <div className="bg-surface rounded-ui flex items-center justify-center min-h-75 overflow-hidden">
        {image ? (
          previewUrl ? (
            // 만료되는 presigned URL 이라 next/image 최적화 프록시 대신 unoptimized 로 직접 로드
            <div className="relative w-full h-[60vh]">
              <Image src={previewUrl} alt={file.name} fill unoptimized className="object-contain" />
            </div>
          ) : (
            <Placeholder icon={<IconImage width={40} height={40} />} text="불러오는 중…" />
          )
        ) : pdf ? (
          previewUrl ? (
            <iframe src={previewUrl} title={file.name} className="w-full h-[60vh] border-0" />
          ) : (
            <Placeholder icon={<IconDoc width={40} height={40} />} text="불러오는 중…" />
          )
        ) : (
          <div className="flex flex-col items-center gap-2.5 px-4 py-12 text-center">
            <IconDoc width={32} height={32} className="text-muted" />
            <span className="[font-family:var(--font-display)] text-[1.125rem] font-semibold text-primary">미리보기를 지원하지 않는 형식입니다</span>
            <span className="text-[0.8125rem] text-muted">내려받아서 여세요.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

// 미리보기를 기다리는 동안 보여 주는 자리
function Placeholder({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-muted">
      {icon}
      <span className="text-[0.78rem]">{text}</span>
    </div>
  );
}
