'use client';

/**
 * ENV 보관함 페이지.
 * 프로젝트별 환경변수를 dev/staging/prod 환경 탭으로 나눠 암호화 관리한다.
 * 값 마스킹·복사·.env 다운로드·붙여넣기 파싱을 지원하며, 데이터는 백엔드(/env-projects, /env-vars)와 연동한다.
 * 값 원문은 reveal/export API 로만 받는다. 스타일: Tailwind. env-table 은 공통 globals 유지.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { notify, copyToClipboard } from '@/lib/toast';
import { useApiQuery, useInvalidate } from '@/lib/query';
import { useFormErrors } from '@/lib/useFormErrors';
import { useRowSelection } from '@/lib/useRowSelection';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import ErrorBanner from '@/components/ErrorBanner';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Field, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import {
  IconCode, IconEdit, IconCopy, IconEye, IconTrash, IconSearch, IconClock,
} from '@/components/icons';
import { api } from '@/lib/api';
import {
  ENV_TABS, ENV_DOT, ENV_GROUPS, groupVars, toEnvText, toEnvExample,
  type EnvKind, type EnvProject, type EnvVar, type ExportVar, type EnvDiff, type EnvVarHistoryEntry,
} from '@/lib/env';

export default function EnvsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [env, setEnv] = useState<EnvKind>('dev');
  const [revealed, setRevealed] = useState<Record<number, string>>({});
  const [paste, setPaste] = useState('');
  const [projectModal, setProjectModal] = useState<{ open: boolean; editing: EnvProject | null }>({ open: false, editing: null });
  const [varModal, setVarModal] = useState<{ open: boolean; editing: EnvVar | null }>({ open: false, editing: null });
  const [varSearch, setVarSearch] = useState('');
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffTarget, setDiffTarget] = useState<EnvKind>('prod');
  const [diff, setDiff] = useState<EnvDiff | null>(null);
  const [historyVar, setHistoryVar] = useState<EnvVar | null>(null);
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();

  // 프로젝트 목록 (React Query 캐시)
  const projectsQuery = useApiQuery<EnvProject[]>(qk.env.projects(), '/env-projects');
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  // 프로젝트 로드 시 선택 보정 (기존 선택 유지, 없으면 첫 항목)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 프로젝트 목록 로드/변경 시 선택값 보정
    if (projects.length === 0) { setSelectedId(null); return; }
    setSelectedId((prev) => (prev && projects.some((p) => p.id === prev) ? prev : projects[0].id));
  }, [projects]);

  // 선택 프로젝트·환경의 변수 (selectedId 있을 때만 조회)
  const varsQuery = useApiQuery<EnvVar[]>(
    qk.env.vars(selectedId ?? 0, env),
    `/env-projects/${selectedId}/vars?env=${env}`,
    { enabled: !!selectedId },
  );
  const vars = useMemo(() => varsQuery.data ?? [], [varsQuery.data]);

  // 프로젝트/환경 전환 시 표시값·검색 초기화
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setRevealed({}); setVarSearch(''); }, [selectedId, env]);

  const error = (projectsQuery.error ?? varsQuery.error)?.message ?? null;
  const project = projects.find((p) => p.id === selectedId) ?? null;

  // 프로젝트 전환 — 환경/표시상태 초기화
  function selectProject(id: number) {
    setSelectedId(id);
    setEnv('dev');
    setRevealed({});
  }

  // 값 표시/숨김 토글 — 처음 표시할 때만 reveal API 로 원문을 받아 캐시
  async function toggleValue(v: EnvVar) {
    if (revealed[v.id] !== undefined) {
      setRevealed((p) => { const n = { ...p }; delete n[v.id]; return n; });
      return;
    }
    try {
      const { value } = await api.get<{ value: string }>(`/env-vars/${v.id}/reveal`);
      setRevealed((p) => ({ ...p, [v.id]: value }));
    } catch {
      notify.error('값을 불러오지 못했습니다.');
    }
  }

  // 단일 변수 값 복사 — 캐시에 없으면 reveal 후 복사
  async function copyVarValue(v: EnvVar) {
    if (revealed[v.id] !== undefined) { copyToClipboard(revealed[v.id]); return; }
    try {
      const { value } = await api.get<{ value: string }>(`/env-vars/${v.id}/reveal`);
      copyToClipboard(value);
    } catch {
      notify.error('값을 불러오지 못했습니다.');
    }
  }

  // 현재 환경 변수를 원문 포함으로 받아 .env 텍스트 생성
  async function fetchEnvText(): Promise<string | null> {
    if (!project) return null;
    try {
      const exported = await api.get<ExportVar[]>(`/env-projects/${project.id}/export?env=${env}`);
      return toEnvText(project.name, env, exported);
    } catch {
      notify.error('내보내기에 실패했습니다.');
      return null;
    }
  }

  async function copyAll() {
    const text = await fetchEnvText();
    if (text) copyToClipboard(text);
  }

  // .env 파일 다운로드
  async function downloadEnv() {
    const text = await fetchEnvText();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `.${env}`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify.success('.env 파일을 다운로드했습니다.');
  }

  // 붙여넣은 .env 텍스트를 일괄 저장 (백엔드 파싱)
  async function parsePaste() {
    if (!project || !paste.trim()) return;
    try {
      const { count } = await api.post<{ count: number }>(`/env-projects/${project.id}/bulk`, { env, text: paste });
      if (count === 0) { notify.error('저장할 KEY=VALUE 행이 없습니다.'); return; }
      notify.success(`변수 ${count}개를 저장했습니다.`);
      setPaste('');
      invalidate(qk.env.all);
    } catch {
      notify.saveFailed();
    }
  }

  // 환경 비교 실행 (현재 env=base, 선택 target)
  const runDiff = useCallback(async (target: EnvKind) => {
    if (!project) return;
    setDiff(null);
    try {
      setDiff(await api.get<EnvDiff>(`/env-projects/${project.id}/diff?base=${env}&target=${target}`));
    } catch {
      notify.error('환경 비교에 실패했습니다.');
    }
  }, [project, env]);

  // 환경 비교 모달 열기 — 현재 env 와 다른 환경을 기본 대상으로
  function openDiff() {
    const target: EnvKind = env === 'prod' ? 'dev' : 'prod';
    setDiffTarget(target);
    setDiffOpen(true);
    runDiff(target);
  }

  // 현재 환경 키만 모아 .env.example 다운로드 (값 제외)
  function downloadExample() {
    if (!project) return;
    const text = toEnvExample(project.name, vars);
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '.env.example';
    a.click();
    URL.revokeObjectURL(a.href);
    notify.success('.env.example 을 다운로드했습니다.');
  }

  // 프로젝트 삭제 (하위 변수 포함)
  async function deleteProject(p: EnvProject) {
    if (!await confirm(`'${p.name}' 프로젝트와 모든 변수를 삭제할까요?`, 'danger')) return;
    try {
      await api.del(`/env-projects/${p.id}`);
      notify.deleted('프로젝트');
      setSelectedId(null);
      invalidate(qk.env.all);
    } catch {
      notify.deleteFailed();
    }
  }

  // 변수 삭제
  async function deleteVar(v: EnvVar) {
    if (!await confirm(`'${v.key}' 변수를 삭제할까요?`, 'danger')) return;
    try {
      await api.del(`/env-vars/${v.id}`);
      notify.deleted('변수');
      clearVars();
      invalidate(qk.env.all);
    } catch {
      notify.deleteFailed();
    }
  }

  async function removeSelectedVars() {
    if (selectedVars.size === 0) return;
    if (!await confirm(`선택한 ${selectedVars.size}개 변수를 삭제할까요?`, 'danger')) return;
    try {
      await api.del('/env-vars/bulk', { ids: [...selectedVars] });
      notify.deleted(`${selectedVars.size}개 변수`);
      clearVars();
      invalidate(qk.env.all);
    } catch {
      notify.deleteFailed();
    }
  }

  const filteredVars = varSearch.trim() ? vars.filter((v) => v.key.toLowerCase().includes(varSearch.toLowerCase())) : vars;
  const { selected: selectedVars, toggle: toggleVar, toggleAll: toggleAllVars, clear: clearVars, allChecked: allVarsChecked } = useRowSelection(filteredVars.map((v) => v.id));
  const grouped = groupVars(filteredVars);

  return (
    <AppShell activePath="/envs" topbarLabel="ENV 보관함">
      <div className="mb-7">
        <div className="flex items-center justify-between gap-4">
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">ENV 보관함</h1>
          <Button onClick={() => setProjectModal({ open: true, editing: null })}>프로젝트 추가</Button>
        </div>
        <p className="text-sm text-secondary mt-1.5 break-keep">프로젝트별 환경변수를 암호화하여 관리합니다. (AES-256-GCM)</p>
      </div>

      <ErrorBanner message={error} className="mb-4" />

      <div className="grid grid-cols-[280px_1fr] gap-5 items-start max-md:grid-cols-1">
        {/* 프로젝트 목록 */}
        <div className="bg-background border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden sticky top-[calc(var(--header-h)+24px)] max-md:static">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-surface">
            <span className="[font-family:var(--font-display)] text-[0.875rem] font-bold text-primary">프로젝트</span>
            <Badge tone="neutral">{projects.length}개</Badge>
          </div>
          <div className="p-2">
            {projects.length === 0 && <p className="text-center text-muted py-5 text-[0.84rem]">프로젝트가 없습니다.</p>}
            {projects.map((p) => {
              const active = p.id === selectedId;
              return (
                <button type="button" key={p.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius)] cursor-pointer transition-colors border border-transparent w-full text-left hover:bg-surface ${active ? 'bg-accent-dim border-[rgba(0,192,127,0.2)]' : ''}`} onClick={() => selectProject(p.id)}>
                  <div className="min-w-0">
                    <div className={`text-[0.855rem] font-semibold truncate ${active ? 'text-accent' : 'text-primary'}`}>{p.name}</div>
                    <div className="text-[0.72rem] text-muted mt-px">변수 {p.totalVars}개</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 환경변수 편집 패널 */}
        {project ? (
          <div className="flex flex-col gap-4">
            {/* 프로젝트 헤더 + 액션 */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div>
                  <div className="[font-family:var(--font-display)] text-base font-bold text-primary">{project.name}</div>
                  <div className="text-[0.75rem] text-muted">AES-256-GCM 암호화 · {project.totalVars}개 변수</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <Button size="sm" onClick={() => setVarModal({ open: true, editing: null })}>변수 추가</Button>
                <span className="w-px h-5 bg-border max-md:hidden" />
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={openDiff}>환경 비교</Button>
                  <Button variant="ghost" size="sm" onClick={downloadExample}>.env.example</Button>
                </div>
                <span className="w-px h-5 bg-border max-md:hidden" />
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setProjectModal({ open: true, editing: project })}>수정</Button>
                  <Button variant="danger" size="sm" onClick={() => deleteProject(project)}>삭제</Button>
                </div>
              </div>
            </div>

            {/* 환경 탭 + 변수 테이블 + 전체 복사 바 */}
            <div className="bg-background border border-border rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)]">
              <div className="relative border-b border-border bg-surface">
                <div className="flex px-4 overflow-x-auto scrollbar-none">
                  {ENV_TABS.map((t) => (
                    <button type="button" key={t.key} className={`px-4 py-2 text-[0.82rem] font-medium cursor-pointer border-b-2 -mb-px transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${env === t.key ? 'text-accent border-accent font-semibold' : 'text-muted border-transparent hover:text-secondary'}`} onClick={() => setEnv(t.key)}>
                      <span className={`w-[7px] h-[7px] rounded-full ${ENV_DOT[t.key]}`} />{t.label}
                      <span className="text-[0.7rem] text-muted">{project.counts[t.key]}</span>
                    </button>
                  ))}
                </div>
                <div className="hidden max-md:block absolute top-0 right-0 bottom-0 w-6 bg-linear-to-l from-surface to-transparent pointer-events-none" />
              </div>

              {/* 변수 검색 */}
              <div className="px-4 py-2.5 border-b border-border bg-surface">
                <div className="relative max-w-72">
                  <IconSearch className="absolute left-2.75 top-1/2 -translate-y-1/2 text-muted w-3.75 h-3.75 pointer-events-none" />
                  <input className="input pl-icon" type="text" placeholder="KEY 검색..." value={varSearch} onChange={(e) => setVarSearch(e.target.value)} aria-label="변수 검색" />
                </div>
              </div>

              {/* env-table: 그룹행 구조라 공통 globals 유지 — 모바일은 가로 스크롤로 레이아웃 깨짐 방지 */}
              <div className="overflow-x-auto">
              <table className="env-table min-w-130">
                <thead>
                  <tr>
                    <th style={{ width: '36px' }} className="td-center"><input type="checkbox" className="checkbox" checked={allVarsChecked} onChange={toggleAllVars} aria-label="전체선택" /></th>
                    <th className="env-th-key">KEY</th>
                    <th>VALUE</th>
                    <th className="env-th-action">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {vars.length === 0 ? (
                    <tr><td colSpan={4} className="env-empty">이 환경에 변수가 없습니다.</td></tr>
                  ) : (
                    grouped.map((g) => (
                      <EnvGroupRows
                        key={g.group}
                        group={g.group}
                        items={g.items}
                        revealed={revealed}
                        selected={selectedVars}
                        onToggle={toggleValue}
                        onCopy={copyVarValue}
                        onEdit={(v) => setVarModal({ open: true, editing: v })}
                        onDelete={deleteVar}
                        onSelect={toggleVar}
                        onHistory={(v) => setHistoryVar(v)}
                      />
                    ))
                  )}
                </tbody>
              </table>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 px-[18px] py-3 bg-surface border-t border-border">
                <span className="text-[0.78rem] text-muted flex-1 max-md:hidden">.env 파일 형식으로 전체 복사</span>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" onClick={copyAll}>전체 복사</Button>
                  <Button variant="ghost" onClick={downloadEnv}>.env 다운로드</Button>
                </div>
                <span className="w-px h-5 bg-border max-md:hidden" />
                <Button variant="danger" disabled={selectedVars.size === 0} onClick={removeSelectedVars}>선택삭제</Button>
              </div>
            </div>

            {/* 일괄 붙여넣기 */}
            <div className="border-2 border-dashed border-border rounded-[var(--radius-lg)] p-5 flex flex-col gap-3">
              <div className="text-[0.82rem] font-semibold text-secondary flex items-center gap-1.5">
                <IconCode width={14} height={14} />.env 파일 내용 붙여넣기 ({env} 환경에 일괄 저장)
              </div>
              <textarea
                className="w-full min-h-[120px] bg-surface border border-border rounded-[var(--radius)] px-3.5 py-3 [font-family:var(--font-mono)] text-[0.82rem] text-primary resize-y outline-none leading-[1.7] transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-dim)] placeholder:text-muted"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={'# .env 내용을 그대로 붙여넣으세요\nDATABASE_URL=mysql://root:root@localhost:3306/doc_nexus\nJWT_SECRET=your_jwt_secret'}
                aria-label=".env 붙여넣기"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setPaste('')}>초기화</Button>
                <Button onClick={parsePaste}>파싱 후 저장</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted py-16">프로젝트를 선택하거나 추가하세요.</div>
        )}
      </div>

      {/* 모달 */}
      {/* 환경 비교 모달 */}
      <Modal open={diffOpen} onClose={() => setDiffOpen(false)} title="환경 비교" footer={<Button variant="ghost" onClick={() => setDiffOpen(false)}>닫기</Button>}>
        <div className="flex items-center gap-2 mb-4 text-[0.84rem]">
          <span className="px-2 py-1 rounded-[var(--radius)] bg-accent-dim text-accent font-semibold">{env}</span>
          <span className="text-muted">vs</span>
          <select className="input w-auto" aria-label="비교 대상 환경" value={diffTarget} onChange={(e) => { const t = e.target.value as EnvKind; setDiffTarget(t); runDiff(t); }}>
            {ENV_TABS.filter((t) => t.key !== env).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        {!diff ? (
          <div className="py-6 text-center text-muted text-[0.84rem]">비교 중...</div>
        ) : diff.identical ? (
          <div className="py-6 text-center text-accent text-[0.875rem]">두 환경의 변수가 동일합니다.</div>
        ) : (
          <div className="flex flex-col gap-4">
            <DiffBlock title={`${env} 에만 있음`} tone="text-accent" keys={diff.onlyInBase} />
            <DiffBlock title={`${diffTarget} 에만 있음`} tone="text-blue" keys={diff.onlyInTarget} />
            <DiffBlock title="값 불일치" tone="text-warning" keys={diff.valueMismatch} />
          </div>
        )}
      </Modal>

      <ProjectModal state={projectModal} onClose={() => setProjectModal((s) => ({ ...s, open: false }))} onSaved={() => { setProjectModal({ open: false, editing: null }); invalidate(qk.env.all); }} />
      <VarModal state={varModal} projectId={selectedId} currentEnv={env} onClose={() => setVarModal((s) => ({ ...s, open: false }))} onSaved={() => { setVarModal({ open: false, editing: null }); invalidate(qk.env.all); }} />
      <HistoryModal envVar={historyVar} onClose={() => setHistoryVar(null)} onRolledBack={() => { setHistoryVar(null); setRevealed({}); invalidate(qk.env.all); }} confirm={confirm} />
      {confirmElement}
    </AppShell>
  );
}

// 환경 비교 결과 블록 (키 목록)
function DiffBlock({ title, tone, keys }: { title: string; tone: string; keys: string[] }) {
  return (
    <div>
      <div className={`text-[0.78rem] font-semibold mb-1.5 ${tone}`}>{title} <span className="text-muted font-normal">{keys.length}</span></div>
      {keys.length === 0 ? (
        <div className="text-[0.78rem] text-muted">없음</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {keys.map((k) => <span key={k} className="[font-family:var(--font-mono)] text-[0.75rem] px-2 py-0.5 rounded-[var(--radius)] bg-surface border border-border">{k}</span>)}
        </div>
      )}
    </div>
  );
}

// 변수 그룹 헤더 + 변수 행들 (env-table 내부 — globals 스타일 유지)
function EnvGroupRows({
  group, items, revealed, selected, onToggle, onCopy, onEdit, onDelete, onSelect, onHistory,
}: {
  group: string; items: EnvVar[];
  revealed: Record<number, string>;
  selected: Set<number>;
  onToggle: (v: EnvVar) => void; onCopy: (v: EnvVar) => void;
  onEdit: (v: EnvVar) => void; onDelete: (v: EnvVar) => void;
  onSelect: (id: number) => void; onHistory: (v: EnvVar) => void;
}) {
  return (
    <>
      <tr><td colSpan={4} className="env-group-label">{group}</td></tr>
      {items.map((item) => {
        const shown = revealed[item.id] !== undefined;
        const display = shown ? revealed[item.id] : item.valueMasked;
        return (
          <tr key={item.id}>
            <td className="td-center"><input type="checkbox" className="checkbox" checked={selected.has(item.id)} onChange={() => onSelect(item.id)} aria-label="선택" /></td>
            <td><span className="env-key">{item.key}</span></td>
            <td>
              <div className="env-value-wrap">
                <span className={`env-value${shown ? '' : ' masked'}`}>{display}</span>
                <button type="button" className="icon-btn" onClick={() => onToggle(item)} aria-label="값 표시/숨김">
                  <IconEye width={13} height={13} />
                </button>
                <button type="button" className="icon-btn" onClick={() => onCopy(item)} aria-label="값 복사">
                  <IconCopy width={13} height={13} />
                </button>
              </div>
            </td>
            <td className="td-center">
              <div className="flex justify-center gap-1">
                <button type="button" className="icon-btn-bordered" onClick={() => onEdit(item)} aria-label="수정">
                  <IconEdit width={14} height={14} />
                </button>
                <button type="button" className="icon-btn-bordered" onClick={() => onHistory(item)} aria-label="변경 이력">
                  <IconClock width={14} height={14} />
                </button>
                <button type="button" className="icon-btn-danger" onClick={() => onDelete(item)} aria-label="삭제">
                  <IconTrash width={14} height={14} />
                </button>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

// 프로젝트 추가·수정 모달
function ProjectModal({ state, onClose, onSaved }: { state: { open: boolean; editing: EnvProject | null }; onClose: () => void; onSaved: () => void }) {
  const editing = state.editing;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!state.open) return;
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
  }, [state.open, editing]);

  async function handleSave() {
    if (!name.trim()) { setErrors({ name: '프로젝트명을 입력하세요.' }); return; }
    const body = { name: name.trim(), description: description || undefined };
    setSaving(true);
    try {
      if (editing) await api.put(`/env-projects/${editing.id}`, body);
      else await api.post('/env-projects', body);
      notify.upserted(editing ? 'edit' : 'add', '프로젝트');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={editing ? '프로젝트 수정' : '프로젝트 추가'} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}>
      <Field label="프로젝트명" required error={errors.name}>
        <input type="text" className={`input${errors.name ? ' is-invalid' : ''}`} placeholder="예: my-project" value={name} onChange={(e) => { setName(e.target.value); clearError('name'); }} />
      </Field>
      <Field label="설명 (선택)"><input type="text" className="input" placeholder="프로젝트 간단 설명" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
    </Modal>
  );
}

// 변수 추가·수정 모달 (추가는 적용 환경 다중 선택, 수정은 환경 고정)
function VarModal({ state, projectId, currentEnv, onClose, onSaved }: { state: { open: boolean; editing: EnvVar | null }; projectId: number | null; currentEnv: EnvKind; onClose: () => void; onSaved: () => void }) {
  const editing = state.editing;
  const [group, setGroup] = useState('');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [memo, setMemo] = useState('');
  const [envs, setEnvs] = useState<EnvKind[]>([currentEnv]);
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!state.open) return;
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setGroup(editing?.group ?? '');
    setKey(editing?.key ?? '');
    setValue('');
    setMemo(editing?.memo ?? '');
    setEnvs([editing?.env ?? currentEnv]);
  }, [state.open, editing, currentEnv]);

  function toggleEnv(e: EnvKind) {
    setEnvs((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  async function handleSave() {
    const err: Record<string, string> = {};
    if (!key.trim()) err.key = 'KEY를 입력하세요.';
    if (!editing && !value.trim()) err.value = 'VALUE를 입력하세요.';
    if (!editing && envs.length === 0) err.envs = '적용 환경을 1개 이상 선택하세요.';
    setErrors(err);
    if (Object.keys(err).length) return;

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/env-vars/${editing.id}`, {
          group: group || '',
          key: key.trim(),
          ...(value.trim() ? { value } : {}),
          memo: memo || '',
        });
      } else {
        await api.post(`/env-projects/${projectId}/vars`, {
          envs, group: group || undefined, key: key.trim(), value, memo: memo || undefined,
        });
      }
      notify.upserted(editing ? 'edit' : 'add', '변수');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={editing ? '변수 수정' : '변수 추가'} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} saveLabel="저장 (암호화)" />}>
      <Field label="그룹 (선택)">
        <select className="input" aria-label="그룹" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">없음</option>
          {ENV_GROUPS.map((g) => <option key={g}>{g}</option>)}
        </select>
      </Field>
      <Field label="KEY" required error={errors.key}>
        <input type="text" className={`input input-mono${errors.key ? ' is-invalid' : ''}`} placeholder="예: DATABASE_URL" value={key} onChange={(e) => { setKey(e.target.value); clearError('key'); }} />
      </Field>
      <Field label={editing ? 'VALUE (변경 시에만 입력)' : 'VALUE'} required={!editing} error={errors.value}>
        <input type="text" className={`input input-mono${errors.value ? ' is-invalid' : ''}`} placeholder={editing ? '비워두면 기존 값 유지' : '값 입력'} value={value} onChange={(e) => { setValue(e.target.value); clearError('value'); }} />
      </Field>
      {editing ? (
        <Field label="적용 환경">
          <div className="text-[0.84rem] text-secondary px-3 py-2 bg-surface border border-border rounded-[var(--radius)]">{editing.env}</div>
        </Field>
      ) : (
        <Field label="적용 환경" required error={errors.envs}>
          <div className="flex gap-3 flex-wrap">
            {ENV_TABS.map((t) => (
              <label key={t.key} className="flex items-center gap-1.5 text-[0.855rem] cursor-pointer">
                <input type="checkbox" className="accent-accent" checked={envs.includes(t.key)} onChange={() => toggleEnv(t.key)} /> {t.label}
              </label>
            ))}
          </div>
        </Field>
      )}
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="변수 설명" value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
    </Modal>
  );
}

