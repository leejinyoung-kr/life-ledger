// 한국 날짜 기준 "오늘"·"이번 달" — 서버 TZ 와 무관하게 Asia/Seoul 로 계산한다.
// @db.Date 컬럼은 UTC 자정 Date 로 읽히므로, 비교용 오늘도 같은 형태(UTC 자정)로 돌려준다.

// 지금 시각의 한국 날짜 'YYYY-MM-DD'
export function kstDateStr(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);
}

// 오늘(KST) 날짜를 UTC 자정 Date 로
export function todayKst(now: Date = new Date()): Date {
  return new Date(`${kstDateStr(now)}T00:00:00Z`);
}

// 이번 달(KST) 'YYYY-MM'
export function kstMonthStr(now: Date = new Date()): string {
  return kstDateStr(now).slice(0, 7);
}
