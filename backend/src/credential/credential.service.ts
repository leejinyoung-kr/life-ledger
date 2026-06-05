import { Injectable, NotFoundException } from '@nestjs/common';
import { Credential } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';

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

  // 계정 삭제 (soft delete)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.credential.update({ where: { id }, data: { deleted_at: new Date() } });
    return { id };
  }
}
