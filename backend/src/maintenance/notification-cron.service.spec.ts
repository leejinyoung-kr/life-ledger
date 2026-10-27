import { NotificationCronService } from './notification-cron.service';
import { NotificationService } from '../notification/notification.service';
import { CalendarService } from '../calendar/calendar.service';

// 매일 9시 알림 — 캘린더 일정 중 알림을 켠 오늘 회차
describe('NotificationCronService 캘린더 알림', () => {
  let prisma: any;
  let settings: Record<string, boolean>;
  let notification: { createWithPush: jest.Mock };
  let calendar: { notifyTargetsOn: jest.Mock };
  const svc = () => new NotificationCronService(
    prisma, notification as unknown as NotificationService, calendar as unknown as CalendarService,
  );

  beforeEach(() => {
    // KST 2026-10-27 09:00
    jest.useFakeTimers().setSystemTime(new Date('2026-10-27T00:00:00Z'));
    settings = { notif_maturity: false, notif_deadline: true };
    prisma = {
      user: { findMany: jest.fn(async () => [{ id: 1 }]) },
      userSettings: { findUnique: jest.fn(async () => settings) },
      credential: { findMany: jest.fn(async () => []) },
      notification: { findFirst: jest.fn(async () => null) },
    };
    notification = { createWithPush: jest.fn(async () => ({})) };
    calendar = { notifyTargetsOn: jest.fn(async () => [{ id: 7, type: 'task', title: '연말정산 서류' }]) };
  });
  afterEach(() => jest.useRealTimers());

  it('오늘 회차가 있는 일정을 알림 + 푸시로 보낸다', async () => {
    const res = await svc().generateDaily();

    expect(calendar.notifyTargetsOn).toHaveBeenCalledWith(1, new Date('2026-10-27T00:00:00Z'));
    expect(notification.createWithPush).toHaveBeenCalledWith(
      1,
      { group: 'ledger', tone: 'info', title: '연말정산 서류', description: '오늘(10월 27일) 할일입니다.', source: '캘린더' },
      { url: '/calendar' },
    );
    expect(res).toBe('알림 1건 생성 (사용자 1명)');
  });

  it('반복 일정은 설명(날짜)까지 같은 안 읽은 알림이 있을 때만 건너뛴다', async () => {
    await svc().generateDaily();

    expect(prisma.notification.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 1, title: '연말정산 서류', read_at: null, description: '오늘(10월 27일) 할일입니다.' },
    }));
  });

  it('설정에서 할일 알림을 끄면 보내지 않는다', async () => {
    settings.notif_deadline = false;

    await svc().generateDaily();

    expect(calendar.notifyTargetsOn).not.toHaveBeenCalled();
    expect(notification.createWithPush).not.toHaveBeenCalled();
  });
});

// 매일 9시 알림 — 비밀번호 교체 권장 (90일째 · 이후 30일마다, 바꾼 날은 한국 날짜로 센다)
describe('NotificationCronService 비밀번호 교체 알림', () => {
  let creds: { name: string; password_changed_at: Date }[];
  let prisma: any;
  let notification: { createWithPush: jest.Mock };
  const svc = () => new NotificationCronService(
    prisma, notification as unknown as NotificationService, { notifyTargetsOn: jest.fn(async () => []) } as unknown as CalendarService,
  );
  const sentDescriptions = () => notification.createWithPush.mock.calls.map(([, n]: any) => n.description);

  beforeEach(() => {
    // KST 2026-10-27 09:00
    jest.useFakeTimers().setSystemTime(new Date('2026-10-27T00:00:00Z'));
    creds = [];
    prisma = {
      user: { findMany: jest.fn(async () => [{ id: 1 }]) },
      userSettings: { findUnique: jest.fn(async () => ({ notif_maturity: false, notif_deadline: false })) },
      credential: {
        findMany: jest.fn(async ({ where }: any) => creds.filter((c) => c.password_changed_at < where.password_changed_at.lt)),
      },
      notification: { findFirst: jest.fn(async () => null) },
    };
    notification = { createWithPush: jest.fn(async () => ({})) };
  });
  afterEach(() => jest.useRealTimers());

  it('정확히 90일째(오후에 바꾼 것)도 알린다', async () => {
    // 2026-07-29 15:00 KST — 오늘(10-27)이 90일째
    creds.push({ name: '네이버', password_changed_at: new Date('2026-07-29T06:00:00Z') });

    await svc().generateDaily();

    expect(sentDescriptions()).toEqual(['비밀번호를 변경한 지 90일이 지났습니다.']);
  });

  it('KST 새벽(UTC 로는 전날)에 바꾼 것도 한국 날짜로 센다', async () => {
    // 2026-07-29 08:00 KST = 07-28 23:00 UTC — UTC 날짜로 세면 91일이라 알림이 빠졌다
    creds.push({ name: '네이버', password_changed_at: new Date('2026-07-28T23:00:00Z') });

    await svc().generateDaily();

    expect(sentDescriptions()).toEqual(['비밀번호를 변경한 지 90일이 지났습니다.']);
  });

  it('89일 · 91일째는 보내지 않고, 120일째는 다시 알린다', async () => {
    creds.push(
      { name: '89일', password_changed_at: new Date('2026-07-30T06:00:00Z') },
      { name: '91일', password_changed_at: new Date('2026-07-28T06:00:00Z') },
      { name: '120일', password_changed_at: new Date('2026-06-29T06:00:00Z') },
    );

    await svc().generateDaily();

    expect(sentDescriptions()).toEqual(['비밀번호를 변경한 지 120일이 지났습니다.']);
  });
});
