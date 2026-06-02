import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoryDomain } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// 도메인별 기본 카테고리 시드 데이터
const SEED: Record<CategoryDomain, { code: string; label: string }[]> = {
  transaction: [
    { code: 'food', label: '식비' },
    { code: 'transport', label: '교통' },
    { code: 'subscription', label: '구독' },
    { code: 'shopping', label: '쇼핑' },
    { code: 'medical', label: '의료' },
    { code: 'leisure', label: '여가' },
    { code: 'education', label: '교육' },
    { code: 'utility', label: '공과금' },
    { code: 'salary', label: '급여' },
    { code: 'freelance', label: '부수입' },
    { code: 'transfer', label: '이체' },
    { code: 'etc', label: '기타' },
  ],
  subscription: [
    { code: 'ott', label: 'OTT' },
    { code: 'music', label: '음악' },
    { code: 'software', label: '소프트웨어' },
    { code: 'game', label: '게임' },
    { code: 'cloud', label: '클라우드' },
    { code: 'news', label: '뉴스/매거진' },
    { code: 'fitness', label: '피트니스' },
    { code: 'etc', label: '기타' },
  ],
  asset: [
    { code: 'cash', label: '현금성' },
    { code: 'savings', label: '예적금' },
    { code: 'investment', label: '투자' },
    { code: 'realestate', label: '부동산' },
    { code: 'debt', label: '부채' },
    { code: 'etc', label: '기타' },
  ],
  investment: [
    { code: 'domestic_stock', label: '국내주식' },
    { code: 'foreign_stock', label: '해외주식' },
    { code: 'domestic_etf', label: '국내ETF' },
    { code: 'foreign_etf', label: '해외ETF' },
    { code: 'crypto', label: '가상자산' },
    { code: 'etc', label: '기타' },
  ],
  saving: [
    { code: 'savings', label: '적금' },
    { code: 'deposit', label: '예금' },
    { code: 'subscription', label: '청약' },
    { code: 'etc', label: '기타' },
  ],
  pay_method: [
    { code: 'shinhan_card',  label: '신한카드' },
    { code: 'hyundai_card',  label: '현대카드' },
    { code: 'kb_card',       label: 'KB카드' },
    { code: 'samsung_card',  label: '삼성카드' },
    { code: 'kakao_pay',     label: '카카오페이' },
    { code: 'naver_pay',     label: '네이버페이' },
    { code: 'toss',          label: '토스' },
    { code: 'bank_transfer', label: '계좌이체' },
    { code: 'debit_card',    label: '체크카드' },
    { code: 'cash',          label: '현금' },
    { code: 'foreign',       label: '해외결제' },
  ],
  credential_cat: [
    { code: 'dev',      label: '개발' },
    { code: 'finance',  label: '금융' },
    { code: 'social',   label: '소셜' },
    { code: 'shopping', label: '쇼핑' },
    { code: 'sub',      label: '구독' },
    { code: 'work',     label: '업무' },
    { code: 'etc',      label: '기타' },
  ],
  id_type: [
    { code: 'passport',    label: '여권' },
    { code: 'resident_id', label: '주민등록증' },
    { code: 'driver',      label: '운전면허' },
    { code: 'cert',        label: '자격증' },
    { code: 'etc',         label: '기타' },
  ],
  env_group: [
    { code: 'database', label: 'Database' },
    { code: 'auth',     label: 'Auth' },
    { code: 'storage',  label: 'Storage' },
    { code: 'api_keys', label: 'API Keys' },
    { code: 'app',      label: 'App' },
    { code: 'etc',      label: '기타' },
  ],
};

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  private toDto(c: { id: number; domain: string; code: string; label: string; sort_order: number; is_active: boolean }) {
    return {
      id: c.id,
      domain: c.domain,
      code: c.code,
      label: c.label,
      sortOrder: c.sort_order,
      isActive: c.is_active,
    };
  }

  // 도메인별 카테고리 조회 (is_active 포함 전체 반환, 정렬: sort_order → id)
  async findAll(userId: number, domain?: CategoryDomain) {
    const where = domain ? { user_id: userId, domain } : { user_id: userId };
    const rows = await this.prisma.category.findMany({
      where,
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  // 카테고리 추가
  async create(userId: number, dto: CreateCategoryDto) {
    // 같은 도메인+code 중복 방지
    const exist = await this.prisma.category.findUnique({
      where: { user_id_domain_code: { user_id: userId, domain: dto.domain, code: dto.code } },
    });
    if (exist) throw new ConflictException('이미 존재하는 코드입니다.');

    const maxOrder = await this.prisma.category.aggregate({
      where: { user_id: userId, domain: dto.domain },
      _max: { sort_order: true },
    });
    // sort_order는 1부터 시작 (moneymate 컨벤션)
    const nextOrder = (maxOrder._max.sort_order ?? 0) + 1;

    const created = await this.prisma.category.create({
      data: {
        user_id: userId,
        domain: dto.domain,
        code: dto.code,
        label: dto.label,
        sort_order: dto.sortOrder ?? nextOrder,
      },
    });
    return this.toDto(created);
  }

  // 카테고리 수정 (라벨·정렬순서·활성 여부)
  async update(userId: number, id: number, dto: UpdateCategoryDto) {
    const row = await this.prisma.category.findFirst({ where: { id, user_id: userId } });
    if (!row) throw new NotFoundException('카테고리를 찾을 수 없습니다.');

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.sortOrder !== undefined && { sort_order: dto.sortOrder }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
      },
    });
    return this.toDto(updated);
  }

  // 카테고리 삭제
  async remove(userId: number, id: number) {
    const row = await this.prisma.category.findFirst({ where: { id, user_id: userId } });
    if (!row) throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    await this.prisma.category.delete({ where: { id } });
    return { id };
  }

  // 기본 카테고리 시드 (도메인 미지정 시 전체 도메인)
  async seed(userId: number, domain?: CategoryDomain) {
    const domains = domain ? [domain] : Object.keys(SEED) as CategoryDomain[];
    const results: { domain: string; created: number }[] = [];

    for (const d of domains) {
      let created = 0;
      for (let i = 0; i < SEED[d].length; i++) {
        const { code, label } = SEED[d][i];
        try {
          await this.prisma.category.upsert({
            where: { user_id_domain_code: { user_id: userId, domain: d, code } },
            update: {},
            create: { user_id: userId, domain: d, code, label, sort_order: i },
          });
          created++;
        } catch { /* skip duplicates */ }
      }
      results.push({ domain: d, created });
    }
    return results;
  }
}
