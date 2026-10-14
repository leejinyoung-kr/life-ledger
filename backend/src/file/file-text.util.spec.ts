import { decodeText, isTextPreviewable, trimPartialUtf8 } from './file-text.util';

// 텍스트 미리보기 — 형식 판별 · 잘린 글자 조각 떼기 · 인코딩 판별
describe('file-text.util', () => {
  it('text/* · JSON 과 흔한 텍스트 확장자만 미리 본다', () => {
    expect(isTextPreviewable('text/plain', 'a.txt')).toBe(true);
    expect(isTextPreviewable('application/json', 'a')).toBe(true);
    expect(isTextPreviewable('application/octet-stream', '메모.md')).toBe(true);
    expect(isTextPreviewable('application/pdf', 'a.pdf')).toBe(false);
    expect(isTextPreviewable('image/png', 'a.png')).toBe(false);
  });

  it('끝에 걸린 한글 조각을 떼면 UTF-8 로 읽힌다', () => {
    const full = Buffer.from('가나다', 'utf8'); // 한 글자 3바이트
    const cut = full.subarray(0, 7); // '가나' + '다'의 첫 바이트
    expect(Buffer.from(trimPartialUtf8(cut)).toString('utf8')).toBe('가나');
    expect(trimPartialUtf8(full)).toEqual(full);
    expect(Buffer.from(trimPartialUtf8(Buffer.from('abc'))).toString()).toBe('abc');
  });

  it('UTF-8 은 그대로, BOM 은 떼고, 깨지면 EUC-KR 로 읽는다', () => {
    expect(decodeText(Buffer.from('점검 메모', 'utf8'))).toBe('점검 메모');
    expect(decodeText(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('메모', 'utf8')]))).toBe('메모');
    // '가' 의 EUC-KR 바이트 (B0 A1)
    expect(decodeText(Buffer.from([0xb0, 0xa1]))).toBe('가');
  });
});
