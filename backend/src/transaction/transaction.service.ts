import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma, Transaction, TransactionType, TransferTarget,
} from '@prisma/client';
import * as ExcelJS from 'exceljs';
import type { Writable } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { parsePage } from '@leejinyoung-kr/core-common';
import {
  RRule, toDateStr, periodOf, adjustWeekend, monthlyDate, nthOccurrence, monthRange,
} from './recurring.util';
import { SystemLogService } from '../system-log/system-log.service';

// 엑셀 양식 유형 라벨 → TransactionType 코드
const TYPE_CODE: Record<string, TransactionType> = {
  수입: 'income',
  지출: 'expense',
  자산이동: 'transfer',
};

// TransactionType 코드 → 한글 라벨 (내보내기용, TYPE_CODE 역방향)
const TYPE_LABEL: Record<TransactionType, string> = {
  income: '수입',
  expense: '지출',
  transfer: '자산이동',
};

// 내보내기/양식 공통 컬럼 — 화면 테이블과 동일 순서
const EXPORT_COLUMNS: { header: string; key: string; width: number }[] = [
  { header: '유형', key: 'type', width: 12 },
  { header: '카테고리', key: 'category', width: 16 },
  { header: '내역', key: 'title', width: 28 },
  { header: '결제수단', key: 'payMethod', width: 14 },
  { header: '금액', key: 'amount', width: 14 },
  { header: '날짜', key: 'date', width: 14 },
  { header: '메모', key: 'memo', width: 30 },
];

// 양식 필수 컬럼 (헤더의 '*'/공백 제거 후 기준)
const REQUIRED_HEADERS = ['유형', '카테고리', '내역', '결제수단', '금액', '날짜'];

// 엑셀 업로드 결과 요약
export interface ImportResult {
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
}

// 헤더 라벨 정규화 ('유형*' → '유형')
function normalizeHeader(s: string): string {
  return s.replace(/\*/g, '').trim();
}

