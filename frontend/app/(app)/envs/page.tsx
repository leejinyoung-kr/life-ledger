'use client';

/**
 * ENV 보관함 페이지.
 * 프로젝트별 환경변수를 dev/staging/prod 환경 탭으로 나눠 암호화 관리한다.
 * 값 마스킹·복사·.env 일괄 복사/다운로드·붙여넣기 파싱을 지원하며, 데이터는 더미로 채운다.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import {
  IconCode, IconFileBlank, IconEdit, IconPlus, IconCopy, IconEye,
  IconTrash, IconDownload, IconCheck,
} from '@/components/icons';

type EnvKey = 'dev' | 'staging' | 'prod';

interface EnvVar { group: string; key: string; value: string; masked: boolean; }
interface Project { emoji: string; name: string; envs: Partial<Record<EnvKey, EnvVar[]>>; }

// ── 더미 데이터 (TODO: GET /api/v1/env-projects) ────────────────
const PROJECTS: Project[] = [
  {
    emoji: '🚀', name: 'doc-nexus',
    envs: {
      dev: [
        { group: 'Database', key: 'DATABASE_URL', value: 'mysql://root:root@localhost:3306/doc_nexus', masked: true },
        { group: 'Database', key: 'DATABASE_HOST', value: 'localhost', masked: false },
        { group: 'Auth', key: 'JWT_SECRET', value: 'dev_jwt_secret_key_very_long', masked: true },
        { group: 'Auth', key: 'CREDENTIAL_SECRET', value: 'dev_aes_secret_32bytes_key!!', masked: true },
        { group: 'Auth', key: 'GOOGLE_CLIENT_ID', value: '1234567890-abcdef.apps.googleusercontent.com', masked: false },
        { group: 'Auth', key: 'GOOGLE_CLIENT_SECRET', value: 'GOCSPX-xxxxxxxxxxxxxxxx', masked: true },
        { group: 'Storage', key: 'R2_BUCKET', value: 'doc-nexus-dev', masked: false },
        { group: 'Storage', key: 'R2_ENDPOINT', value: 'https://xxxx.r2.cloudflarestorage.com', masked: false },
        { group: 'Storage', key: 'R2_ACCESS_KEY', value: 'dev_r2_access_key', masked: true },
        { group: 'Storage', key: 'R2_SECRET_KEY', value: 'dev_r2_secret_key', masked: true },
        { group: 'API Keys', key: 'CLAUDE_API_KEY', value: 'sk-ant-api03-xxxxxxxxxx', masked: true },
        { group: 'App', key: 'PORT', value: '3001', masked: false },
        { group: 'App', key: 'NODE_ENV', value: 'development', masked: false },
        { group: 'App', key: 'FRONTEND_URL', value: 'http://localhost:3000', masked: false },
      ],
      prod: [
        { group: 'Database', key: 'DATABASE_URL', value: 'mysql://prod_user:****@railway.internal/doc_nexus', masked: true },
        { group: 'Auth', key: 'JWT_SECRET', value: 'prod_jwt_secret_very_secure_key', masked: true },
        { group: 'Auth', key: 'CREDENTIAL_SECRET', value: 'prod_aes_secret_32bytes_key!!', masked: true },
        { group: 'Auth', key: 'GOOGLE_CLIENT_ID', value: '1234567890-abcdef.apps.googleusercontent.com', masked: false },
        { group: 'Auth', key: 'GOOGLE_CLIENT_SECRET', value: 'GOCSPX-xxxxxxxxxxxxxxxx', masked: true },
        { group: 'Storage', key: 'R2_BUCKET', value: 'doc-nexus-prod', masked: false },
        { group: 'Storage', key: 'R2_ACCESS_KEY', value: 'prod_r2_access_key', masked: true },
        { group: 'Storage', key: 'R2_SECRET_KEY', value: 'prod_r2_secret_key', masked: true },
        { group: 'API Keys', key: 'CLAUDE_API_KEY', value: 'sk-ant-api03-xxxxxxxxxx', masked: true },
        { group: 'App', key: 'PORT', value: '3001', masked: false },
        { group: 'App', key: 'NODE_ENV', value: 'production', masked: false },
        { group: 'App', key: 'FRONTEND_URL', value: 'https://doc-nexus.vercel.app', masked: false },
      ],
    },
  },
  {
    emoji: '🛒', name: 'shop-admin',
    envs: {
      dev: [
        { group: 'Database', key: 'DATABASE_URL', value: 'mysql://root:root@localhost:3306/shop', masked: true },
        { group: 'Auth', key: 'JWT_SECRET', value: 'shop_dev_jwt_secret', masked: true },
        { group: 'App', key: 'PORT', value: '4000', masked: false },
      ],
      prod: [
        { group: 'Database', key: 'DATABASE_URL', value: 'mysql://prod:****@railway.internal/shop', masked: true },
        { group: 'Auth', key: 'JWT_SECRET', value: 'shop_prod_jwt_secret', masked: true },
        { group: 'App', key: 'PORT', value: '4000', masked: false },
      ],
    },
  },
  {
    emoji: '🤖', name: 'ai-chatbot',
    envs: {
      dev: [
        { group: 'API Keys', key: 'CLAUDE_API_KEY', value: 'sk-ant-api03-yyyyyy', masked: true },
        { group: 'App', key: 'PORT', value: '5000', masked: false },
        { group: 'App', key: 'NODE_ENV', value: 'development', masked: false },
      ],
    },
  },
];

const ENV_TABS: { key: EnvKey; label: string }[] = [
  { key: 'dev', label: 'development' },
  { key: 'staging', label: 'staging' },
  { key: 'prod', label: 'production' },
];

// 프로젝트의 전체 변수 개수 (모든 환경 합산)
function totalVarCount(p: Project) {
  return Object.values(p.envs).reduce((sum, list) => sum + (list?.length ?? 0), 0);
}

// 변수 목록을 .env 텍스트로 직렬화 (그룹별 주석 포함)
function toEnvText(name: string, env: EnvKey, vars: EnvVar[]) {
  let text = `# ${name} - ${env}\n\n`;
  let lastGroup = '';
  for (const v of vars) {
    if (v.group && v.group !== lastGroup) {
      text += `\n# ${v.group}\n`;
      lastGroup = v.group;
    }
    text += `${v.key}=${v.value}\n`;
  }
  return text;
}

export default function EnvsPage() {
  const [projectIdx, setProjectIdx] = useState(0);
  const [env, setEnv] = useState<EnvKey>('dev');
  const [visible, setVisible] = useState<Record<string, boolean>>({}); // uid → 값 표시 여부
  const [paste, setPaste] = useState('');
  const [projectModal, setProjectModal] = useState<{ open: boolean; mode: 'add' | 'edit' }>({ open: false, mode: 'add' });
  const [envModal, setEnvModal] = useState<{ open: boolean; mode: 'add' | 'edit' }>({ open: false, mode: 'add' });
  const hideTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // 언마운트 시 모든 자동 숨김 타이머 정리
  useEffect(() => {
    const timers = hideTimers.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, []);

  // 프로젝트 전환 — 환경/표시상태 초기화
  function selectProject(idx: number) {
    setProjectIdx(idx);
    setEnv('dev');
    setVisible({});
  }

  // 마스킹 값 표시/숨김 토글 — 표시 시 10초 뒤 자동 숨김
  function toggleValue(uid: string) {
    setVisible((prev) => {
      const next = !prev[uid];
      if (hideTimers.current[uid]) clearTimeout(hideTimers.current[uid]);
      if (next) {
        hideTimers.current[uid] = setTimeout(() => {
          setVisible((p) => ({ ...p, [uid]: false }));
        }, 10000);
      }
      return { ...prev, [uid]: next };
    });
  }

  // 클립보드 복사. TODO: 복사 완료 토스트 등 피드백 추가
  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // 현재 환경 변수를 .env 파일로 다운로드
  function downloadEnv() {
    const text = toEnvText(project.name, env, vars);
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `.${env}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // 붙여넣은 .env 텍스트를 KEY=VALUE 로 파싱. TODO: 파싱 결과 암호화 저장 API 연동
  function parsePaste() {
    const parsed = paste
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const eq = l.indexOf('=');
        return { key: l.slice(0, eq).trim(), value: l.slice(eq + 1).trim() };
      })
      .filter((p) => p.key);
    if (!parsed.length) return;
    // 실제 구현 시 서버에서 암호화 후 저장
    setPaste('');
  }

  const project = PROJECTS[projectIdx];
  const vars = project.envs[env] ?? [];

  // 변수 목록을 그룹 순서를 유지하며 그룹별로 묶기
  const grouped = vars.reduce<{ group: string; items: EnvVar[] }[]>((acc, v) => {
    const g = v.group || '기타';
    const found = acc.find((x) => x.group === g);
    if (found) found.items.push(v);
    else acc.push({ group: g, items: [v] });
    return acc;
  }, []);

  return (
    <AppShell
      activePath="/envs"
      topbarLabel="ENV 보관함"
      actionLabel="프로젝트 추가"
      onAction={() => setProjectModal({ open: true, mode: 'add' })}
    >
      <div className="page-header">
        <h1 className="page-title">ENV 보관함</h1>
        <p className="page-subtitle">프로젝트별 환경변수를 암호화하여 관리합니다. (AES-256-GCM)</p>
      </div>

      <div className="env-layout">
        {/* 프로젝트 목록 */}
        <div className="project-panel">
          <div className="project-panel-header">
            <span className="project-panel-title">프로젝트</span>
            <span className="badge badge-neutral">{PROJECTS.length}개</span>
          </div>
          <div className="project-list">
            {PROJECTS.map((p, idx) => (
              <button
                type="button"
                key={p.name}
                className={`project-item${idx === projectIdx ? ' active' : ''}`}
                onClick={() => selectProject(idx)}
              >
                <div className="project-icon">{p.emoji}</div>
                <div>
                  <div className="project-name">{p.name}</div>
                  <div className="project-env-count">변수 {totalVarCount(p)}개 · {Object.keys(p.envs).join('/')}</div>
                </div>
              </button>
            ))}
          </div>
          <button type="button" className="project-add-btn" onClick={() => setProjectModal({ open: true, mode: 'add' })}>
            <IconPlus width={14} height={14} />새 프로젝트
          </button>
        </div>

        {/* 환경변수 편집 패널 */}
        <div className="env-editor-panel">
          {/* 프로젝트 헤더 + 액션 */}
          <div className="proj-head">
            <div className="proj-head-main">
              <span className="proj-emoji">{project.emoji}</span>
              <div>
                <div className="proj-name">{project.name}</div>
                <div className="proj-sub">AES-256-GCM 암호화 · {totalVarCount(project)}개 변수</div>
              </div>
            </div>
            <div className="proj-actions">
              {/* TODO: dev/prod 환경 diff 비교 기능 */}
              <button type="button" className="btn btn-ghost"><IconCode width={13} height={13} />환경 비교</button>
              {/* TODO: .env.example 생성 (값 비우고 키만) */}
              <button type="button" className="btn btn-ghost"><IconFileBlank width={13} height={13} />.env.example</button>
              <button type="button" className="btn btn-ghost" onClick={() => setProjectModal({ open: true, mode: 'edit' })}>
                <IconEdit width={13} height={13} />수정
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setEnvModal({ open: true, mode: 'add' })}>
                <IconPlus width={13} height={13} />변수 추가
              </button>
            </div>
          </div>

          {/* 환경 탭 + 변수 테이블 + 전체 복사 바 */}
          <div className="card flush">
            <div className="env-tabs">
              {ENV_TABS.map((t) => (
                <button type="button" key={t.key} className={`env-tab${env === t.key ? ' active' : ''}`} onClick={() => { setEnv(t.key); setVisible({}); }}>
                  <span className={`env-dot ${t.key}`} />{t.label}
                </button>
              ))}
            </div>

            <table className="env-table">
              <thead>
                <tr>
                  <th className="env-th-key">KEY</th>
                  <th>VALUE</th>
                  <th className="env-th-action">액션</th>
                </tr>
              </thead>
              <tbody>
                {vars.length === 0 ? (
                  <tr><td colSpan={3} className="env-empty">이 환경에 변수가 없습니다.</td></tr>
                ) : (
                  grouped.map((g) => (
                    <EnvGroupRows
                      key={g.group}
                      group={g.group}
                      items={g.items}
                      env={env}
                      visible={visible}
                      onToggle={toggleValue}
                      onCopy={copy}
                      onEdit={() => setEnvModal({ open: true, mode: 'edit' })}
                    />
                  ))
                )}
              </tbody>
            </table>

            <div className="copy-all-bar">
              <span className="copy-all-hint">.env 파일 형식으로 전체 복사</span>
              <button type="button" className="btn btn-ghost" onClick={() => copy(toEnvText(project.name, env, vars))}>
                <IconCopy width={13} height={13} />전체 복사
              </button>
              <button type="button" className="btn btn-ghost" onClick={downloadEnv}>
                <IconDownload width={13} height={13} />.env 다운로드
              </button>
            </div>
          </div>

          {/* 일괄 붙여넣기 */}
          <div className="paste-zone">
            <div className="paste-zone-label">
              <IconCode width={14} height={14} />.env 파일 내용 붙여넣기 (일괄 저장)
            </div>
            <textarea
              className="paste-textarea"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={'# .env 내용을 그대로 붙여넣으세요\nDATABASE_URL=mysql://root:root@localhost:3306/doc_nexus\nJWT_SECRET=your_jwt_secret\nCLAUDE_API_KEY=sk-ant-...'}
              aria-label=".env 붙여넣기"
            />
            <div className="paste-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPaste('')}>초기화</button>
              <button type="button" className="btn btn-primary" onClick={parsePaste}>
                <IconCheck width={13} height={13} />파싱 후 저장
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 모달 */}
      <ProjectModal state={projectModal} onClose={() => setProjectModal((s) => ({ ...s, open: false }))} />
      <EnvModal state={envModal} onClose={() => setEnvModal((s) => ({ ...s, open: false }))} />
    </AppShell>
  );
}

