import { BadRequestException, Injectable } from '@nestjs/common';
import { InvestmentType } from '@prisma/client';

export interface PriceLookupResult {
  price: number; // 원가(currency 기준 단가)
  currency: 'KRW' | 'USD';
  krwPrice: number; // 원화 환산 단가
  name: string | null;
}

export const FOREIGN_TYPES: InvestmentType[] = ['foreign_stock', 'foreign_etf'];

const NAVER_DOMESTIC_STOCK_API =
  'https://polling.finance.naver.com/api/realtime/domestic/stock';
const YAHOO_FINANCE_CHART_API =
  'https://query1.finance.yahoo.com/v8/finance/chart';
const FRANKFURTER_EXCHANGE_RATE_API = 'https://api.frankfurter.app/latest';

// 국내/해외 종목 시세조회 — 둘 다 키 발급 없이 쓸 수 있는 비공식 API 사용
@Injectable()
export class PriceLookupService {
  // 종목 type 기준으로 국내(네이버)/해외(야후) 조회처를 분기
  async lookup(
    type: InvestmentType,
    symbol: string,
  ): Promise<PriceLookupResult> {
    return FOREIGN_TYPES.includes(type)
      ? this.lookupForeign(symbol)
      : this.lookupDomestic(symbol);
  }

  // 국내주식/ETF — 네이버 금융 실시간 시세
  private async lookupDomestic(symbol: string): Promise<PriceLookupResult> {
    const res = await fetch(`${NAVER_DOMESTIC_STOCK_API}/${symbol}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new BadRequestException('시세 조회에 실패했습니다.');
    const json = await res.json();
    const data = json?.datas?.[0];
    const price = Number(data?.closePriceRaw);
    if (!data || !Number.isFinite(price))
      throw new BadRequestException('종목코드를 찾을 수 없습니다.');
    return {
      price,
      currency: 'KRW',
      krwPrice: price,
      name: data.stockName ?? null,
    };
  }

  // 해외주식/ETF — 야후 파이낸스 차트 API + 환율 변환(USD 등 → KRW)
  private async lookupForeign(symbol: string): Promise<PriceLookupResult> {
    const res = await fetch(
      `${YAHOO_FINANCE_CHART_API}/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!res.ok) throw new BadRequestException('시세 조회에 실패했습니다.');
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    const currency = meta?.currency as string | undefined;
    if (!meta || !Number.isFinite(price) || !currency) {
      throw new BadRequestException('티커를 찾을 수 없습니다.');
    }
    const krwPrice =
      currency === 'KRW'
        ? price
        : price * (await this.exchangeRate(currency, 'KRW'));
    return {
      price,
      currency: currency === 'KRW' ? 'KRW' : 'USD',
      krwPrice: Math.round(krwPrice),
      name: meta.longName ?? meta.shortName ?? null,
    };
  }

  // 환율 조회 (frankfurter.app — 키 불필요) — 계좌 환전 기능에서도 사용
  async getExchangeRate(from: string, to: string): Promise<number> {
    return this.exchangeRate(from, to);
  }

  private async exchangeRate(from: string, to: string): Promise<number> {
    const res = await fetch(
      `${FRANKFURTER_EXCHANGE_RATE_API}?from=${from}&to=${to}`,
    );
    if (!res.ok) throw new BadRequestException('환율 조회에 실패했습니다.');
    const json = await res.json();
    const rate = Number(json?.rates?.[to]);
    if (!Number.isFinite(rate))
      throw new BadRequestException('환율 조회에 실패했습니다.');
    return rate;
  }
}
