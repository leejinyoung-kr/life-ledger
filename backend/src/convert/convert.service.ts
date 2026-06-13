import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import AdmZip from 'adm-zip';
import sharp from 'sharp';

export type ImageFormat = 'png' | 'jpg';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

// pdf-to-img 는 ESM 전용 패키지라 CommonJS(swc) 빌드에서 정적 import 가 불가하다.
// new Function 으로 감싸면 swc/tsc 가 import() 를 require 로 변환하지 못해 런타임에 진짜 ESM 동적 import 가 실행된다.
const esmImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;

function startsWithBytes(buf: Buffer, sig: number[]): boolean {
  return buf.length >= sig.length && sig.every((b, i) => buf[i] === b);
}

@Injectable()
export class ConvertService {
  // 이미지(JPEG/PNG) → 단일 PDF. 이미지 원본 픽셀 크기에 맞춘 1페이지를 만들어 화질 손실 없이 삽입
  async imageToPdf(file: Express.Multer.File): Promise<Buffer> {
    const buf = file.buffer;
    this.checkSize(buf);
    const isJpeg = startsWithBytes(buf, [0xff, 0xd8, 0xff]);
    const isPng = startsWithBytes(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!isJpeg && !isPng)
      throw new BadRequestException('JPEG 또는 PNG 이미지만 변환할 수 있습니다.');

    try {
      const doc = await PDFDocument.create();
      const img = isJpeg ? await doc.embedJpg(buf) : await doc.embedPng(buf);
      const page = doc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      return Buffer.from(await doc.save());
    } catch {
      throw new BadRequestException('지원하지 않는 파일 형식이거나 손상된 파일입니다.');
    }
  }

  // PDF → 페이지별 이미지(PNG/JPG 선택). 1페이지면 이미지 단일 파일, 여러 페이지면 ZIP 으로 묶어 반환
  async pdfToImages(
    file: Express.Multer.File,
    format: ImageFormat = 'png',
  ): Promise<{ buffer: Buffer; mime: string; ext: string }> {
    const buf = file.buffer;
    this.checkSize(buf);
    if (!startsWithBytes(buf, [0x25, 0x50, 0x44, 0x46]))
      throw new BadRequestException('PDF 파일만 변환할 수 있습니다.');

    let pages: Buffer[];
    try {
      const { pdf } = await esmImport('pdf-to-img');
      const document = await pdf(buf, { scale: 2 });

      // pdf-to-img 는 PNG 만 출력 → jpg 선택 시 sharp 로 변환(흰 배경 합성: PDF 투명영역이 검게 나오는 것 방지)
      pages = [];
      for await (const image of document) {
        const png = image as Buffer;
        pages.push(
          format === 'jpg'
            ? await sharp(png).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer()
            : png,
        );
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('지원하지 않는 파일 형식이거나 손상된 파일입니다.');
    }
    if (pages.length === 0)
      throw new BadRequestException('변환할 페이지가 없습니다.');

    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    if (pages.length === 1)
      return { buffer: pages[0], mime, ext: format };

    const zip = new AdmZip();
    pages.forEach((p, i) => zip.addFile(`page-${String(i + 1).padStart(3, '0')}.${format}`, p));
    return { buffer: zip.toBuffer(), mime: 'application/zip', ext: 'zip' };
  }

  private checkSize(buf: Buffer): void {
    if (buf.length > MAX_FILE_SIZE)
      throw new BadRequestException('파일 크기는 50MB를 초과할 수 없습니다.');
  }
}
