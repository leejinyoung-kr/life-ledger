'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { IconClose, IconDownload, IconDoc, IconImage } from '@/components/icons';
import { useApiQuery } from '@/lib/query';
import { useLastValue } from '@/lib/useLastValue';
import { fileExt, fmtFileDate, formatBytes, isImage, isPdf, isText, type FileItem } from './shared';

// 파일 보기 창 — 이미지 / PDF / 글자 파일(TXT · MD · CSV · JSON …)은 미리보기, 그 밖은 내려받기 안내
export default function ViewerModal({ file: current, onClose, onDownload, onDelete }: {
  file: FileItem | null;
  onClose: () => void;
  onDownload: (f: FileItem) => void;
  onDelete: (f: FileItem) => void;
}) {
  // 닫혀도(current → null) 흐려지는 동안 마지막 파일을 그린다 — 미리보기도 그대로 둔다
  const file = useLastValue(current);
  const [loadedPreview, setLoadedPreview] = useState<{ id: number; url: string } | null>(null);
  // 글자 파일은 서버가 앞부분(최대 512KB)을 글자로 돌려준다 — B2 를 직접 읽으면 CORS · 인코딩 문제가 있어서
  const textMode = !!file && isText(file.mimeType, file.name);
  const textQuery = useApiQuery<{ text: string; truncated: boolean }>(['file-text', file?.id], `/files/${file?.id}/text`, {
    enabled: textMode,
    staleTime: 60 * 1000,
    retry: false,
  });

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
        <span className="text-[1.25rem] font-bold leading-tight text-primary truncate">{file.name}</span>
        <span className="text-[0.78rem] text-muted">{ext && `${ext} · `}{formatBytes(file.size)} · {fmtFileDate(file.createdAt)}</span>
      </div>
      <IconButton label="닫기" variant="bordered" size="lg" onClick={onClose}><IconClose width={16} height={16} /></IconButton>
    </div>
  );

  return (
    <Modal
      open={!!current}
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
        ) : textMode ? (
          textQuery.data ? (
            <div className="w-full self-stretch flex flex-col">
              <pre className="w-full max-h-[60vh] overflow-auto m-0 p-4 text-left text-[0.8125rem] leading-relaxed text-primary font-mono whitespace-pre-wrap wrap-break-word">{textQuery.data.text || '(빈 파일)'}</pre>
              {textQuery.data.truncated && (
                <span className="px-4 py-2 border-t border-border-subtle text-[0.75rem] text-muted">앞부분 512KB 만 보입니다. 전체는 내려받아서 여세요.</span>
              )}
            </div>
          ) : textQuery.isError ? (
            <Placeholder icon={<IconDoc width={40} height={40} />} text="내용을 불러오지 못했습니다. 내려받아서 여세요." />
          ) : (
            <Placeholder icon={<IconDoc width={40} height={40} />} text="불러오는 중…" />
          )
        ) : (
          <div className="flex flex-col items-center gap-2.5 px-4 py-12 text-center">
            <IconDoc width={32} height={32} className="text-muted" />
            <span className="text-[1.125rem] font-bold text-primary">미리보기를 지원하지 않는 형식입니다</span>
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
