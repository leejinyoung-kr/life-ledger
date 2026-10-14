// 파일 보관함 텍스트 미리보기용 순수 함수 — 형식 판별 · 앞부분 자르기 · 글자 변환

// 텍스트 미리보기로 읽는 앞부분 상한 — 큰 로그 파일도 창이 버벅이지 않게 이만큼만 보여 준다
export const TEXT_PREVIEW_MAX_BYTES = 512 * 1024;

// 글자로 미리 볼 수 있는 파일인지 — text/* · JSON · XML · YAML, 또는 형식 정보가 없어도 흔한 텍스트 확장자
export function isTextPreviewable(mime: string, name: string): boolean {
  if (mime.startsWith('text/') || /^application\/(json|xml|x-yaml|yaml)$/.test(mime)) return true;
  return /\.(txt|md|csv|tsv|log|json|ya?ml|xml|ini|conf)$/i.test(name);
}

// 앞부분만 잘라 읽었을 때 끝에 걸린 UTF-8 글자 조각(최대 3바이트)을 뗀다
export function trimPartialUtf8(buf: Uint8Array): Uint8Array {
  for (let back = 1; back <= Math.min(3, buf.length); back++) {
    const b = buf[buf.length - back];
    if ((b & 0xc0) === 0x80) continue; // 이어지는 바이트 — 더 앞을 본다
    const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 1;
    return need > back ? buf.subarray(0, buf.length - back) : buf;
  }
  return buf;
}

// 바이트를 글자로 — UTF-8 로 읽다가 깨지면(옛 메모장 파일) EUC-KR 로 다시 읽는다. 앞의 BOM 은 TextDecoder 가 기본으로 뗀다
export function decodeText(buf: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('euc-kr').decode(buf);
  }
}
