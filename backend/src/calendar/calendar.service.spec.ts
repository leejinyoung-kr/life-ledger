import { CalendarService } from './calendar.service';
import { HolidayService } from '../holiday/holiday.service';

// 캘린더 — 일괄 추가(한 트랜잭션) · 알림 대상(오늘 회차가 있는 일정만)
describe('CalendarService', () => {
  let prisma: any;
  const svc = () => new CalendarService(prisma, {} as HolidayService);
  const d = (s: string) => new Date(`${s}T00:00:00Z`);

  function row(over: Record<string, any> = {}) {
    return {
      id: 1, user_id: 1, date: d('2026-10-27'), type: 'task', title: '연말정산 서류', memo: null,
      is_lunar: false, lunar_month: null, lunar_day: null, lunar_leap: false,
      recur_freq: 'none', recur_until: null, notify: true, deleted_at: null,
      created_at: new Date(), updated_at: new Date(),
      ...over,
    };
  }

  beforeEach(() => {
    let nextId = 1;
    prisma = {
      calendarEvent: {
        create: jest.fn(async ({ data }: any) => row({ ...data, id: nextId++ })),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };
  });

  describe('bulkCreate', () => {
    it('여러 건을 한 트랜잭션으로 저장하고, 알림을 안 보냈으면 꺼진 채로 저장한다', async () => {
      const res = await svc().bulkCreate(1, [
        { date: '2026-11-03', type: 'task', title: '연말정산 서류', notify: true },
        { date: '2026-11-20', type: 'exp', title: '여권 만료' },
      ]);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.calendarEvent.create.mock.calls.map(([a]: any) => a.data)).toEqual([
        expect.objectContaining({ user_id: 1, date: d('2026-11-03'), type: 'task', title: '연말정산 서류', notify: true, recur_freq: 'none' }),
        expect.objectContaining({ user_id: 1, date: d('2026-11-20'), type: 'exp', title: '여권 만료', notify: false }),
      ]);
      expect(res.map((e) => [e.date, e.title, e.notify])).toEqual([
        ['2026-11-03', '연말정산 서류', true],
        ['2026-11-20', '여권 만료', false],
      ]);
    });
  });

  describe('notifyTargetsOn', () => {
    it('알림을 켠 일정만, 반복 일정은 그날 회차가 있을 때만 돌려준다', async () => {
      prisma.calendarEvent.findMany.mockResolvedValue([
        row({ id: 1, title: '오늘 한 번' }),
        row({ id: 2, title: '3주 전부터 매주', date: d('2026-10-06'), recur_freq: 'weekly' }),
        row({ id: 3, title: '내일이 회차', date: d('2026-10-07'), recur_freq: 'weekly' }),
        row({ id: 4, title: '매월 27일', date: d('2026-01-27'), recur_freq: 'monthly' }),
      ]);

      const res = await svc().notifyTargetsOn(1, d('2026-10-27'));

      expect(res.map((e) => e.title)).toEqual(['오늘 한 번', '3주 전부터 매주', '매월 27일']);
      const where = prisma.calendarEvent.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ user_id: 1, deleted_at: null, notify: true });
    });
  });
});
