'use client';

/**
 * 계정 보관함 페이지.
 * 저장된 계정(아이디/비밀번호)을 표로 보고, 행 클릭 시 상세 모달에서 마스킹·복사한다.
 * 비밀번호/TOTP 원문은 reveal API 로만 받아오며, 데이터는 백엔드(/credentials)와 연동한다.
 */
import { useEffect, useMemo, useState } from 'react';
import { notify, copyToClipboard } from '@/lib/toast';
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import ErrorBanner from '@/components/ErrorBanner';
import FilterPanel from '@/components/FilterPanel';
import Pagination, { LimitSelect } from '@/components/Pagination';
import ConfirmModal, { useConfirm } from '@/components/ConfirmModal';
import Button from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput';
import IconButton from '@/components/ui/IconButton';
import { usePagination } from '@/lib/usePagination';
import { useRowSelection } from '@/lib/useRowSelection';
import { IconEdit, IconTrash, IconCopy, IconAlertTriangle, IconPlus } from '@/components/icons';
import { api, apiDownload } from '@/lib/api';
import { fmtCredDate, type Credential } from '@/lib/credential';
import type { Settings } from '@/lib/settings';
import MobileCard, { MobileCardList } from '@/components/MobileCard';
import TableEmptyRow from '@/components/TableEmptyRow';
import ExcelToolbar from '@/components/ExcelToolbar';
import ListToolbar from '@/components/ListToolbar';
import ServiceTile, { TwoFaMark } from './ServiceTile';
import VaultStrip from './VaultStrip';
import DetailModal from './DetailModal';
import EditModal, { type EditState } from './EditModal';
import { useCredentialCategories } from './useCredentialCategories';

// 평문 엑셀을 받기 전에 그대로 입력해야 하는 낱말 (실수로 누르는 것 막기)
const EXPORT_WORD = '내려받기';

