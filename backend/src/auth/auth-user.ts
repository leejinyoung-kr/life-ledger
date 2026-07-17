// JwtStrategy(@leejinyoun/core-auth)가 검증한 payload를 req.user로 노출할 때의 타입.
// core-auth는 sub을 id로 정규화해서 넣어주고, 나머지 커스텀 클레임도 함께 전달한다.
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture: string;
}
