
export interface BondData {
  f12: string; // Code
  f14: string; // Name
  f2: number;  // Price
  f3: number;  // Change%
  f10: number; // Vol Ratio
  f6: number;  // Turnover
  f22: number; // Speed
}

export interface SectorData {
  f12: string; // Code
  f14: string; // Name
  f3: number;  // Change%
  leaders?: {
    gainer: { name: string; val: number };
    volume: { name: string; val: number };
    funds: { name: string; val: number };
  };
}

export interface HistorySnapshot {
  time: string;
  data: Record<string, number>;
}

export enum MarketStatus {
  TRADING = '实时监控',
  CLOSED = '盘后复盘'
}
