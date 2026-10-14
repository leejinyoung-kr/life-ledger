import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchResult {
  type: 'tx' | 'cred';
  icon: string;
  title: string;
  sub: string;
  href: string;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  // 통합 검색 — 거래·계정. 암호화 컬럼은 검색 대상에서 제외(평문 메타만). 타입별 최대 5건.
  async search(userId: number, q: string): Promise<SearchResult[]> {
    const term = q.trim();
    if (!term) return [];
    const like = { contains: term };
    const base = { user_id: userId, deleted_at: null };

    const [txs, creds] = await Promise.all([
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
    ]);

    // href 는 그 항목을 바로 여는 주소 — 가계부는 그날 · 그 내역으로 거른 목록 + 수정 창, 계정은 상세 창
    return [
      ...txs.map((t): SearchResult => {
        const date = t.date.toISOString().slice(0, 10);
        const qs = new URLSearchParams({ q: t.title, date, focus: String(t.id) });
        return { type: 'tx', icon: '💰', title: t.title, sub: `${date} · 가계부`, href: `/transactions?${qs.toString()}` };
      }),
      ...creds.map((c): SearchResult => ({
        type: 'cred', icon: '🔑', title: c.name,
        sub: `${c.username} · 계정`, href: `/credentials?focus=${c.id}`,
      })),
    ];
  }
}
