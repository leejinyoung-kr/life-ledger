import { OutboxPermanentError } from '@leejinyoun/core-notification';
import { WebPushChannel } from './webpush.channel';

// 'webpush' 채널 회귀 테스트 — 기기별 발송 결과에 따라 재시도할지(던짐) 말지(정상 반환)를 가른다
describe('WebPushChannel', () => {
  let prisma: any;
  let webPush: any;
  let channel: WebPushChannel;

  const message = { userId: 1, title: '새 기기에서 로그인', body: 'Windows · Chrome', url: '/security' };
  const subs = [
    { id: 1, endpoint: 'https://push/1', p256dh: 'a', auth: 'b' },
    { id: 2, endpoint: 'https://push/2', p256dh: 'c', auth: 'd' },
  ];

  beforeEach(() => {
    prisma = {
      pushSubscription: {
        findMany: jest.fn().mockResolvedValue(subs),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    webPush = {
      getPublicKey: jest.fn().mockReturnValue({ enabled: true, publicKey: 'pub' }),
      sendToSubscription: jest.fn().mockResolvedValue({ ok: true }),
    };
    channel = new WebPushChannel(prisma, webPush);
  });

  it('모든 기기로 보내고 제목·본문·경로를 그대로 싣는다', async () => {
    await channel.send(message);

    expect(webPush.sendToSubscription).toHaveBeenCalledTimes(2);
    expect(webPush.sendToSubscription).toHaveBeenCalledWith(
      { endpoint: 'https://push/1', keys: { p256dh: 'a', auth: 'b' } },
      { title: message.title, body: message.body, url: '/security' },
    );
  });

  it('만료(404/410) 구독은 지우고, 남은 기기가 없어도 재시도하지 않는다', async () => {
    webPush.sendToSubscription.mockResolvedValue({ ok: false, expired: true, error: '구독이 만료·폐기됨 (status 410)' });

    await expect(channel.send(message)).resolves.toBeUndefined();
    expect(prisma.pushSubscription.delete).toHaveBeenCalledTimes(2);
  });

  it('기기 하나라도 성공하면 성공 — 재시도하면 이미 받은 기기에 또 간다', async () => {
    webPush.sendToSubscription
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, error: 'status 500' });

    await expect(channel.send(message)).resolves.toBeUndefined();
  });

  it('모든 기기가 실패하면 원인을 담아 던진다 — 아웃박스가 재시도한다', async () => {
    webPush.sendToSubscription.mockResolvedValue({ ok: false, error: 'status 500, body: ?' });

    await expect(channel.send(message)).rejects.toThrow('기기 2대 모두 실패');
    await expect(channel.send(message)).rejects.toThrow('status 500');
  });

  it('구독이 하나도 없으면 보낼 것이 없다 — 성공으로 본다', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([]);
    await expect(channel.send(message)).resolves.toBeUndefined();
  });

  it('푸시가 꺼져 있으면 재시도해도 소용없다 — OutboxPermanentError', async () => {
    webPush.getPublicKey.mockReturnValue({ enabled: false, publicKey: null });
    await expect(channel.send(message)).rejects.toBeInstanceOf(OutboxPermanentError);
  });
});