export default function CredentialsPage() {
  const [pendingQuery, setPendingQuery] = useState('');
  const [pendingCategory, setPendingCategory] = useState('전체');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('전체');
  const [detail, setDetail] = useState<Credential | null>(null);
  const [edit, setEdit] = useState<EditState>({ open: false, mode: 'add', editing: null });
  const [exportOpen, setExportOpen] = useState(false);
  const [exportWord, setExportWord] = useState('');
  const [exporting, setExporting] = useState(false);
  const { page, setPage, limit, changeLimit } = usePagination();
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();
  const categories = useCredentialCategories();

  // 조회 버튼(또는 Enter) 클릭 시에만 실제 필터에 반영
  function handleSearch() {
    setQuery(pendingQuery);
    setCategory(pendingCategory);
    setPage(1);
  }

  // 계정 목록 (React Query 캐시) — 검색/카테고리/페이지를 서버로 전송
  const listQs = useMemo(() => {
    const params = new URLSearchParams();
    const q = query.trim();
    if (q) params.set('q', q);
    if (category !== '전체') params.set('category', category);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [query, category, page, limit]);
  const listQuery = useApiQuery<Paginated<Credential> & { no2fa: number }>(
    qk.credentials.list({ q: query.trim(), category, page, limit }),
    `/credentials?${listQs}`,
  );
  // 비밀번호 자동 숨김 시간 설정값 — 상세 모달에 전달
  const settingsQuery = useApiQuery<Settings>(qk.settings.detail(), '/settings');
  const pwAutoHide = settingsQuery.data?.pwAutoHide;
  const rows = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const total = listQuery.data?.total ?? 0;
  const no2fa = listQuery.data?.no2fa ?? 0;
  const error = listQuery.error?.message ?? null;
  // 목록 갱신 단축 — 변이 후 호출
  const reload = () => invalidate(qk.credentials.all);

  // 보안센터에서 ?focus=<id> 로 진입 시 해당 계정을 단건 조회해 상세 자동 열기 (위험 항목 → 계정 바로가기)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const focusId = Number(new URLSearchParams(window.location.search).get('focus'));
    if (!focusId) return;
    api.get<Credential>(`/credentials/${focusId}`).then(setDetail).catch(() => {});
    // 한 번 열고 쿼리 제거 (재오픈 방지)
    window.history.replaceState(null, '', '/credentials');
  }, []);

  const totalPages = Math.ceil(total / limit);
  const paged = rows; // 서버가 이미 필터+페이지 단위로 잘라서 보냄
  const { selected, toggle, toggleAll, clear, allChecked } = useRowSelection(paged.map((x) => x.id));

  // 계정 삭제
  async function handleRemove(c: Credential) {
    if (!await confirm(`'${c.name}' 계정을 삭제할까요?`, 'danger')) return;
    try {
      await api.del(`/credentials/${c.id}`);
      notify.deleted('계정');
      setDetail(null);
      clear();
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  async function handleRemoveSelected() {
    if (selected.size === 0) return;
    if (!await confirm(`선택한 ${selected.size}건을 삭제할까요?`, 'danger')) return;
    try {
      await api.del('/credentials/bulk', { ids: [...selected] });
      notify.deleted(`${selected.size}건`);
      clear();
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  // 엑셀 양식 다운로드
  async function handleDownloadTemplate() {
    try { await apiDownload('/credentials/template', '계정양식.xlsx'); notify.excelDownloaded(); }
    catch { notify.error('양식 다운로드에 실패했습니다.'); }
  }

  // 계정 데이터 엑셀 다운로드 준비 — 비밀번호가 평문으로 포함되므로 낱말을 입력받는 확인 창을 띄운다
  function handleDownloadDataAsk() {
    setExportWord('');
    setExportOpen(true);
  }

  // 평문 엑셀 내려받기 실행
  async function handleDownloadData() {
    setExporting(true);
    try {
      await apiDownload('/credentials/export', '계정.xlsx');
      notify.excelDownloaded();
      setExportOpen(false);
    } catch {
      notify.error('다운로드에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  }

  // 엑셀 업로드 → 일괄 추가
  async function handleUploadExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const r = await api.upload<{ imported: number; failed: number }>('/credentials/import', file);
      if (r.failed) notify.excelPartial(r.imported, r.failed);
      else notify.excelUploaded(r.imported);
      reload();
    } catch (err) {
      notify.error((err as Error).message);
    }
  }

  const openEdit = (c: Credential) => setEdit({ open: true, mode: 'edit', editing: c });

  return (
    <AppShell activePath="/credentials">
      <PageHeader
        title="계정 보관함"
        description="비밀번호와 2FA 시크릿은 AES-256-GCM 으로 암호화되어 있고, 열 때마다 기록됩니다. 행을 누르면 상세 정보를 봅니다."
        actions={<Button onClick={() => setEdit({ open: true, mode: 'add', editing: null })}><IconPlus />계정 추가</Button>}
      />

      <VaultStrip />

      <ErrorBanner message={error} className="mb-4" />

      <FilterPanel className="mb-3">
        <div className="flex gap-2 items-center">
          <select className="input w-24 shrink-0 md:w-auto md:min-w-40" value={pendingCategory} onChange={(e) => setPendingCategory(e.target.value)} aria-label="카테고리 필터">
            {['전체', ...categories].map((c) => <option key={c}>{c}</option>)}
          </select>
          <SearchInput label="계정 검색" className="flex-1 min-w-0" placeholder="서비스·아이디·URL" value={pendingQuery} onChange={(e) => setPendingQuery(e.target.value)} onEnter={handleSearch} />
          <Button className="shrink-0" onClick={handleSearch}>조회</Button>
        </div>
      </FilterPanel>

      {/* 2FA 미설정 경고 상자 */}
      {no2fa > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 mb-3 bg-warning-dim border border-warning/20 rounded-ui text-[0.82rem] [&_svg]:w-4 [&_svg]:h-4">
          <IconAlertTriangle className="text-warning shrink-0" />
          <span className="flex-1 text-secondary">2FA 미설정 계정이 <strong>{no2fa}개</strong> 있습니다. 2단계 인증 설정을 권장합니다.</span>
        </div>
      )}

      {/* 총 개수 · 엑셀 · 선택삭제 · 페이지 크기 (가계부와 같은 도구 줄) */}
      <ListToolbar
        total={total}
        unit="개"
        tools={<ExcelToolbar onDownloadTemplate={handleDownloadTemplate} onUpload={handleUploadExcel} onDownloadData={handleDownloadDataAsk} />}
      >
        <Button variant="danger" size="sm" disabled={selected.size === 0} onClick={handleRemoveSelected}>선택삭제</Button>
        <LimitSelect limit={limit} onLimitChange={changeLimit} />
      </ListToolbar>

      {/* 표 + 휴대폰 줄 */}
      <div className="table-wrap max-md:hidden mt-3">
        <table>
          <thead>
            <tr>
              <th className="th-left w-10"><input type="checkbox" className="checkbox" checked={allChecked} onChange={toggleAll} aria-label="전체선택" /></th>
              <th className="th-left">서비스</th><th className="th-left">카테고리</th><th className="th-left">아이디</th><th className="th-left">2FA</th><th className="th-left">수정일</th>
              <th className="th-right"><span className="sr-only">관리</span></th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && <TableEmptyRow colSpan={7} message="저장된 계정이 없습니다." />}
            {paged.map((c) => (
              <tr key={c.id} className="cursor-pointer" onClick={() => setDetail(c)}>
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" className="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label="선택" /></td>
                <td>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ServiceTile name={c.name} />
                    <div className="flex flex-col leading-[1.3] min-w-0">
                      <span className="text-primary truncate">{c.name}</span>
                      <span className="text-[0.75rem] text-muted truncate">{c.url ?? '—'}</span>
                    </div>
                  </div>
                </td>
                <td className="text-muted">{c.category}</td>
                <td className="td-mono">{c.username}</td>
                <td className="whitespace-nowrap"><TwoFaMark on={c.has2fa} /></td>
                <td className="td-mono text-muted">{fmtCredDate(c.updatedAt)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {/* 가계부 줄처럼 복사 · 수정 · 삭제를 바로 보인다 */}
                  <div className="flex justify-end">
                    <IconButton label="아이디 복사" onClick={() => copyToClipboard(c.username)}><IconCopy /></IconButton>
                    <IconButton label="수정" onClick={() => openEdit(c)}><IconEdit /></IconButton>
                    <IconButton label="삭제" variant="danger" onClick={() => handleRemove(c)}><IconTrash /></IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MobileCardList empty={paged.length === 0 && '저장된 계정이 없습니다.'} selection={{ all: allChecked, count: selected.size, onToggleAll: toggleAll }}>
        {paged.map((c) => (
          <MobileCard
            key={c.id}
            checked={selected.has(c.id)}
            onCheck={() => toggle(c.id)}
            icon={<ServiceTile name={c.name} />}
            title={c.name}
            sub={c.url ?? '—'}
            aside={<TwoFaMark on={c.has2fa} />}
            fields={[
              { label: '아이디', value: c.username },
              { label: '카테고리', value: c.category },
              { label: '수정일', value: fmtCredDate(c.updatedAt) },
            ]}
            actions={[
              { label: '열기', onClick: () => setDetail(c) },
              { label: '수정', onClick: () => openEdit(c) },
              { label: '삭제', danger: true, onClick: () => handleRemove(c) },
            ]}
          />
        ))}
      </MobileCardList>

      <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />

      {/* 상세 모달 */}
      <DetailModal
        cred={detail}
        pwAutoHide={pwAutoHide}
        onClose={() => setDetail(null)}
        onEdit={() => { const c = detail; setDetail(null); setEdit({ open: true, mode: 'edit', editing: c }); }}
        onDelete={() => detail && handleRemove(detail)}
      />

      {/* 추가/수정 모달 */}
      <EditModal state={edit} onClose={() => setEdit((s) => ({ ...s, open: false }))} onSaved={() => { setEdit((s) => ({ ...s, open: false })); reload(); }} />
      {confirmElement}

      {/* 평문 엑셀 내려받기 확인 — 낱말을 입력해야 활성화 */}
      <ConfirmModal
        open={exportOpen}
        title="평문 엑셀 내려받기"
        message={`비밀번호가 평문으로 들어간 엑셀을 내려받습니다. 파일을 안전하게 다루세요. 계속하려면 "${EXPORT_WORD}"를 입력하세요.`}
        confirmLabel="내려받기"
        confirmDisabled={exportWord.trim() !== EXPORT_WORD}
        loading={exporting}
        loadingLabel="받는 중…"
        onConfirm={handleDownloadData}
        onCancel={() => setExportOpen(false)}
      >
        <input
          className="input text-center"
          autoFocus
          value={exportWord}
          placeholder={EXPORT_WORD}
          aria-label="확인 낱말"
          onChange={(e) => setExportWord(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && exportWord.trim() === EXPORT_WORD) handleDownloadData(); }}
        />
      </ConfirmModal>
    </AppShell>
  );
}
