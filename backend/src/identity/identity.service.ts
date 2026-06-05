import { Injectable, NotFoundException } from '@nestjs/common';
import { IdentityCard } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { maskTail, toDateOrNull, toDateStr } from '../common/vault.util';
import { CreateIdentityDto } from './dto/create-identity.dto';
import { UpdateIdentityDto } from './dto/update-identity.dto';

@Injectable()
export class IdentityService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  // 엔티티 → 목록 DTO. 번호는 끝자리만 남긴 마스킹값으로 노출(원문은 reveal 로만)
  private toDto(c: IdentityCard) {
    return {
      id: c.id,
      type: c.type,
      name: c.name,
      numberMasked: maskTail(this.crypto.decrypt(c.number_enc), 2),
      issueDate: toDateStr(c.issue_date),
      expireDate: toDateStr(c.expire_date),
      memo: c.memo,
      updatedAt: c.updated_at.toISOString(),
    };
  }

  // 신원 문서 목록 (최근 수정순)
  async findAll(userId: number) {
    const rows = await this.prisma.identityCard.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { updated_at: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  // 신원 문서 추가 (번호 암호화 저장)
  async create(userId: number, dto: CreateIdentityDto) {
    const created = await this.prisma.identityCard.create({
      data: {
        user_id: userId,
        type: dto.type,
        name: dto.name.trim(),
        number_enc: this.crypto.encrypt(dto.number),
        issue_date: toDateOrNull(dto.issueDate),
        expire_date: toDateOrNull(dto.expireDate),
        memo: dto.memo || null,
      },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<IdentityCard> {
    const row = await this.prisma.identityCard.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('신원 문서를 찾을 수 없습니다.');
    return row;
  }

  // 번호 원문 복호화 (표시 토글 시 호출)
  async reveal(userId: number, id: number) {
    const row = await this.findOwned(userId, id);
    return { number: this.crypto.decrypt(row.number_enc) };
  }

  // 신원 문서 수정 (number 가 오면 재암호화)
  async update(userId: number, id: number, dto: UpdateIdentityDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.identityCard.update({
      where: { id },
      data: {
        type: dto.type,
        name: dto.name?.trim(),
        number_enc: dto.number ? this.crypto.encrypt(dto.number) : undefined,
        issue_date: dto.issueDate === undefined ? undefined : toDateOrNull(dto.issueDate),
        expire_date: dto.expireDate === undefined ? undefined : toDateOrNull(dto.expireDate),
        memo: dto.memo === undefined ? undefined : dto.memo || null,
      },
    });
    return this.toDto(updated);
  }

  // 신원 문서 삭제 (soft delete)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.identityCard.update({ where: { id }, data: { deleted_at: new Date() } });
    return { id };
  }
}
