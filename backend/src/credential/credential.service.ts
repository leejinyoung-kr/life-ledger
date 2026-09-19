import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Credential, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { authenticator } from 'otplib';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '@leejinyoun/core-security';
import { cipherContext } from '../crypto/crypto-fields';
import { AccessLogService } from '../access-log/access-log.service';
import { parsePage } from '@leejinyoun/core-common';
import type { ClientInfo } from '@leejinyoun/core-logging';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { QueryCredentialDto } from './dto/query-credential.dto';
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
    private accessLog: AccessLogService,
  ) {}

  // 엔티티 → 목록 DTO. 비밀번호/TOTP 원문은 제외(reveal 로만), 2FA 설정 여부만 노출
  private toDto(c: Credential) {
    return {
      id: c.id,
      name: c.name,
      url: c.url,
      category: c.category,
      username: c.username,
      memo: c.memo,
      has2fa: !!c.totp_enc,
      hasBackupCodes: !!c.backup_codes_enc,
      passwordChangedAt: c.password_changed_at?.toISOString() ?? null,
      updatedAt: c.updated_at.toISOString(),
    };
  }

  // 계정 목록 (최근 수정순) — 검색어/카테고리 필터.
  // page 지정 시 서버 페이징 + no2fa(2FA 미설정 전체 건수, 페이지 무관) 동봉, 없으면 전체 배열.
  async findAll(userId: number, query: QueryCredentialDto = {}) {
    const where: Prisma.CredentialWhereInput = { user_id: userId, deleted_at: null };
    if (query.category) where.category = query.category;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q } },
        { url: { contains: query.q } },
        { username: { contains: query.q } },
      ];
    }
    const orderBy: Prisma.CredentialOrderByWithRelationInput = { updated_at: 'desc' };

    const pg = parsePage(query.page, query.limit);
    if (pg) {
      const [rows, total, no2fa] = await this.prisma.$transaction([
        this.prisma.credential.findMany({ where, orderBy, skip: pg.skip, take: pg.take }),
        this.prisma.credential.count({ where }),
        // no2fa 는 검색/필터와 무관한 전체 기준 (배너용)
        this.prisma.credential.count({ where: { user_id: userId, deleted_at: null, totp_enc: null } }),
      ]);
      return { items: rows.map((r) => this.toDto(r)), total, page: pg.page, limit: pg.limit, no2fa };
    }

    const rows = await this.prisma.credential.findMany({ where, orderBy });
    return rows.map((r) => this.toDto(r));
  }

  // 단일 계정 조회 (목록 DTO) — 딥링크 진입 시 사용
  async findOne(userId: number, id: number) {
    return this.toDto(await this.findOwned(userId, id));
  }

  // 계정 추가 (비밀번호·TOTP 암호화 저장). 비번 회전 기준일로 password_changed_at 기록
  async create(userId: number, dto: CreateCredentialDto) {
    const created = await this.prisma.credential.create({
      data: {
        user_id: userId,
        name: dto.name.trim(),
        url: dto.url || null,
        category: dto.category,
        username: dto.username.trim(),
        password_enc: this.crypto.encrypt(dto.password, cipherContext('credential.password_enc', userId)),
        totp_enc: this.crypto.encryptNullable(dto.totp, cipherContext('credential.totp_enc', userId)),
        password_changed_at: new Date(),
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

  // 비밀번호·TOTP 원문 복호화 (표시/복사 시 호출). 열람 사실을 감사 로그에 기록
  async reveal(userId: number, id: number, client?: ClientInfo) {
    const row = await this.findOwned(userId, id);
    await this.accessLog.log(userId, 'cred_reveal', { type: 'credential', id, name: row.name }, client);
    return {
      password: this.crypto.decrypt(row.password_enc, cipherContext('credential.password_enc', row.user_id)),
      totp: row.totp_enc ? this.crypto.decrypt(row.totp_enc, cipherContext('credential.totp_enc', row.user_id)) : null,
    };
  }

  // 저장된 TOTP 시크릿으로 현재 6자리 코드 생성 (otpauth:// URI 면 secret 파라미터 추출). 감사 로그 기록
  async totpCode(userId: number, id: number, client?: ClientInfo) {
    const row = await this.findOwned(userId, id);
    if (!row.totp_enc) throw new BadRequestException('2FA 시크릿이 없습니다.');
    await this.accessLog.log(userId, 'cred_totp', { type: 'credential', id, name: row.name }, client);
    let secret = this.crypto.decrypt(row.totp_enc, cipherContext('credential.totp_enc', row.user_id)).trim();
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

  // 계정 수정 (password/totp 가 오면 재암호화. totp 빈 문자열이면 해제). 비번 변경 시 회전 기준일 갱신
  async update(userId: number, id: number, dto: UpdateCredentialDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.credential.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        url: dto.url === undefined ? undefined : dto.url || null,
        category: dto.category,
        username: dto.username?.trim(),
        password_enc: dto.password ? this.crypto.encrypt(dto.password, cipherContext('credential.password_enc', userId)) : undefined,
        password_changed_at: dto.password ? new Date() : undefined,
        totp_enc: dto.totp === undefined ? undefined : this.crypto.encryptNullable(dto.totp, cipherContext('credential.totp_enc', userId)),
        memo: dto.memo === undefined ? undefined : dto.memo || null,
      },
    });
    return this.toDto(updated);
  }

  // 2FA 백업코드 생성 — 8자리 코드 N개를 만들어 JSON 배열로 암호화 저장. 평문은 이 응답에서만 1회 노출
  async generateBackupCodes(userId: number, id: number, count = 10, client?: ClientInfo) {
    const row = await this.findOwned(userId, id);
    const codes = Array.from({ length: count }, () =>
      randomBytes(4).toString('hex').toUpperCase().replace(/(.{4})(.{4})/, '$1-$2'),
    );
    await this.prisma.credential.update({
      where: { id },
      data: { backup_codes_enc: this.crypto.encrypt(JSON.stringify(codes), cipherContext('credential.backup_codes_enc', userId)) },
    });
    await this.accessLog.log(userId, 'backup_codes_generate', { type: 'credential', id, name: row.name }, client);
    return { name: row.name, codes };
  }

  // 저장된 2FA 백업코드 원문 조회 — 감사 로그 기록. 미설정 시 빈 배열
  async revealBackupCodes(userId: number, id: number, client?: ClientInfo) {
    const row = await this.findOwned(userId, id);
    if (!row.backup_codes_enc) return { codes: [] as string[] };
    await this.accessLog.log(userId, 'cred_backup', { type: 'credential', id, name: row.name }, client);
    return { codes: JSON.parse(this.crypto.decrypt(row.backup_codes_enc, cipherContext('credential.backup_codes_enc', row.user_id))) as string[] };
  }

  // 2FA 백업코드 삭제
  async clearBackupCodes(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.credential.update({ where: { id }, data: { backup_codes_enc: null } });
    return { id };
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
        password: this.crypto.decrypt(c.password_enc, cipherContext('credential.password_enc', c.user_id)),
        totp: c.totp_enc ? this.crypto.decrypt(c.totp_enc, cipherContext('credential.totp_enc', c.user_id)) : '',
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
        password_enc: this.crypto.encrypt(password, cipherContext('credential.password_enc', userId)),
        totp_enc: totp ? this.crypto.encrypt(totp, cipherContext('credential.totp_enc', userId)) : null,
        password_changed_at: new Date(),
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

  // 계정 일괄 삭제 (soft delete)
  async removeMany(userId: number, ids: number[]) {
    if (!ids.length) throw new BadRequestException('삭제할 항목이 없습니다.');
    const { count } = await this.prisma.credential.updateMany({
      where: { id: { in: ids }, user_id: userId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    return { count };
  }
}
