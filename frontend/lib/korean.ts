/**
 * 한국어 조사 처리 유틸.
 * 마지막 글자의 받침 유무에 따라 이/가, 을/를 조사를 선택한다.
 */

// 마지막 글자에 받침이 있는지 (한글이 아니면 false)
export function hasBatchim(word: string): boolean {
  if (!word) return false;
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false; // 한글 음절 범위 밖
  return (code - 0xac00) % 28 !== 0;
}

// 받침 있으면 '이', 없으면 '가'
export const iga = (w: string) => (hasBatchim(w) ? '이' : '가');

// 받침 있으면 '을', 없으면 '를'
export const eulreul = (w: string) => (hasBatchim(w) ? '을' : '를');

// "{word}{을/를}" — 조사를 붙인 문자열 반환
export function withEulReul(word: string): string {
  return `${word}${eulreul(word)}`;
}
