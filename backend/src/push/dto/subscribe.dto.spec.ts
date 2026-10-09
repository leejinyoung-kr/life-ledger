import { PUSH_ENDPOINT_PATTERN } from './subscribe.dto';

// 푸시 endpoint 허용 패턴 — 실제 브라우저 푸시 서비스만 통과하고 내부·임의 주소는 막는지(SSRF 방지)
describe('PUSH_ENDPOINT_PATTERN', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc:APA91b',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://wns2-par02p.notify.windows.com/w/?token=BQYAAA',
    'https://web.push.apple.com/QGuQyavXutnMH',
  ])('브라우저 푸시 서비스 %s 는 허용', (url) => {
    expect(PUSH_ENDPOINT_PATTERN.test(url)).toBe(true);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc', // https 아님
    'https://fcm.googleapis.com:8443/fcm/send/abc', // 포트 지정
    'https://fcm.googleapis.com.evil.com/x', // 접미 도메인 속임
    'https://evilpush.apple.com.attacker.net/x',
    'https://127.0.0.1/x',
    'https://mariadb/x',
    'https://homeserver.tailba78c1.ts.net/x',
  ])('그 밖의 주소 %s 는 거부', (url) => {
    expect(PUSH_ENDPOINT_PATTERN.test(url)).toBe(false);
  });
});
