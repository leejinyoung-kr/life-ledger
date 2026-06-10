import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchResult {
  type: 'tx' | 'note' | 'cred' | 'id' | 'env';
  icon: string;
  title: string;
  sub: string;
  href: string;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  // 통합 검색 — 거래·메모·계정·신원·ENV. 암호화 컬럼은 검색 대상에서 제외(평문 메타만). 타입별 최대 5건.
  async search(userId: number, q: string): Promise<SearchResult[]> {
    const term = q.trim();
    if (!term) return [];
    const like = { contains: term };
    const base = { user_id: userId, deleted_at: null };

    const [txs, notes, creds, ids, projects, vars] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { ...base, title: like },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      this.prisma.note.findMany({
        where: { ...base, OR: [{ title: like }, { body: like }] },
        orderBy: { updated_at: 'desc' },
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
      this.prisma.envProject.findMany({
        where: { ...base, name: like },
        orderBy: { updated_at: 'desc' },
        take: 3,
      }),
      this.prisma.envVar.findMany({
        where: { ...base, key: like },
        orderBy: { updated_at: 'desc' },
        take: 3,
        include: { project: { select: { name: true } } },
      }),
    ]);

    return [
      ...txs.map((t): SearchResult => ({
        type: 'tx', icon: '💰', title: t.title,
        sub: `${t.date.toISOString().slice(0, 10)} · 가계부`, href: '/transactions',
      })),
      ...notes.map((n): SearchResult => ({
        type: 'note', icon: '📝', title: n.title,
        sub: `${n.updated_at.toISOString().slice(0, 10)} · 메모`, href: '/notes',
      })),
      ...creds.map((c): SearchResult => ({
        type: 'cred', icon: '🔑', title: c.name,
        sub: `${c.username} · 계정`, href: '/credentials',
      })),
      ...ids.map((i): SearchResult => ({
        type: 'id', icon: '🪪', title: i.name,
        sub: '신원 지갑', href: '/id-wallet',
      })),
      ...projects.map((p): SearchResult => ({
        type: 'env', icon: '📦', title: p.name,
        sub: 'ENV 프로젝트', href: '/envs',
      })),
      ...vars.map((v): SearchResult => ({
        type: 'env', icon: '⚙️', title: v.key,
        sub: `${v.project.name} · ${v.env} · ENV`, href: '/envs',
      })),
    ];
  }
}
