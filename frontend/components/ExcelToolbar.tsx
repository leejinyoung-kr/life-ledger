/**
 * 엑셀 양식 다운로드 · 업로드 · 데이터 다운로드 버튼 줄.
 * 버튼 모양(.excel-btn)은 settings 의 업로드 라벨과 공유하는 globals 클래스다.
 */
import type { ChangeEvent } from 'react';

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
    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5 px-4 py-3 bg-surface border border-border rounded-ui">
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
        <span className="text-[0.75rem] font-semibold text-muted">엑셀</span>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="excel-btn" onClick={onDownloadTemplate}>양식 다운로드</button>
          <label className="excel-btn upload">
            엑셀 업로드
            <input type="file" accept={accept} hidden aria-label="엑셀 업로드" onChange={onUpload} />
          </label>
          <button type="button" className="excel-btn" onClick={onDownloadData}>데이터 다운로드</button>
        </div>
      </div>
    </div>
  );
}
