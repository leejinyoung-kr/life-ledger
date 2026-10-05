// access 토큰의 발급자/대상 — core-auth JwtStrategy 가 검증한다.
// 같은 시크릿을 실수로 공유하더라도 내 다른 앱의 토큰이 여기서 통과하지 않게 앱 이름으로 고정한다.
export const JWT_ISSUER = 'doc-nexus';
export const JWT_AUDIENCE = 'doc-nexus';

// 토큰 헤더의 alg 를 믿지 않고 서명 알고리즘을 고정한다 (core-auth 와 동일하게 HS256)
export const JWT_ALGORITHMS: ['HS256'] = ['HS256'];