// 금액 셀 → 양수 number. 콤마 허용. 실패 시 null
function parseAmount(v: ExcelJS.CellValue): number | null {
  if (typeof v === 'number') return v > 0 ? v : null;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[,\s₩]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

// 날짜 셀 → Date. Date 객체/'YYYY-MM-DD' 문자열 허용. 실패 시 null
function parseDate(v: ExcelJS.CellValue): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}`);
  }
  return null;
}

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private sysLog: SystemLogService,
  ) {}

  // 엔티티 → 프론트 응답 DTO (Decimal→number, Date→문자열)
  private toDto(t: Transaction) {
    return {
      id: t.id,
      type: t.type,
      date: toDateStr(t.date),
      title: t.title,
      category: t.category,
      amount: t.amount.toNumber(),
      payMethod: t.pay_method,
      memo: t.memo,
      // 자동이체 설정(RecurringSchedule)으로 생성된 회차인지 (프론트 🔁 표시용)
      recurringScheduleId: t.recurring_schedule_id ?? null,
      // 구독 결제일이 지나 자동 등록된 내역인지 (프론트 카드 아이콘 표시용)
      subscriptionId: t.subscription_id ?? null,
      targetType: t.target_type ?? null,
      targetId: t.target_id ?? null,
    };
  }

  // 자산이동(transfer) 거래 1건이 대상 잔액에 미치는 효과를 적용. signedAmount가 양수면 누적, 음수면 역반영(수정/삭제 시 사용)
  // required=false(역반영 전용)면 대상이 이미 삭제돼 없어도 조용히 건너뜀 — 연동 항목 삭제 후에도 거래 자체는 수정/삭제 가능해야 함
  private async applyTransferEffect(
    tx: Prisma.TransactionClient,
    userId: number,
    targetType: TransferTarget,
    targetId: number,
    signedAmount: Prisma.Decimal,
    required = true,
  ): Promise<void> {
    if (signedAmount.isZero()) return;
    if (targetType === 'saving') {
      const { count } = await tx.saving.updateMany({
        where: { id: targetId, user_id: userId, deleted_at: null },
        data: { balance: { increment: signedAmount } },
      });
      if (!count && required) throw new BadRequestException('이동 대상 예적금을 찾을 수 없습니다.');
    } else {
      // target_id는 InvestmentAccount.id — 계좌 예수금에 누적(계좌 내 종목들이 공유)
      const { count } = await tx.investmentAccount.updateMany({
        where: { id: targetId, user_id: userId, deleted_at: null },
        data: { cash_balance: { increment: signedAmount } },
      });
      if (!count && required) throw new BadRequestException('이동 대상 투자 계좌를 찾을 수 없습니다.');
    }
  }

  // row의 기존 target 효과를 역반영 → 거래 row 패치 적용 → 새 target 효과를 적용. 수정 시 정확한 차액 반영을 위해 사용
  private async applyRowUpdatePatch(
    tx: Prisma.TransactionClient,
    userId: number,
    row: Transaction,
    patch: Prisma.TransactionUpdateInput,
  ): Promise<Transaction> {
    if (row.target_type && row.target_id) {
      await this.applyTransferEffect(tx, userId, row.target_type, row.target_id, row.amount.negated(), false);
    }
    const updated = await tx.transaction.update({ where: { id: row.id }, data: patch });
    if (updated.target_type && updated.target_id) {
      await this.applyTransferEffect(tx, userId, updated.target_type, updated.target_id, updated.amount);
    }
    return updated;
  }

  // 활성 자동이체 설정(RecurringSchedule, kind=transaction)의 회차를 현재 월까지 미리 생성한다.
  // 회차는 recurring_period 로 식별 — 이미 생성된 회차는 다시 만들지 않는다.
  // RecurringCronService가 매일 오전 9시에 전체 사용자 대상으로 호출(조회/생성 시점에는 호출하지 않음).
  async materializeRecurring(userId: number): Promise<number> {
    const schedules = await this.prisma.recurringSchedule.findMany({
      where: { user_id: userId, deleted_at: null, kind: 'transaction', active: true },
    });
    if (!schedules.length) return 0;
    const now = new Date();

    // 이미 생성된 회차(삭제분 포함) — 설정마다 조회하지 않고 한 번에 읽어 설정별로 나눈다
    const existing = await this.prisma.transaction.findMany({
      where: { user_id: userId, recurring_schedule_id: { in: schedules.map((s) => s.id) } },
      select: { recurring_schedule_id: true, recurring_period: true },
    });
    const havePeriods = new Map<number, Set<string>>();
    for (const e of existing) {
      if (!e.recurring_schedule_id || !e.recurring_period) continue;
      const set = havePeriods.get(e.recurring_schedule_id) ?? new Set<string>();
      set.add(e.recurring_period);
      havePeriods.set(e.recurring_schedule_id, set);
    }

    for (const s of schedules) {
      const rule = s.rule as unknown as RRule | null;
      if (!rule?.cycle) continue;

      const have = havePeriods.get(s.id) ?? new Set<string>();

      const toCreate: Prisma.TransactionCreateManyInput[] = [];
      for (let i = 0; i <= 120; i++) { // 안전 상한
        const occ = nthOccurrence(s.start_date, rule, i);
        if (occ > now) break;
        if (occ < s.start_date) continue; // 시작일 이전 회차(연간 i=0이 시작월보다 이른 달인 경우)는 만들지 않음
        const period = periodOf(occ, rule.cycle);
        if (have.has(period)) continue;
        have.add(period);
        toCreate.push({
          user_id: userId, type: s.tx_type!, date: occ, title: s.title!, category: s.category!,
          amount: s.amount!, pay_method: s.pay_method ?? '', memo: s.memo,
          recurring_schedule_id: s.id, recurring_period: period,
          target_type: s.target_type, target_id: s.target_id,
        });
      }
      if (toCreate.length) {
        await this.prisma.$transaction(async (tx) => {
          await tx.transaction.createMany({ data: toCreate });
          // 자산이동 자동이체 설정이면 새로 생성된 회차분만큼 대상 잔액에 일괄 누적 (회차당 금액은 설정과 동일)
          if (s.target_type && s.target_id) {
            await this.applyTransferEffect(tx, userId, s.target_type, s.target_id, s.amount!.mul(toCreate.length));
          }
          await tx.recurringSchedule.update({
            where: { id: s.id },
            data: { last_period: toCreate[toCreate.length - 1].recurring_period as string },
          });
        });
        this.sysLog.info({
          userId,
          category: 'recurring_tx',
          message: `반복거래 '${s.title}' ${toCreate.length}건 회차 생성`,
          metadata: { scheduleId: s.id, title: s.title, periods: toCreate.map((c) => c.recurring_period) },
        });
      }
    }
    return schedules.length;
  }

  // 사용자의 가장 최근 거래 월(YYYY-MM). 없으면 null — 더미 데이터(과거)에서도 추이가 보이도록 기준점 사용
  private async latestMonth(userId: number): Promise<string | null> {
    const latest = await this.prisma.transaction.findFirst({
      where: { user_id: userId, deleted_at: null },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    return latest ? toDateStr(latest.date).slice(0, 7) : null;
  }

  // 목록/내보내기 공통 where 빌더 — 날짜범위/유형/카테고리/검색어 필터
  private buildWhere(userId: number, query: QueryTransactionDto): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = {
      user_id: userId,
      deleted_at: null,
    };
    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to   ? { lte: new Date(query.to)   } : {}),
      };
    }
    if (query.type) where.type = query.type;
    if (query.category) where.category = query.category;
    if (query.q) where.title = { contains: query.q };
    return where;
  }

  // 현재 필터(where)에 해당하는 전체 행의 유형별 합계 — 페이지와 무관하게 필터 전체 기준
  private async sumsFor(where: Prisma.TransactionWhereInput) {
    const grouped = await this.prisma.transaction.groupBy({ by: ['type'], where, _sum: { amount: true } });
    const sumOf = (type: TransactionType) => grouped.find((g) => g.type === type)?._sum.amount?.toNumber() ?? 0;
    return { sumIncome: sumOf('income'), sumExpense: sumOf('expense'), sumTransfer: sumOf('transfer') };
  }

  // 내역 목록 — 날짜범위/유형/카테고리/검색어 필터.
  // 반복 회차는 RecurringCronService가 매일 오전 9시에 일괄 생성(idempotent) — 조회 시점에는 만들지 않음.
  // page 지정 시 서버 페이징(Paginated), 없으면 전체 배열.
  async findAll(userId: number, query: QueryTransactionDto) {
    const where = this.buildWhere(userId, query);
    const orderBy: Prisma.TransactionOrderByWithRelationInput[] = [{ date: 'desc' }, { id: 'desc' }];

    const pg = parsePage(query.page, query.limit);
    if (pg) {
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.transaction.findMany({ where, orderBy, skip: pg.skip, take: pg.take }),
        this.prisma.transaction.count({ where }),
      ]);
      const sums = await this.sumsFor(where);
      return { items: rows.map((r) => this.toDto(r)), total, page: pg.page, limit: pg.limit, ...sums };
    }

    const [rows, sums] = await Promise.all([
      this.prisma.transaction.findMany({ where, orderBy }),
      this.sumsFor(where),
    ]);
    return { items: rows.map((r) => this.toDto(r)), ...sums };
  }

  // 월 요약 — 수입/지출/저축이동 합계 + 실소비/잔액. month 미지정 시 최근 월 사용
  async summary(userId: number, month?: string) {
    const target = month ?? (await this.latestMonth(userId));
    const where: Prisma.TransactionWhereInput = {
      user_id: userId,
      deleted_at: null,
    };
    if (target) where.date = monthRange(target);

    const grouped = await this.prisma.transaction.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
    });
    const sumOf = (type: TransactionType) =>
      grouped.find((g) => g.type === type)?._sum.amount?.toNumber() ?? 0;

    const income = sumOf('income');
    const expense = sumOf('expense');
    const transfer = sumOf('transfer');
    // 저축이동은 실소비가 아닌 자산 이동 → 잔액에서 함께 차감하되 실소비에는 미포함
    return {
      month: target,
      income,
      expense,
      transfer,
      realSpend: expense,
      balance: income - expense - transfer,
    };
  }

  // 월별 지출 추이 — 기준 월 포함 최근 5개월의 지출 합계
  async monthlyTrend(userId: number, month?: string) {
    const anchor = month ?? (await this.latestMonth(userId));
    if (!anchor) return [];
    const [y, m] = anchor.split('-').map(Number);

    const buckets: { month: string; label: string; total: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const range = monthRange(key);
      const agg = await this.prisma.transaction.aggregate({
        where: {
          user_id: userId,
          deleted_at: null,
          type: 'expense',
          date: range,
        },
        _sum: { amount: true },
      });
      buckets.push({
        month: key,
        label: `${d.getUTCMonth() + 1}월`,
        total: agg._sum.amount?.toNumber() ?? 0,
      });
    }
    return buckets;
  }

  // 내역 추가
  async create(userId: number, dto: CreateTransactionDto) {
    const date = new Date(dto.date);
    const hasTarget = dto.type === 'transfer' && dto.targetType != null && dto.targetId != null;

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.transaction.create({
        data: {
          user_id: userId,
          type: dto.type,
          date,
          title: dto.title,
          category: dto.category,
          amount: new Prisma.Decimal(dto.amount),
          pay_method: dto.payMethod ?? '',
          memo: dto.memo,
          target_type: hasTarget ? dto.targetType : null,
          target_id: hasTarget ? dto.targetId : null,
        },
      });
      if (hasTarget) {
        await this.applyTransferEffect(tx, userId, dto.targetType!, dto.targetId!, row.amount);
      }
      return row;
    });
    return this.toDto(created);
  }

  // 엑셀 양식(.xlsx) 업로드 → 행별 검증 후 일괄 추가.
  // 카테고리/유형은 라벨로 입력되므로 코드로 역매핑하고, 검증 실패 행은 건너뛰고 결과에 사유를 모은다.
  async importExcel(userId: number, buffer: Buffer): Promise<ImportResult> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new BadRequestException('엑셀 파일을 읽을 수 없습니다.');
    }
    const ws = wb.getWorksheet('가계부') ?? wb.worksheets[0];
    if (!ws) throw new BadRequestException('시트를 찾을 수 없습니다.');

    // 헤더행 → 컬럼 인덱스 맵
    const colOf: Record<string, number> = {};
    ws.getRow(1).eachCell((cell, col) => {
      const key = normalizeHeader(String(cell.text ?? ''));
      if (key) colOf[key] = col;
    });
    const missingHeader = REQUIRED_HEADERS.filter((h) => !colOf[h]);
    if (missingHeader.length) {
      throw new BadRequestException(`양식 헤더 누락: ${missingHeader.join(', ')}`);
    }

    // 카테고리 라벨 → 코드 (소분류만 — 대분류는 거래에 직접 저장 안 함, 동명 라벨 충돌 방지)
    const cats = await this.prisma.category.findMany({
      where: { domain: 'transaction', parent_code: { not: null } },
      select: { code: true, label: true },
    });
    const catCode = new Map(cats.map((c) => [c.label, c.code]));
    // 결제수단 라벨 → 코드
    const payMethods = await this.prisma.category.findMany({
      where: { domain: 'pay_method' },
      select: { code: true, label: true },
    });
    const payMethodCode = new Map(payMethods.map((c) => [c.label, c.code]));
    const memoCol = colOf['메모'];

    const valid: Prisma.TransactionCreateManyInput[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const typeLabel = String(row.getCell(colOf['유형']).text ?? '').trim();
      const catLabel = String(row.getCell(colOf['카테고리']).text ?? '').trim();
      const title = String(row.getCell(colOf['내역']).text ?? '').trim();
      const payMethod = String(row.getCell(colOf['결제수단']).text ?? '').trim();
      const amountRaw = row.getCell(colOf['금액']).value;
      const dateRaw = row.getCell(colOf['날짜']).value;

      // 완전 빈 행은 건너뜀
      if (!typeLabel && !catLabel && !title && !payMethod && amountRaw == null && dateRaw == null) continue;

      const type = TYPE_CODE[typeLabel];
      const category = catCode.get(catLabel);
      const payMethodCd = payMethodCode.get(payMethod);
      const amount = parseAmount(amountRaw);
      const date = parseDate(dateRaw);

      const bad: string[] = [];
      if (!type) bad.push('유형');
      if (!category) bad.push('카테고리');
      if (!title) bad.push('내역');
      // 결제수단은 지출일 때만 필수
      if (type === 'expense' && !payMethodCd) bad.push('결제수단');
      if (amount == null) bad.push('금액');
      if (!date) bad.push('날짜');
      if (bad.length) {
        errors.push({ row: r, message: `${bad.join(', ')} 값 오류` });
        continue;
      }

      const memo = memoCol ? String(row.getCell(memoCol).text ?? '').trim() : '';
      valid.push({
        user_id: userId,
        type: type!,
        date: date!,
        title,
        category: category!,
        amount: new Prisma.Decimal(amount!),
        // 지출만 결제수단 저장 — 수입/자산이동은 빈값
        pay_method: type === 'expense' ? payMethodCd! : '',
        memo: memo || null,
      });
    }

    // 대량 INSERT 패킷 한계 회피 — 1000건씩 분할 등록
    const CHUNK = 1000;
    for (let i = 0; i < valid.length; i += CHUNK) {
      await this.prisma.transaction.createMany({ data: valid.slice(i, i + CHUNK) });
    }
    return { imported: valid.length, failed: errors.length, errors };
  }

  // 현재 필터(findAll 동일)에 해당하는 내역을 .xlsx 로 스트리밍 내보낸다.
  // 전체 메모리 적재를 피하려 행은 커서 배치로 읽고 exceljs 스트림 라이터로 응답에 바로 흘려보낸다.
  // 카테고리/유형은 코드→라벨로 변환해 양식과 동일한 형태로 출력(재업로드 가능).
  async streamExport(userId: number, query: QueryTransactionDto, stream: Writable): Promise<void> {
    const where = this.buildWhere(userId, query);
    const cats = await this.prisma.category.findMany({
      where: { domain: 'transaction' },
      select: { code: true, label: true },
    });
    const catLabel = new Map(cats.map((c) => [c.code, c.label]));
    const payMethods = await this.prisma.category.findMany({
      where: { domain: 'pay_method' },
      select: { code: true, label: true },
    });
    const payMethodLabel = new Map(payMethods.map((c) => [c.code, c.label]));
    const banks = await this.prisma.category.findMany({
      where: { domain: 'bank' },
      select: { code: true, label: true },
    });
    const bankLabel = new Map(banks.map((c) => [c.code, c.label]));

    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true });
    const ws = wb.addWorksheet('가계부');
    ws.columns = EXPORT_COLUMNS;
    ws.getColumn('amount').numFmt = '#,##0';

    // 헤더행 스타일 후 커밋
    const head = ws.getRow(1);
    head.font = { bold: true };
    head.alignment = { horizontal: 'center', vertical: 'middle' };
    head.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    });
    head.commit();

    // 커서 기반 배치 조회 — 메모리 상한 유지
    const BATCH = 1000;
    let cursor: number | undefined;
    for (;;) {
      const rows = await this.prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (!rows.length) break;
      for (const t of rows) {
        ws.addRow({
          type: TYPE_LABEL[t.type],
          category: catLabel.get(t.category) ?? t.category,
          title: t.title,
          payMethod: t.type === 'expense'
            ? (payMethodLabel.get(t.pay_method) ?? t.pay_method)
            : t.type === 'income'
              ? (bankLabel.get(t.pay_method) ?? t.pay_method)
              : t.pay_method,
          amount: t.amount.toNumber(),
          date: toDateStr(t.date),
          memo: t.memo ?? '',
        }).commit();
      }
      cursor = rows[rows.length - 1].id;
      if (rows.length < BATCH) break;
    }

    await ws.commit();
    await wb.commit();
  }

  // 본인 소유 + 미삭제 내역인지 확인 후 반환
  private async findOwned(userId: number, id: number): Promise<Transaction> {
    const row = await this.prisma.transaction.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('거래 내역을 찾을 수 없습니다.');
    return row;
  }

  // 내역 수정
  async update(userId: number, id: number, dto: UpdateTransactionDto) {
    const target = await this.findOwned(userId, id);

    const patch: Prisma.TransactionUpdateInput = {
      type: dto.type,
      date: dto.date ? new Date(dto.date) : undefined,
      title: dto.title,
      category: dto.category,
      amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
      pay_method: dto.payMethod,
      memo: dto.memo,
      target_type: dto.targetType !== undefined ? dto.targetType : undefined,
      target_id: dto.targetId !== undefined ? dto.targetId : undefined,
    };

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.applyRowUpdatePatch(tx, userId, target, patch);
      return this.toDto(updated);
    });
  }

  // 내역 삭제 (soft delete — deleted_at 기록). 자산이동 연동 거래면 대상 잔액도 역반영
  async remove(userId: number, id: number) {
    const target = await this.findOwned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      if (target.target_type && target.target_id) {
        await this.applyTransferEffect(tx, userId, target.target_type, target.target_id, target.amount.negated(), false);
      }
      await tx.transaction.update({ where: { id }, data: { deleted_at: new Date() } });
    });
    return { id };
  }

  // 내역 일괄 삭제 (soft delete) — 자산이동 행은 대상별로 금액을 합쳐 대상마다 한 번 역반영하고, 삭제 표시는 한 번에
  async removeMany(userId: number, ids: number[]) {
    if (!ids.length) throw new BadRequestException('삭제할 항목이 없습니다.');
    const rows = await this.prisma.transaction.findMany({
      where: { id: { in: ids }, user_id: userId, deleted_at: null },
    });
    // 행마다 update 하면 행 수(자산이동이면 그 두 배)만큼 쿼리가 나간다(N+1)
    const byTarget = new Map<string, { type: TransferTarget; id: number; sum: Prisma.Decimal }>();
    for (const row of rows) {
      if (!row.target_type || !row.target_id) continue;
      const key = `${row.target_type}:${row.target_id}`;
      const cur = byTarget.get(key) ?? { type: row.target_type, id: row.target_id, sum: new Prisma.Decimal(0) };
      cur.sum = cur.sum.add(row.amount);
      byTarget.set(key, cur);
    }
    await this.prisma.$transaction(async (tx) => {
      for (const t of byTarget.values()) {
        await this.applyTransferEffect(tx, userId, t.type, t.id, t.sum.negated(), false);
      }
      await tx.transaction.updateMany({
        where: { id: { in: rows.map((r) => r.id) }, user_id: userId },
        data: { deleted_at: new Date() },
      });
    });
    return { count: rows.length };
  }
}
