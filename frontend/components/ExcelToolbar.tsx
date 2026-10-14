/**
 * 엑셀 양식 다운로드 · 업로드 · 데이터 다운로드 버튼 줄 — 목록 위 오른쪽의 작은 글자 버튼(무게를 줄인다).
 * 버튼 모양(.excel-btn)은 settings 의 업로드 라벨과 공유하는 globals 클래스다.
 */
import type { ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';

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
    <div className="flex justify-end mb-3">
      <div className="flex items-center gap-1">
        <span className="text-[0.75rem] text-muted mr-1">엑셀</span>
        <div className="flex gap-1 flex-wrap">
          <button type="button" className="excel-btn" onClick={onDownloadTemplate}>양식</button>
          <label className="excel-btn upload">
            <Upload size={14} aria-hidden />올리기
            <input type="file" accept={accept} hidden aria-label="엑셀 업로드" onChange={onUpload} />
          </label>
          <button type="button" className="excel-btn" onClick={onDownloadData}><Download size={14} aria-hidden />내려받기</button>
        </div>
      </div>
    </div>
  );
}
