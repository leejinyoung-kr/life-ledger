// 사용자별로 도는 작업의 마무리 — 일부 사용자가 실패하면 나머지를 다 처리한 뒤 실행을 실패로 마감한다.
// 사용자별 원인은 각 작업이 시스템 로그에 남기므로 여기서는 건수만 적는다
export function finishPerUser(summary: string, failed: number): string {
  if (failed) throw new Error(`${summary} — 실패 ${failed}명(사용자별 원인은 시스템 로그)`);
  return summary;
}
