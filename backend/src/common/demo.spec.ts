import { ForbiddenException } from '@nestjs/common';

// 데모 가드 — DEMO_MODE 일 때만 막고, 운영(기본값)에서는 아무 일도 하지 않는다
describe('assertNotDemo', () => {
  afterEach(() => jest.resetModules());

  // env 를 바꿔 끼운 채로 demo 모듈을 새로 읽는다
  function load(demo: boolean) {
    jest.doMock('../config/env', () => ({ env: { DEMO_MODE: demo } }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./demo') as typeof import('./demo');
  }

  it('DEMO_MODE 이면 403 으로 막는다', () => {
    const { assertNotDemo } = load(true);
    expect(() => assertNotDemo('계정을 삭제')).toThrow(ForbiddenException);
    expect(() => assertNotDemo('계정을 삭제')).toThrow('데모에서는 계정을 삭제할 수 없습니다.');
  });

  it('운영(DEMO_MODE 아님)에서는 통과한다', () => {
    const { assertNotDemo } = load(false);
    expect(() => assertNotDemo('계정을 삭제')).not.toThrow();
  });
});
