import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchResult {
  type: 'tx' | 'note';
  icon: string;
  title: string;
  sub: string;
  href: string;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  // 통합 검색 — 거래(제목)·메모(제목/본문). 타입별 최대 5건.
  async search(userId: number, q: string): Promise<SearchResult[]> {
    const term = q.trim();
    if (!term) return [];
    const like = { contains: term };

    const [txs, notes] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { user_id: userId, deleted_at: null, title: like },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      this.prisma.note.findMany({
        where: { user_id: userId, deleted_at: null, OR: [{ title: like }, { body: like }] },
        orderBy: { updated_at: 'desc' },
        take: 5,
      }),
    ]);

    return [
      ...txs.map((t): SearchResult => ({
        type: 'tx',
        icon: '💰',
        title: t.title,
        sub: `${t.date.toISOString().slice(0, 10)} · 가계부`,
        href: '/transactions',
      })),
      ...notes.map((n): SearchResult => ({
        type: 'note',
        icon: '📝',
        title: n.title,
        sub: `${n.updated_at.toISOString().slice(0, 10)} · 메모`,
        href: '/notes',
      })),
    ];
  }
}
