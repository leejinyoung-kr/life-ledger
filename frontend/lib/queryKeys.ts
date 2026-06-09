/**
 * React Query 쿼리 키 팩토리.
 * 키를 한 곳에 모아 무효화(invalidateQueries) 시 오타·불일치를 막는다.
 * 사용: useApiQuery(qk.credentials.list(), '/credentials')
 *      invalidate(qk.credentials.all)  // 계정 관련 전체 무효화
 */
export const qk = {
  dashboard: {
    summary: () => ['dashboard', 'summary'] as const,
    forecast: () => ['dashboard', 'forecast'] as const,
    deadlines: () => ['dashboard', 'deadlines'] as const,
  },
  settings: {
    all: ['settings'] as const,
    detail: () => ['settings'] as const,
  },
  credentials: {
    all: ['credentials'] as const,
    list: () => ['credentials', 'list'] as const,
    backupCodes: (id: number) => ['credentials', id, 'backup-codes'] as const,
  },
  env: {
    all: ['env'] as const,
    projects: () => ['env', 'projects'] as const,
    vars: (projectId: number, env: string) => ['env', 'vars', projectId, env] as const,
    history: (varId: number) => ['env', 'history', varId] as const,
    diff: (projectId: number, base: string, target: string) => ['env', 'diff', projectId, base, target] as const,
  },
  identity: {
    all: ['identity'] as const,
    list: () => ['identity', 'list'] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    list: (params?: unknown) => ['transactions', 'list', params ?? null] as const,
    summary: (month?: string) => ['transactions', 'summary', month ?? null] as const,
    monthlyTrend: (month?: string) => ['transactions', 'trend', month ?? null] as const,
    recurring: () => ['transactions', 'recurring'] as const,
  },
  savings: { all: ['savings'] as const, list: () => ['savings', 'list'] as const },
  investments: { all: ['investments'] as const, list: () => ['investments', 'list'] as const },
  subscriptions: { all: ['subscriptions'] as const, list: () => ['subscriptions', 'list'] as const },
  assets: { all: ['assets'] as const, list: () => ['assets', 'list'] as const, networth: () => ['assets', 'networth'] as const },
  tasks: { all: ['tasks'] as const, list: () => ['tasks', 'list'] as const, goals: () => ['tasks', 'goals'] as const },
  notes: { all: ['notes'] as const, list: () => ['notes', 'list'] as const },
  calendar: { all: ['calendar'] as const, list: (month?: string) => ['calendar', month ?? null] as const },
  notifications: { all: ['notifications'] as const, list: () => ['notifications', 'list'] as const, unread: () => ['notifications', 'unread'] as const },
  trash: { all: ['trash'] as const, list: () => ['trash', 'list'] as const },
  files: { all: ['files'] as const, list: (folderId?: number) => ['files', folderId ?? 'root'] as const },
  security: {
    all: ['security'] as const,
    summary: () => ['security', 'summary'] as const,
    risks: () => ['security', 'risks'] as const,
    sessions: () => ['security', 'sessions'] as const,
    scoreTrend: (days: number) => ['security', 'score-trend', days] as const,
    accessLogs: (limit: number) => ['security', 'access-logs', limit] as const,
    strengthStats: () => ['security', 'strength-stats'] as const,
    breach: () => ['security', 'breach'] as const,
    vault: () => ['security', 'vault'] as const,
  },
  categories: { all: ['categories'] as const },
  aiReports: { all: ['ai-reports'] as const, list: () => ['ai-reports', 'list'] as const },
} as const;
