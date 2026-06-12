import {
  Controller,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConvertService, type ImageFormat } from './convert.service';

@ApiTags('파일 변환')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
// 변환은 CPU/메모리 부담이 커 분당 20회로 제한
@Throttle({ default: { limit: 20, ttl: 60000 } })
@Controller('convert')
export class ConvertController {
  constructor(private readonly service: ConvertService) {}

  // 이미지(JPEG/PNG) 업로드 → PDF 다운로드
  @Post('image-to-pdf')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async imageToPdf(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.service.imageToPdf(file);
    this.send(res, pdf, 'application/pdf', this.rename(file.originalname, 'pdf'));
  }

  // PDF 업로드 → 이미지 다운로드 (format=png|jpg, 기본 png. 여러 페이지면 ZIP)
  @Post('pdf-to-image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async pdfToImage(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
    @Query('format') format?: string,
  ): Promise<void> {
    const fmt: ImageFormat = format === 'jpg' ? 'jpg' : 'png';
    const out = await this.service.pdfToImages(file, fmt);
    this.send(res, out.buffer, out.mime, this.rename(file.originalname, out.ext));
  }

  // 원본 파일명 확장자만 교체 (한글 파일명은 multer latin1 디코딩이라 utf8 로 재해석)
  private rename(original: string, ext: string): string {
    const name = Buffer.from(original ?? 'file', 'latin1').toString('utf8');
    const base = name.replace(/\.[^.]+$/, '') || 'converted';
    return `${base}.${ext}`;
  }

  // attachment 응답 — ASCII fallback 파일명 + RFC 5987 UTF-8 파일명 병행
  private send(res: Response, buf: Buffer, mime: string, filename: string): void {
    const encoded = encodeURIComponent(filename);
    res.set({
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="converted"; filename*=UTF-8''${encoded}`,
    });
    res.end(buf);
  }
}