// 변수 그룹 헤더 + 변수 행들
function EnvGroupRows({
  group, items, env, visible, onToggle, onCopy, onEdit,
}: {
  group: string; items: EnvVar[]; env: EnvKey;
  visible: Record<string, boolean>;
  onToggle: (uid: string) => void; onCopy: (text: string) => void; onEdit: () => void;
}) {
  return (
    <>
      <tr><td colSpan={3} className="env-group-label">{group}</td></tr>
      {items.map((item) => {
        const uid = `${env}_${item.key}`;
        const shown = visible[uid] || false;
        const display = item.masked && !shown ? '•'.repeat(Math.min(item.value.length, 20)) : item.value;
        return (
          <tr key={item.key}>
            <td><span className="env-key">{item.key}</span></td>
            <td>
              <div className="env-value-wrap">
                <span className={`env-value${item.masked && !shown ? ' masked' : ''}`}>{display}</span>
                {item.masked && (
                  <button type="button" className="icon-btn" onClick={() => onToggle(uid)} aria-label="값 표시/숨김">
                    <IconEye width={13} height={13} />
                  </button>
                )}
                <button type="button" className="icon-btn" onClick={() => onCopy(item.value)} aria-label="값 복사">
                  <IconCopy width={13} height={13} />
                </button>
              </div>
            </td>
            <td className="td-center">
              <div className="row-actions">
                <button type="button" className="btn btn-ghost btn-icon" onClick={onEdit} aria-label="수정">
                  <IconEdit width={14} height={14} />
                </button>
                <button type="button" className="btn btn-danger btn-icon" aria-label="삭제">
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

// 환경 적용 체크박스 그룹 (dev/staging/prod)
function EnvFlags() {
  return (
    <div className="env-flags">
      <label className="env-flag"><input type="checkbox" defaultChecked className="chk-dev" /> dev</label>
      <label className="env-flag"><input type="checkbox" className="chk-staging" /> staging</label>
      <label className="env-flag"><input type="checkbox" defaultChecked className="chk-prod" /> prod</label>
    </div>
  );
}

// 프로젝트 추가·수정 모달
function ProjectModal({ state, onClose }: { state: { open: boolean; mode: 'add' | 'edit' }; onClose: () => void }) {
  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={state.mode === 'edit' ? '프로젝트 수정' : '프로젝트 추가'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>취소</button>
          {/* TODO: API 연동 — 저장(POST/PUT) 처리 */}
          <button type="button" className="btn btn-primary">저장</button>
        </>
      }
    >
      <Field label="이모지"><input type="text" className="input w-emoji" placeholder="🚀" /></Field>
      <Field label="프로젝트명"><input type="text" className="input" placeholder="예: my-project" /></Field>
      <Field label="설명 (선택)"><input type="text" className="input" placeholder="프로젝트 간단 설명" /></Field>
      <div className="input-group">
        <span className="input-label">환경</span>
        <div className="env-flags">
          <label className="env-flag"><input type="checkbox" defaultChecked className="chk-dev" /> development</label>
          <label className="env-flag"><input type="checkbox" className="chk-staging" /> staging</label>
          <label className="env-flag"><input type="checkbox" defaultChecked className="chk-prod" /> production</label>
        </div>
      </div>
    </Modal>
  );
}

// 변수 추가·수정 모달
function EnvModal({ state, onClose }: { state: { open: boolean; mode: 'add' | 'edit' }; onClose: () => void }) {
  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={state.mode === 'edit' ? '변수 수정' : '변수 추가'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>취소</button>
          {/* TODO: API 연동 — 저장 시 서버에서 AES-256-GCM 암호화 후 저장 */}
          <button type="button" className="btn btn-primary">저장 (암호화)</button>
        </>
      }
    >
      <Field label="그룹 (선택)">
        <select className="input" aria-label="그룹">
          <option value="">없음</option>
          <option>Database</option><option>Auth</option><option>Storage</option>
          <option>API Keys</option><option>App</option>
        </select>
      </Field>
      <Field label="KEY"><input type="text" className="input input-mono" placeholder="예: DATABASE_URL" /></Field>
      <Field label="VALUE"><input type="text" className="input input-mono" placeholder="값 입력" /></Field>
      <div className="input-group">
        <span className="input-label">적용 환경</span>
        <EnvFlags />
      </div>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="변수 설명" /></Field>
    </Modal>
  );
}

// 입력 그룹 (라벨 + 입력요소). label 로 감싸 입력요소에 접근성 이름을 연결한다.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="input-group">
      <span className="input-label">{label}</span>
      {children}
    </label>
  );
}
