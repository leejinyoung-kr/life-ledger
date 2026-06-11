// requestLogger 미들웨어가 부여하는 상관관계 ID
declare namespace Express {
  interface Request {
    requestId?: string;
  }
}
