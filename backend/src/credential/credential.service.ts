import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Credential, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { authenticator } from 'otplib';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';

// 엑셀 내보내기/양식 공통 컬럼
const EXPORT_COLUMNS: { header: string; key: string; width: number }[] = [
  { header: '서비스명', key: 'name', width: 20 },
  { header: 'URL', key: 'url', width: 24 },
  { header: '카테고리', key: 'category', width: 12 },
  { header: '아이디', key: 'username', width: 24 },
  { header: '비밀번호', key: 'password', width: 20 },
  { header: '2FA', key: 'totp', width: 20 },
  { header: '메모', key: 'memo', width: 24 },
];
const REQUIRED_HEADERS = ['서비스명', '카테고리', '아이디', '비밀번호'];

// 헤더 라벨 정규화 ('서비스명*' → '서비스명')
function normalizeHeader(s: string): string {
  return s.replace(/\*/g, '').trim();
}

// 엑셀 업로드 결과 요약
export interface ImportResult {
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
}

@Injectable()
export class CredentialService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  // 엔티티 → 목록 DTO. 비밀번호/TOTP 원문은 제외(reveal 로만), 2FA 설정 여부만 노출
  private toDto(c: Credential) {
    return {
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      url: c.url,
      category: c.category,
      username: c.username,
      memo: c.memo,
      has2fa: !!c.totp_enc,
      updatedAt: c.updated_at.toISOString(),
    };
  }

  // 계정 목록 (최근 수정순)
  async findAll(userId: number) {
    const rows = await this.prisma.credential.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { updated_at: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  // 계정 추가 (비밀번호·TOTP 암호화 저장)
  async create(userId: number, dto: CreateCredentialDto) {
    const created = await this.prisma.credential.create({
      data: {
        user_id: userId,
        name: dto.name.trim(),
        emoji: dto.emoji || null,
        url: dto.url || null,
        category: dto.category,
        username: dto.username.trim(),
        password_enc: this.crypto.encrypt(dto.password),
        totp_enc: this.crypto.encryptNullable(dto.totp),
        memo: dto.memo || null,
      },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<Credential> {
    const row = await this.prisma.credential.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('계정을 찾을 수 없습니다.');
    return row;
  }

  // 비밀번호·TOTP 원문 복호화 (표시/복사 시 호출)
  async reveal(userId: number, id: number) {
    const row = await this.findOwned(userId, id);
    return {
      password: this.crypto.decrypt(row.password_enc),
      totp: row.totp_enc ? this.crypto.decrypt(row.totp_enc) : null,
    };
  }

  // 저장된 TOTP 시크릿으로 현재 6자리 코드 생성 (otpauth:// URI 면 secret 파라미터 추출)
  async totpCode(userId: number, id: number) {
    const row = await this.findOwned(userId, id);
    if (!row.totp_enc) throw new BadRequestException('2FA 시크릿이 없습니다.');
    let secret = this.crypto.decrypt(row.totp_enc).trim();
    if (secret.startsWith('otpauth://')) {
      const m = /[?&]secret=([^&]+)/i.exec(secret);
      if (m) secret = decodeURIComponent(m[1]);
    }
    secret = secret.replace(/\s/g, '').toUpperCase();
    try {
      return {
        code: authenticator.generate(secret),
        period: 30,
        remaining: authenticator.timeRemaining(),
      };
    } catch {
      throw new BadRequestException('유효하지 않은 2FA 시크릿입니다.');
    }
  }

  // 계정 수정 (password/totp 가 오면 재암호화. totp 빈 문자열이면 해제)
  async update(userId: number, id: number, dto: UpdateCredentialDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.credential.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        emoji: dto.emoji === undefined ? undefined : dto.emoji || null,
        url: dto.url === undefined ? undefined : dto.url || null,
        category: dto.category,
        username: dto.username?.trim(),
        password_enc: dto.password ? this.crypto.encrypt(dto.password) : undefined,
        totp_enc: dto.totp === undefined ? undefined : this.crypto.encryptNullable(dto.totp),
        memo: dto.memo === undefined ? undefined : dto.memo || null,
      },
    });
    return this.toDto(updated);
  }

  // 빈 양식 엑셀(.xlsx) 버퍼 — 헤더(필수*)만 포함
  async templateExcel(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('계정');
    ws.columns = EXPORT_COLUMNS.map((c) => ({
      header: REQUIRED_HEADERS.includes(c.header) ? `${c.header}*` : c.header,
      key: c.key,
      width: c.width,
    }));
    ws.getRow(1).font = { bold: true };
    return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  }

  // 계정 데이터 엑셀(.xlsx) 내보내기 — 비밀번호/TOTP 는 복호화한 평문으로 출력(사용자 본인 백업).
  async exportExcel(userId: number): Promise<Buffer> {
    const rows = await this.prisma.credential.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { id: 'asc' },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('계정');
    ws.columns = EXPORT_COLUMNS;
    ws.getRow(1).font = { bold: true };
    for (const c of rows) {
      ws.addRow({
        name: c.name,
        url: c.url ?? '',
        category: c.category,
        username: c.username,
        password: this.crypto.decrypt(c.password_enc),
        totp: c.totp_enc ? this.crypto.decrypt(c.totp_enc) : '',
        memo: c.memo ?? '',
      });
    }
    return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  }

  // 엑셀 양식 업로드 → 행별 검증 후 일괄 추가 (비밀번호/TOTP 암호화 저장)
  async importExcel(userId: number, buffer: Buffer): Promise<ImportResult> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new BadRequestException('엑셀 파일을 읽을 수 없습니다.');
    }
    const ws = wb.getWorksheet('계정') ?? wb.worksheets[0];
    if (!ws) throw new BadRequestException('시트를 찾을 수 없습니다.');

    const colOf: Record<string, number> = {};
    ws.getRow(1).eachCell((cell, col) => {
      const key = normalizeHeader(String(cell.text ?? ''));
      if (key) colOf[key] = col;
    });
    const missing = REQUIRED_HEADERS.filter((h) => !colOf[h]);
    if (missing.length) throw new BadRequestException(`양식 헤더 누락: ${missing.join(', ')}`);

    const cell = (row: ExcelJS.Row, h: string) =>
      colOf[h] ? String(row.getCell(colOf[h]).text ?? '').trim() : '';

    const valid: Prisma.CredentialCreateManyInput[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const name = cell(row, '서비스명');
      const category = cell(row, '카테고리');
      const username = cell(row, '아이디');
      const password = cell(row, '비밀번호');
      if (!name && !category && !username && !password) continue; // 빈 행

      const bad: string[] = [];
      if (!name) bad.push('서비스명');
      if (!category) bad.push('카테고리');
      if (!username) bad.push('아이디');
      if (!password) bad.push('비밀번호');
      if (bad.length) { errors.push({ row: r, message: `${bad.join(', ')} 값 오류` }); continue; }

      const totp = cell(row, '2FA');
      valid.push({
        user_id: userId,
        name,
        url: cell(row, 'URL') || null,
        category,
        username,
        password_enc: this.crypto.encrypt(password),
        totp_enc: totp ? this.crypto.encrypt(totp) : null,
        memo: cell(row, '메모') || null,
      });
    }

    const CHUNK = 1000;
    for (let i = 0; i < valid.length; i += CHUNK) {
      await this.prisma.credential.createMany({ data: valid.slice(i, i + CHUNK) });
    }
    return { imported: valid.length, failed: errors.length, errors };
  }

  // 계정 삭제 (soft delete)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.credential.update({ where: { id }, data: { deleted_at: new Date() } });
    return { id };
  }
}
