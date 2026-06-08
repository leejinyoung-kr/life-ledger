import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EnvProject, EnvVar, EnvKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { AccessLogService } from '../access-log/access-log.service';
import type { ClientInfo } from '../common/client-info.decorator';
import {
  BulkEnvDto,
  CreateEnvProjectDto,
  CreateEnvVarDto,
  EnvKindDto,
  UpdateEnvProjectDto,
  UpdateEnvVarDto,
} from './dto/env.dto';

@Injectable()
export class EnvService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private accessLog: AccessLogService,
  ) {}

  // ── 프로젝트 ────────────────────────────────────────────────

  // 프로젝트 → DTO. 환경별 변수 개수 요약 포함
  private projectDto(p: EnvProject, counts: Record<EnvKind, number>) {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      counts,
      totalVars: counts.dev + counts.staging + counts.prod,
      updatedAt: p.updated_at.toISOString(),
    };
  }

  // 프로젝트 목록 + 환경별 변수 개수 (최근 수정순)
  async findProjects(userId: number) {
    const projects = await this.prisma.envProject.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { updated_at: 'desc' },
    });
    const grouped = await this.prisma.envVar.groupBy({
      by: ['project_id', 'env'],
      where: { user_id: userId, deleted_at: null },
      _count: { _all: true },
    });
    return projects.map((p) => {
      const counts: Record<EnvKind, number> = { dev: 0, staging: 0, prod: 0 };
      for (const g of grouped) {
        if (g.project_id === p.id) counts[g.env] = g._count._all;
      }
      return this.projectDto(p, counts);
    });
  }

  // 본인 소유 프로젝트 확인
  private async findOwnedProject(userId: number, id: number): Promise<EnvProject> {
    const row = await this.prisma.envProject.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
    return row;
  }

  // 프로젝트 추가
  async createProject(userId: number, dto: CreateEnvProjectDto) {
    const created = await this.prisma.envProject.create({
      data: {
        user_id: userId,
        name: dto.name.trim(),
        description: dto.description || null,
      },
    });
    return this.projectDto(created, { dev: 0, staging: 0, prod: 0 });
  }

  // 프로젝트 수정
  async updateProject(userId: number, id: number, dto: UpdateEnvProjectDto) {
    await this.findOwnedProject(userId, id);
    await this.prisma.envProject.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description === undefined ? undefined : dto.description || null,
      },
    });
    return { id };
  }

  // 프로젝트 삭제 (soft delete) — 하위 변수도 함께 삭제
  async removeProject(userId: number, id: number) {
    await this.findOwnedProject(userId, id);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.envVar.updateMany({
        where: { project_id: id, deleted_at: null },
        data: { deleted_at: now },
      }),
      this.prisma.envProject.update({ where: { id }, data: { deleted_at: now } }),
    ]);
    return { id };
  }

  // ── 변수 ────────────────────────────────────────────────────

  // 변수 → 목록 DTO. 값은 길이만큼 마스킹(원문은 reveal 로만)
  private varDto(v: EnvVar) {
    const plain = this.crypto.decrypt(v.value_enc);
    return {
      id: v.id,
      env: v.env,
      group: v.group,
      key: v.key,
      valueMasked: '•'.repeat(Math.min(plain.length, 20)),
      memo: v.memo,
    };
  }

  // 특정 프로젝트·환경의 변수 목록 (그룹·생성순)
  async findVars(userId: number, projectId: number, env: EnvKindDto) {
    await this.findOwnedProject(userId, projectId);
    const rows = await this.prisma.envVar.findMany({
      where: { user_id: userId, project_id: projectId, env, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => this.varDto(r));
  }

  // 특정 프로젝트·환경 변수를 원문 포함으로 내보내기 (.env 복사/다운로드용)
  async exportVars(userId: number, projectId: number, env: EnvKindDto) {
    await this.findOwnedProject(userId, projectId);
    const rows = await this.prisma.envVar.findMany({
      where: { user_id: userId, project_id: projectId, env, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => ({
      key: r.key,
      value: this.crypto.decrypt(r.value_enc),
      group: r.group,
    }));
  }

  // 본인 소유 변수 확인
  private async findOwnedVar(userId: number, id: number): Promise<EnvVar> {
    const row = await this.prisma.envVar.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('변수를 찾을 수 없습니다.');
    return row;
  }

  // 변수 값 원문 복호화 (표시/복사). 열람 사실을 감사 로그에 기록
  async revealVar(userId: number, id: number, client?: ClientInfo) {
    const row = await this.findOwnedVar(userId, id);
    await this.accessLog.log(userId, 'env_reveal', { type: 'env', id, name: row.key }, client);
    return { value: this.crypto.decrypt(row.value_enc) };
  }

  // 변수 추가 — 선택된 환경마다 행 생성 (값 암호화)
  async createVar(userId: number, projectId: number, dto: CreateEnvVarDto) {
    await this.findOwnedProject(userId, projectId);
    const valueEnc = this.crypto.encrypt(dto.value);
    await this.prisma.envVar.createMany({
      data: dto.envs.map((env) => ({
        user_id: userId,
        project_id: projectId,
        env,
        group: dto.group || null,
        key: dto.key.trim(),
        value_enc: valueEnc,
        memo: dto.memo || null,
      })),
    });
    return { count: dto.envs.length };
  }

  // 변수 수정 (value 가 오면 재암호화). 값이 실제로 바뀌면 이전 암호문을 이력에 보관(롤백용)
  async updateVar(userId: number, id: number, dto: UpdateEnvVarDto) {
    const current = await this.findOwnedVar(userId, id);
    const valueChanged = dto.value !== undefined && dto.value !== this.crypto.decrypt(current.value_enc);
    if (valueChanged) await this.pushHistory(userId, id, current.value_enc);
    const updated = await this.prisma.envVar.update({
      where: { id },
      data: {
        group: dto.group === undefined ? undefined : dto.group || null,
        key: dto.key?.trim(),
        value_enc: dto.value === undefined ? undefined : this.crypto.encrypt(dto.value),
        memo: dto.memo === undefined ? undefined : dto.memo || null,
      },
    });
    return this.varDto(updated);
  }

  // 이전 값 암호문을 이력에 추가하고 변수당 최근 20건만 유지
  private async pushHistory(userId: number, envVarId: number, valueEnc: string) {
    await this.prisma.envVarHistory.create({
      data: { env_var_id: envVarId, user_id: userId, value_enc: valueEnc },
    });
    const old = await this.prisma.envVarHistory.findMany({
      where: { env_var_id: envVarId },
      orderBy: { created_at: 'desc' },
      skip: 20,
      select: { id: true },
    });
    if (old.length) {
      await this.prisma.envVarHistory.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }
  }

  // 변수 값 변경 이력 (최신순) — 값은 마스킹, 원문은 롤백으로만 반영
  async varHistory(userId: number, id: number) {
    await this.findOwnedVar(userId, id);
    const rows = await this.prisma.envVarHistory.findMany({
      where: { env_var_id: id, user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((h) => ({
      id: h.id,
      valueMasked: '•'.repeat(Math.min(this.crypto.decrypt(h.value_enc).length, 20)),
      changedAt: h.created_at.toISOString(),
    }));
  }

  // 이력 값으로 롤백 — 현재 값을 이력에 보관한 뒤 선택한 이전 값으로 되돌린다
  async rollbackVar(userId: number, id: number, historyId: number) {
    const current = await this.findOwnedVar(userId, id);
    const hist = await this.prisma.envVarHistory.findFirst({
      where: { id: historyId, env_var_id: id, user_id: userId },
    });
    if (!hist) throw new NotFoundException('이력을 찾을 수 없습니다.');
    await this.pushHistory(userId, id, current.value_enc);
    const updated = await this.prisma.envVar.update({
      where: { id },
      data: { value_enc: hist.value_enc },
    });
    return this.varDto(updated);
  }

  // 두 환경 변수 비교(diff) — 누락(한쪽에만 있음) + 값 불일치(양쪽 있으나 값 다름)
  async diff(userId: number, projectId: number, base: EnvKindDto, target: EnvKindDto) {
    await this.findOwnedProject(userId, projectId);
    const load = async (env: EnvKindDto) => {
      const rows = await this.prisma.envVar.findMany({
        where: { user_id: userId, project_id: projectId, env, deleted_at: null },
      });
      return new Map(rows.map((r) => [r.key, this.crypto.decrypt(r.value_enc)]));
    };
    const [b, t] = await Promise.all([load(base), load(target)]);

    const onlyInBase: string[] = [];
    const onlyInTarget: string[] = [];
    const valueMismatch: string[] = [];
    for (const k of b.keys()) {
      if (!t.has(k)) onlyInBase.push(k);
      else if (t.get(k) !== b.get(k)) valueMismatch.push(k);
    }
    for (const k of t.keys()) if (!b.has(k)) onlyInTarget.push(k);

    return {
      base, target,
      onlyInBase: onlyInBase.sort(),
      onlyInTarget: onlyInTarget.sort(),
      valueMismatch: valueMismatch.sort(),
      identical: !onlyInBase.length && !onlyInTarget.length && !valueMismatch.length,
    };
  }

  // 변수 삭제 (soft delete)
  async removeVar(userId: number, id: number) {
    await this.findOwnedVar(userId, id);
    await this.prisma.envVar.update({ where: { id }, data: { deleted_at: new Date() } });
    return { id };
  }

  // 변수 일괄 삭제 (soft delete)
  async removeVarMany(userId: number, ids: number[]) {
    if (!ids.length) throw new BadRequestException('삭제할 항목이 없습니다.');
    const { count } = await this.prisma.envVar.updateMany({
      where: { id: { in: ids }, project: { user_id: userId }, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    return { count };
  }

  // .env 텍스트 일괄 파싱 후 저장 (KEY=VALUE 행만, 주석/빈줄 무시). 값은 암호화
  async bulkUpsert(userId: number, projectId: number, dto: BulkEnvDto) {
    await this.findOwnedProject(userId, projectId);
    const parsed = dto.text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const eq = l.indexOf('=');
        return { key: l.slice(0, eq).trim(), value: l.slice(eq + 1).trim() };
      })
      .filter((p) => p.key);
    if (!parsed.length) return { count: 0 };

    const data: Prisma.EnvVarCreateManyInput[] = parsed.map((p) => ({
      user_id: userId,
      project_id: projectId,
      env: dto.env,
      group: null,
      key: p.key,
      value_enc: this.crypto.encrypt(p.value),
      memo: null,
    }));
    await this.prisma.envVar.createMany({ data });
    return { count: data.length };
  }
}
