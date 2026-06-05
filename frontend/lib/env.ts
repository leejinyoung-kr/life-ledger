/**
 * ENV 보관함 공통 타입 · .env 직렬화.
 * 백엔드 응답 DTO(/env-projects, /env-vars)와 1:1 대응한다. 값 원문은 reveal/export API 로만 받는다.
 */

export type EnvKind = 'dev' | 'staging' | 'prod';

export interface EnvProject {
  id: number;
  name: string;
  description: string | null;
  counts: Record<EnvKind, number>;
  totalVars: number;
  updatedAt: string;
}

export interface EnvVar {
  id: number;
  env: EnvKind;
  group: string | null;
  key: string;
  valueMasked: string;
  memo: string | null;
}

export interface ExportVar {
  key: string;
  value: string;
  group: string | null;
}

export interface EnvDiff {
  base: EnvKind;
  target: EnvKind;
  onlyInBase: string[];
  onlyInTarget: string[];
  valueMismatch: string[];
  identical: boolean;
}

export const ENV_TABS: { key: EnvKind; label: string }[] = [
  { key: 'dev', label: 'development' },
  { key: 'staging', label: 'staging' },
  { key: 'prod', label: 'production' },
];

// 환경 탭 점 색
export const ENV_DOT: Record<EnvKind, string> = {
  dev: 'bg-accent', staging: 'bg-warning', prod: 'bg-danger',
};

export const ENV_GROUPS = ['Database', 'Auth', 'Storage', 'API Keys', 'App'];

// 변수 목록을 그룹 순서를 유지하며 그룹별로 묶기
export function groupVars(vars: EnvVar[]): { group: string; items: EnvVar[] }[] {
  return vars.reduce<{ group: string; items: EnvVar[] }[]>((acc, v) => {
    const g = v.group || '기타';
    const found = acc.find((x) => x.group === g);
    if (found) found.items.push(v);
    else acc.push({ group: g, items: [v] });
    return acc;
  }, []);
}

// 변수 목록(마스킹된 키만 사용)을 .env.example 텍스트로 직렬화 (값 비움)
export function toEnvExample(name: string, vars: EnvVar[]): string {
  let text = `# ${name} - .env.example (값 제외)\n`;
  let lastGroup = '';
  for (const v of vars) {
    const g = v.group || '';
    if (g && g !== lastGroup) { text += `\n# ${g}\n`; lastGroup = g; }
    text += `${v.key}=\n`;
  }
  return text;
}

// export 변수 목록을 .env 텍스트로 직렬화 (그룹별 주석 포함)
export function toEnvText(name: string, env: EnvKind, vars: ExportVar[]): string {
  let text = `# ${name} - ${env}\n`;
  let lastGroup = '';
  for (const v of vars) {
    const g = v.group || '';
    if (g && g !== lastGroup) { text += `\n# ${g}\n`; lastGroup = g; }
    text += `${v.key}=${v.value}\n`;
  }
  return text;
}
