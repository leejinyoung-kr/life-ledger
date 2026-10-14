/**
 * 엑셀 양식 받기 · 올리기 · 내려받기 — 한 테두리로 이은 작은 버튼 묶음.
 * 목록 위 도구 줄(총 n건 · 선택삭제 · 개수)의 오른쪽에 같이 놓는다. 휴대폰은 글자를 숨기고 아이콘만(글자는 화면 읽기용으로 남김).
 */
import type { ChangeEvent, ReactNode } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';

const ITEM = 'inline-flex items-center gap-1.5 h-full px-2.5 text-[0.8125rem] text-secondary whitespace-nowrap cursor-pointer transition-colors hover:bg-hover hover:text-primary [&_svg]:w-3.5 [&_svg]:h-3.5';

export default function ExcelToolbar({
  onDownloadTemplate,
  onUpload,
  onDownloadData,
  accept = '.xlsx,.xls',
}: {
  onDownloadTemplate: () => void;
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onDownloadData: () => void;
  accept?: string;
}) {
  return (
    <div role="group" aria-label="엑셀" className="inline-flex items-stretch h-[30px] rounded-ui border border-border bg-background divide-x divide-border overflow-hidden shrink-0">
      <ExcelItem title="빈 엑셀 양식 받기" onClick={onDownloadTemplate}><FileSpreadsheet aria-hidden /><span className="max-md:sr-only">양식</span></ExcelItem>
      <label className={ITEM} title="엑셀로 한꺼번에 추가">
        <Upload aria-hidden /><span className="max-md:sr-only">올리기</span>
        <input type="file" accept={accept} hidden aria-label="엑셀 업로드" onChange={onUpload} />
      </label>
      <ExcelItem title="지금 조건의 목록을 엑셀로" onClick={onDownloadData}><Download aria-hidden /><span className="max-md:sr-only">내려받기</span></ExcelItem>
    </div>
  );
}

// 묶음 안 한 칸 버튼
function ExcelItem({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={ITEM} title={title} onClick={onClick}>{children}</button>;
}
