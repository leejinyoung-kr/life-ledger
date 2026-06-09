/**
 * 가계부 엑셀 양식(템플릿) 생성 유틸.
 * 사용자 데이터가 없는 정적 템플릿이라 서버 없이 브라우저(exceljs)에서 생성한다.
 * 유형·카테고리·결제수단은 숨김 `options` 시트를 참조하는 드롭다운(데이터 검증)으로 입력 실수를 막는다.
 * 업로드 파싱(백엔드)이 라벨→코드로 역매핑하므로 셀에는 사람이 읽기 쉬운 한글 라벨을 넣는다.
 */
import type ExcelJS from 'exceljs';
import { PAY_METHODS } from './finance';

// 양식 컬럼 정의 — 화면 테이블과 동일한 순서. 메모만 선택, 나머지는 필수(헤더에 * 표시).
const COLUMNS = [
  { header: '유형*', width: 12 },
  { header: '카테고리*', width: 16 },
  { header: '내역*', width: 28 },
  { header: '결제수단*', width: 14 },
  { header: '금액*', width: 14 },
  { header: '날짜*', width: 14 },
  { header: '메모', width: 30 },
] as const;

const TYPE_OPTIONS = ['수입', '지출', '자산이동'];

// 드롭다운 검증을 적용할 입력 행 수 (헤더 제외)
const VALIDATION_ROWS = 1000;

// 빈 가계부 양식 xlsx 를 만들어 브라우저 다운로드를 트리거한다.
export async function downloadTransactionTemplate(
  categoryLabels: string[],
): Promise<void> {
  // exceljs(~1.5MB)는 양식 다운로드 시점에만 필요 → 동적 import 로 초기 번들에서 제외
  const { default: ExcelJSRuntime } = await import('exceljs');
  const wb = new ExcelJSRuntime.Workbook();
  const ws = wb.addWorksheet('가계부');

  // 드롭다운 원본 목록을 담는 숨김 시트 (인라인 목록 255자 제한 회피)
  const opt = wb.addWorksheet('options', { state: 'veryHidden' });
  writeOptionColumn(opt, 1, TYPE_OPTIONS);
  writeOptionColumn(opt, 2, categoryLabels);
  writeOptionColumn(opt, 3, [...PAY_METHODS]);

  // 헤더 행
  ws.columns = COLUMNS.map((c) => ({ header: c.header, width: c.width }));
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { horizontal: 'center', vertical: 'middle' };
  head.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
  });

  // 금액(E) 천단위 구분, 날짜(F) 표시 형식
  ws.getColumn(5).numFmt = '#,##0';
  ws.getColumn(6).numFmt = 'yyyy-mm-dd';

  // 입력 행에 드롭다운(데이터 검증) 적용 — 유형(A)·카테고리(B)·결제수단(D)
  applyDropdown(ws, 'A', `options!$A$1:$A$${TYPE_OPTIONS.length}`);
  applyDropdown(ws, 'B', `options!$B$1:$B$${categoryLabels.length}`);
  applyDropdown(ws, 'D', `options!$C$1:$C$${PAY_METHODS.length}`);

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(buf, '가계부_양식.xlsx');
}

// options 시트의 한 열(col)에 목록을 1행부터 세로로 기록
function writeOptionColumn(ws: ExcelJS.Worksheet, col: number, values: string[]): void {
  values.forEach((v, i) => {
    ws.getCell(i + 1, col).value = v;
  });
}

// 지정 열의 입력 행 전체에 목록 참조 드롭다운을 건다
function applyDropdown(ws: ExcelJS.Worksheet, col: string, formula: string): void {
  for (let r = 2; r <= VALIDATION_ROWS + 1; r++) {
    ws.getCell(`${col}${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: 'warning',
      error: '목록에서 선택하세요.',
    };
  }
}

// 버퍼를 xlsx Blob 으로 만들어 a 태그 클릭으로 다운로드
function triggerDownload(buf: ArrayBuffer | ExcelJS.Buffer, filename: string): void {
  const blob = new Blob([buf as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