// 변수 값 변경 이력 모달 — 이전 값(마스킹) 목록 + 롤백
function HistoryModal({ envVar, onClose, onRolledBack, confirm }: {
  envVar: EnvVar | null;
  onClose: () => void;
  onRolledBack: () => void;
  confirm: (msg: string, variant?: 'danger' | 'primary') => Promise<boolean>;
}) {
  const [list, setList] = useState<EnvVarHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // 모달 열릴 때 이력 조회
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 대상 변수 변경 시 이력 목록 초기화
    if (!envVar) { setList([]); return; }
    setLoading(true);
    api.get<EnvVarHistoryEntry[]>(`/env-vars/${envVar.id}/history`)
      .then(setList)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [envVar]);

  // 선택 이력 값으로 롤백
  async function rollback(historyId: number) {
    if (!envVar) return;
    if (!await confirm('이 값으로 되돌릴까요? 현재 값은 이력에 보관됩니다.', 'primary')) return;
    try {
      await api.post(`/env-vars/${envVar.id}/rollback/${historyId}`, {});
      notify.success('이전 값으로 되돌렸습니다.');
      onRolledBack();
    } catch (e) {
      notify.error((e as Error).message);
    }
  }

  if (!envVar) return null;

  return (
    <Modal open={!!envVar} onClose={onClose} title={`변경 이력 — ${envVar.key}`} footer={<Button variant="ghost" onClick={onClose}>닫기</Button>}>
      {loading ? (
        <div className="py-6 text-center text-muted text-[0.84rem]">불러오는 중...</div>
      ) : list.length === 0 ? (
        <div className="py-6 text-center text-muted text-[0.84rem]">변경 이력이 없습니다. 값을 수정하면 이전 값이 여기에 쌓입니다.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((h) => (
            <div key={h.id} className="flex items-center gap-2 bg-surface border border-border rounded-[var(--radius)] px-3 py-2.5">
              <span className="flex-1 [font-family:var(--font-mono)] text-[0.82rem] text-muted truncate">{h.valueMasked}</span>
              <span className="text-[0.72rem] text-muted shrink-0">{h.changedAt.slice(0, 16).replace('T', ' ')}</span>
              <Button variant="ghost" size="sm" onClick={() => rollback(h.id)}>되돌리기</Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
