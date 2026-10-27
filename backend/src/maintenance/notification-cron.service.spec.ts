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
