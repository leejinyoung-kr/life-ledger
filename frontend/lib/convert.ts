/**
 * 파일 변환 API 클라이언트 (stateless — 올림→변환→받음, 서버 저장 없음).
 * 백엔드 /convert 엔드포인트로 파일을 보내고 변환 결과 blob 을 바로 다운로드한다.
 */
import { api } from './api';

export type ImageFormat = 'png' | 'jpg';

// 허용 입력 형식
export const PDF_INPUT_ACCEPT = 'application/pdf,.pdf';
export const IMAGE_INPUT_ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png';

// 원본 파일명에서 확장자만 교체 (없으면 converted)
function rename(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'converted';
  return `${base}.${ext}`;
}

// 이미지(JPEG/PNG) → PDF 변환 후 다운로드
export function imageToPdf(file: File): Promise<void> {
  return api.uploadDownload('/convert/image-to-pdf', file, rename(file.name, 'pdf'));
}

// PDF → 이미지(format) 변환 후 다운로드. 여러 페이지면 서버가 ZIP 으로 묶어주므로 확장자도 zip 으로 받는다.
export function pdfToImage(file: File, format: ImageFormat): Promise<void> {
  // 응답이 단일 이미지인지 ZIP 인지는 페이지 수에 달려 미리 알 수 없다 → 파일명 확장자는 서버 Content-Disposition 을 신뢰하지 않고
  // 단순히 format 으로 두되, ZIP 일 때를 대비해 base 만 유지. (브라우저는 실제 mime 으로 저장)
  return api.uploadDownload(`/convert/pdf-to-image?format=${format}`, file, rename(file.name, format));
}
