import { addCycle, rollForward } from './billing-date.util';
import { todayKst } from '../common/kst-date';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('billing-date.util', () => {
  it('todayKst 는 UTC 로 전날이어도 한국 날짜를 돌려준다', () => {
    // 2026-10-05 06:30 KST = 2026-10-04 21:30 UTC
    expect(todayKst(new Date('2026-10-04T21:30:00Z'))).toEqual(d('2026-10-05'));
  });

  it('월 주기는 말일을 넘기면 그 달 말일로 맞춘다', () => {
    expect(addCycle(d('2026-01-31'), 'monthly', 31)).toEqual(d('2026-02-28'));
    expect(addCycle(d('2026-12-15'), 'monthly', 15)).toEqual(d('2027-01-15'));
  });

  it('월 주기는 2월에 말일로 줄었어도 다음 달엔 원래 결제일로 돌아간다', () => {
    expect(addCycle(d('2026-02-28'), 'monthly', 31)).toEqual(d('2026-03-31'));
    expect(addCycle(d('2026-04-30'), 'monthly', 31)).toEqual(d('2026-05-31'));
  });

  it('연 주기는 윤일을 평년 2/28 로 맞추고 윤년엔 2/29 로 돌아간다', () => {
    expect(addCycle(d('2028-02-29'), 'yearly', 29)).toEqual(d('2029-02-28'));
    expect(rollForward(d('2029-02-28'), 'yearly', 29, d('2032-01-01'))).toEqual(d('2032-02-29'));
  });

  it('주 주기는 7일 뒤', () => {
    expect(addCycle(d('2026-10-01'), 'weekly', 1)).toEqual(d('2026-10-08'));
  });

  it('여러 주기가 지났으면 오늘 이후 첫 결제일까지 넘긴다', () => {
    expect(rollForward(d('2026-07-10'), 'monthly', 10, d('2026-10-05'))).toEqual(d('2026-10-10'));
    expect(rollForward(d('2026-01-31'), 'monthly', 31, d('2026-03-05'))).toEqual(d('2026-03-31'));
  });

  it('결제일이 오늘이면 넘기지 않는다', () => {
    expect(rollForward(d('2026-10-05'), 'monthly', 5, d('2026-10-05'))).toEqual(d('2026-10-05'));
  });
});
