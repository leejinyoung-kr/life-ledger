import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchResult {
  type: 'tx' | 'cred' | 'id';
  icon: string;
  title: string;
  sub: string;
  href: string;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  // 통합 검색 — 거래·계정·신원. 암호화 컬럼은 검색 대상에서 제외(평문 메타만). 타입별 최대 5건.
  async search(userId: number, q: string): Promise<SearchResult[]> {
    const term = q.trim();
    if (!term) return [];
    const like = { contains: term };
    const base = { user_id: userId, deleted_at: null };

    const [txs, creds, ids] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { ...base, title: like },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      this.prisma.credential.findMany({
        where: { ...base, OR: [{ name: like }, { username: like }, { url: like }] },
        orderBy: { updated_at: 'desc' },
        take: 5,
      }),
      this.prisma.identityCard.findMany({
        where: { ...base, name: like },
        orderBy: { updated_at: 'desc' },
        take: 5,
      }),
    ]);

    return [
      ...txs.map((t): SearchResult => ({
        type: 'tx', icon: '💰', title: t.title,
        sub: `${t.date.toISOString().slice(0, 10)} · 가계부`, href: '/transactions',
      })),
      ...creds.map((c): SearchResult => ({
        type: 'cred', icon: '🔑', title: c.name,
        sub: `${c.username} · 계정`, href: '/credentials',
      })),
      ...ids.map((i): SearchResult => ({
        type: 'id', icon: '🪪', title: i.name,
        sub: '신원 지갑', href: '/id-wallet',
      })),
    ];
  }
}
