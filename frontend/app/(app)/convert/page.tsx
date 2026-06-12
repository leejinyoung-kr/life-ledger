'use client';

/**
 * 파일 변환 페이지 (독립 도구).
 * 방향 선택(이미지→PDF / PDF→이미지) + 파일 선택(드롭/클릭) 후 변환하면 결과를 바로 다운로드한다.
 * stateless — 서버(B2/DB)에 저장하지 않고 변환 결과만 응답받아 받는다.
 * PDF→이미지는 출력 포맷(PNG/JPG)을 고를 수 있고, 여러 페이지면 ZIP 으로 묶여 내려온다.
 */
import { useEffect, useRef, useState, type DragEvent } from 'react';
import Image from 'next/image';
import AppShell from '@/components/AppShell';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { IconImage, IconFileBlank, IconUpload, IconClose } from '@/components/icons';
import { notify } from '@/lib/toast';
import {
  imageToPdf,
  pdfToImage,
  IMAGE_INPUT_ACCEPT,
  PDF_INPUT_ACCEPT,
  type ImageFormat,
} from '@/lib/convert';

type Direction = 'image-to-pdf' | 'pdf-to-image';

const MAX_SIZE = 50 * 1024 * 1024;

// 바이트 → 사람이 읽는 크기
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ConvertPage() {
  const [dir, setDir] = useState<Direction>('image-to-pdf');
  const [format, setFormat] = useState<ImageFormat>('png');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const accept = dir === 'image-to-pdf' ? IMAGE_INPUT_ACCEPT : PDF_INPUT_ACCEPT;

  // 선택 파일 미리보기(이미지/PDF 공통) — 파일 변경마다 이전 URL 해제
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // 방향 전환 — 선택 파일은 형식이 안 맞으므로 초기화
  const switchDir = (next: Direction) => {
    if (next === dir) return;
    setDir(next);
    setFile(null);
  };

  // 파일 선택 검증 — 크기·형식 확인 후 상태 반영
  const pickFile = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_SIZE) {
      notify.error('파일 크기는 50MB를 초과할 수 없습니다.');
      return;
    }
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    const isImg = /^image\/(jpeg|png)$/.test(f.type) || /\.(jpe?g|png)$/i.test(f.name);
    if (dir === 'image-to-pdf' && !isImg) {
      notify.error('JPEG 또는 PNG 이미지를 선택하세요.');
      return;
    }
    if (dir === 'pdf-to-image' && !isPdf) {
      notify.error('PDF 파일을 선택하세요.');
      return;
    }
    setFile(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  };

  // 변환 실행 — 성공 시 결과 다운로드, 파일 상태는 유지(연속 변환 대비)
  const run = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      if (dir === 'image-to-pdf') {
        await imageToPdf(file);
      } else {
        await pdfToImage(file, format);
      }
      notify.success('변환 완료 — 다운로드를 확인하세요.');
    } catch (e) {
      notify.error(e instanceof Error ? e.message : '변환에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell activePath="/convert" topbarLabel="파일 변환">
      <div className="mb-7">
        <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">파일 변환</h1>
        <p className="text-sm text-secondary mt-1.5">이미지와 PDF를 서로 변환합니다. 파일은 변환에만 쓰이고 서버에 저장되지 않습니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>변환할 파일</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            {/* 방향 선택 */}
            <div className="grid grid-cols-2 gap-2">
              <DirCard
                active={dir === 'image-to-pdf'}
                onClick={() => switchDir('image-to-pdf')}
                icon={<IconImage />}
                title="이미지 → PDF"
                desc="JPEG · PNG → PDF"
              />
              <DirCard
                active={dir === 'pdf-to-image'}
                onClick={() => switchDir('pdf-to-image')}
                icon={<IconFileBlank />}
                title="PDF → 이미지"
                desc="PDF → PNG · JPG"
              />
            </div>

            {/* PDF→이미지 출력 포맷 선택 */}
            {dir === 'pdf-to-image' && (
              <div className="flex items-center gap-3">
                <span className="text-[0.85rem] font-medium text-secondary">출력 형식</span>
                <div className="flex gap-2">
                  {(['png', 'jpg'] as ImageFormat[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`px-3 py-1.5 rounded-[var(--radius)] text-[0.82rem] font-semibold border transition-colors ${
                        format === f
                          ? 'bg-accent-dim text-accent border-accent'
                          : 'bg-transparent text-secondary border-border hover:bg-surface hover:text-primary'
                      }`}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 드롭존 / 파일 선택 */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center gap-3 px-6 py-14 rounded-[var(--radius)] border-2 border-dashed cursor-pointer transition-colors text-center ${
                dragging ? 'border-accent bg-accent-dim' : 'border-border hover:border-accent hover:bg-surface'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
              />
              <div className="[&_svg]:w-8 [&_svg]:h-8 text-muted"><IconUpload /></div>
              <div className="text-[0.88rem] text-secondary">
                <span className="text-accent font-semibold">클릭</span> 또는 드래그하여 파일 선택
              </div>
              <div className="text-[0.75rem] text-muted">
                {dir === 'image-to-pdf' ? 'JPEG · PNG' : 'PDF'} · 최대 50MB
              </div>
            </div>

            {/* 선택된 파일 */}
            {file && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius)] border border-border bg-surface">
                <div className="[&_svg]:w-5 [&_svg]:h-5 text-accent shrink-0">
                  {dir === 'image-to-pdf' ? <IconImage /> : <IconFileBlank />}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-[0.85rem] font-medium text-primary truncate">{file.name}</div>
                  <div className="text-[0.72rem] text-muted">{humanSize(file.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)] text-muted hover:bg-danger-dim hover:text-danger [&_svg]:w-4 [&_svg]:h-4 shrink-0"
                  aria-label="파일 제거"
                >
                  <IconClose />
                </button>
              </div>
            )}

            {/* 실행 */}
            <Button onClick={run} disabled={!file || busy} className="w-full">
              {busy ? '변환 중…' : '변환하기'}
            </Button>
          </CardBody>
        </Card>

        {/* 미리보기 */}
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>미리보기</CardTitle>
          </CardHeader>
          <CardBody>
            {!file || !previewUrl ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted">
                <div className="[&_svg]:w-9 [&_svg]:h-9">
                  {dir === 'image-to-pdf' ? <IconImage /> : <IconFileBlank />}
                </div>
                <div className="text-[0.85rem]">파일을 선택하면 미리보기가 표시됩니다.</div>
              </div>
            ) : dir === 'image-to-pdf' ? (
              <div className="relative w-full h-[70vh] min-h-[360px] rounded-[var(--radius)] overflow-hidden bg-elevated">
                <Image src={previewUrl} alt={file.name} fill unoptimized className="object-contain" />
              </div>
            ) : (
              <iframe src={previewUrl} title={file.name} className="w-full h-[70vh] min-h-[360px] rounded-[var(--radius)] border border-border" />
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

// 방향 선택 카드
function DirCard({
  active, onClick, icon, title, desc,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1.5 px-4 py-3.5 rounded-[var(--radius)] border text-left transition-colors ${
        active ? 'bg-accent-dim border-accent' : 'bg-transparent border-border hover:bg-surface'
      }`}
    >
      <div className={`[&_svg]:w-5 [&_svg]:h-5 ${active ? 'text-accent' : 'text-secondary'}`}>{icon}</div>
      <div className={`text-[0.9rem] font-semibold ${active ? 'text-accent' : 'text-primary'}`}>{title}</div>
      <div className="text-[0.74rem] text-muted">{desc}</div>
    </button>
  );
}
