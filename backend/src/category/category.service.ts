import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoryDomain } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// 가계부 2계층 트리 (대분류→소분류) — 코드페이지 기본값 복원·시드에서 공용
const TX_TREE: { code: string; label: string; children: [string, string][] }[] = [
  { code: 'food',      label: '식비',     children: [['food_grocery', '식료품'], ['food_dining', '외식'], ['food_cafe', '카페·간식'], ['food_etc', '기타(식비)']] },
  { code: 'beauty',    label: '꾸밈비',   children: [['beauty_clothing', '의류·잡화'], ['beauty_cosmetic', '화장품'], ['beauty_hair', '미용'], ['beauty_etc', '기타(꾸밈비)']] },
  { code: 'living',    label: '생활비',   children: [['living_daily', '생필품'], ['living_appliance', '가구·가전'], ['living_housing', '주거관련'], ['living_etc', '기타(생활비)']] },
  { code: 'insurance', label: '보험·통신', children: [['insurance_telecom', '통신비'], ['insurance_premium', '보험'], ['insurance_subscription', '구독·정기결제'], ['insurance_etc', '기타(보험·통신)']] },
  { code: 'car',       label: '차량유지', children: [['car_fuel', '유류비'], ['car_maintenance', '정비·수리'], ['car_etc', '기타(차량)']] },
  { code: 'transport', label: '교통비',   children: [['transport_transit', '대중교통'], ['transport_taxi', '택시'], ['transport_intercity', '시외·항공'], ['transport_etc', '기타(교통)']] },
  { code: 'leisure',   label: '여가생활', children: [['leisure_travel', '여행'], ['leisure_culture', '영화·공연'], ['leisure_exercise', '운동'], ['leisure_etc', '기타(여가)']] },
  { code: 'health',    label: '건강',     children: [['health_hospital', '병원'], ['health_pharmacy', '약국'], ['health_supplement', '건강보조제'], ['health_etc', '기타(건강)']] },
  { code: 'selfdev',   label: '자기계발', children: [['selfdev_book', '도서'], ['selfdev_edu', '교육·강의'], ['selfdev_etc', '기타(자기계발)']] },
  { code: 'event',     label: '경조사',   children: [['event_condolence', '부조'], ['event_gift', '선물'], ['event_gathering', '모임·회비'], ['event_etc', '기타(경조사)']] },
  { code: 'etc',       label: '기타',     children: [['etc_interest', '이자'], ['etc_fee', '수수료'], ['etc_tax', '세금'], ['etc_rentfee', '임대관리비'], ['etc_etc', '기타']] },
  { code: 'income',    label: '수입',     children: [['income_salary', '급여'], ['income_side', '부수입'], ['income_financial', '금융수입'], ['income_etc', '기타수입']] },
  { code: 'transfer',  label: '이체',     children: [['transfer_move', '저축·계좌이체']] },
];

// TX_TREE → flat 시드 행 (대분류 + 소분류, 트리 순서)
const TX_SEED: { code: string; label: string; parent?: string }[] = TX_TREE.flatMap((p) => [
  { code: p.code, label: p.label },
  ...p.children.map(([code, label]) => ({ code, label, parent: p.code })),
]);

// 도메인별 기본 카테고리 시드 데이터
const SEED: Record<CategoryDomain, { code: string; label: string; parent?: string }[]> = {
  transaction: TX_SEED,
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
  bank: [
    { code: 'hana',       label: '하나은행' },
    { code: 'shinhan',    label: '신한은행' },
    { code: 'kb',         label: 'KB국민은행' },
    { code: 'woori',      label: '우리은행' },
    { code: 'ibk',        label: 'IBK기업은행' },
    { code: 'nh',         label: 'NH농협은행' },
    { code: 'sc',         label: 'SC제일은행' },
    { code: 'citi',       label: '한국씨티은행' },
    { code: 'kdb',        label: 'KDB산업은행' },
    { code: 'suhyup',     label: 'Sh수협은행' },
    { code: 'im',         label: 'iM뱅크' },
    { code: 'busan',      label: 'BNK부산은행' },
    { code: 'gyeongnam',  label: 'BNK경남은행' },
    { code: 'gwangju',    label: '광주은행' },
    { code: 'jeonbuk',    label: '전북은행' },
    { code: 'jeju',       label: '제주은행' },
    { code: 'kakaobank',  label: '카카오뱅크' },
    { code: 'tossbank',   label: '토스뱅크' },
    { code: 'kbank',      label: '케이뱅크' },
    { code: 'post',       label: '우체국예금' },
    { code: 'saemaul',    label: '새마을금고' },
    { code: 'shinhyup',   label: '신협' },
    { code: 'etc',        label: '기타' },
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
};

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  private toDto(c: { id: number; domain: string; code: string; label: string; parent_code: string | null; sort_order: number; is_active: boolean }) {
    return {
      id: c.id,
      domain: c.domain,
      code: c.code,
      label: c.label,
      parentCode: c.parent_code,
      sortOrder: c.sort_order,
      isActive: c.is_active,
    };
  }

  // 도메인별 카테고리 조회 (전역 공용, is_active 포함 전체 반환, 정렬: sort_order → id)
  async findAll(domain?: CategoryDomain) {
    const rows = await this.prisma.category.findMany({
      where: domain ? { domain } : {},
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  // 카테고리 추가 (전역 공용 — created_by 로 생성자만 감사 기록)
  async create(userId: number, dto: CreateCategoryDto) {
    // 같은 도메인+code 중복 방지 (전역 유니크)
    const exist = await this.prisma.category.findUnique({
      where: { domain_code: { domain: dto.domain, code: dto.code } },
    });
    if (exist) throw new ConflictException('이미 존재하는 코드입니다.');

    const maxOrder = await this.prisma.category.aggregate({
      where: { domain: dto.domain },
      _max: { sort_order: true },
    });
    // sort_order는 1부터 시작 (moneymate 컨벤션)
    const nextOrder = (maxOrder._max.sort_order ?? 0) + 1;

    const created = await this.prisma.category.create({
      data: {
        domain: dto.domain,
        code: dto.code,
        label: dto.label,
        parent_code: dto.parentCode ?? null,
        sort_order: dto.sortOrder ?? nextOrder,
        created_by: userId,
      },
    });
    return this.toDto(created);
  }

  // 카테고리 수정 (전역 공용 — 라벨·정렬순서·활성 여부)
  async update(id: number, dto: UpdateCategoryDto) {
    const row = await this.prisma.category.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('카테고리를 찾을 수 없습니다.');

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.parentCode !== undefined && { parent_code: dto.parentCode || null }),
        ...(dto.sortOrder !== undefined && { sort_order: dto.sortOrder }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
      },
    });
    return this.toDto(updated);
  }

  // 카테고리 삭제 (전역 공용 — 기존 거래는 code 문자열 참조라 삭제 시 라벨만 사라짐. 숨김은 is_active=false 권장)
  async remove(id: number) {
    const row = await this.prisma.category.findUnique({ where: { id } });
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
        const { code, label, parent } = SEED[d][i];
        try {
          await this.prisma.category.upsert({
            where: { domain_code: { domain: d, code } },
            // 기존 행은 부모 코드만 보강(2계층 도입 전 시드된 행 호환)
            update: { parent_code: parent ?? null },
            create: { domain: d, code, label, parent_code: parent ?? null, sort_order: i + 1, created_by: userId },
          });
          created++;
        } catch { /* skip duplicates */ }
      }
      results.push({ domain: d, created });
    }
    return results;
  }
}
