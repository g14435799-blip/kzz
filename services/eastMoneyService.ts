
import { BondData, SectorData } from '../types';

const BASE_URL = 'https://push2.eastmoney.com/api/qt/clist/get';

export const safeFloat = (val: any): number => {
  if (val === '-' || val === null || val === undefined || val === '' || val === '0') return 0;
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

export async function getMarketData(fsCode: string, fields: string, pz: number = 10, sortField: string = "f3"): Promise<any[]> {
  const params = new URLSearchParams({
    pn: "1",
    pz: pz.toString(),
    po: "1",
    np: "1",
    fltt: "2",
    invt: "2",
    fid: sortField,
    fs: fsCode,
    fields: fields
  });

  try {
    // In a real browser environment, CORS might be an issue depending on headers.
    // For this demonstration, we assume a proxy or standard access works as in the Python script.
    const response = await fetch(`${BASE_URL}?${params.toString()}`);
    const json = await response.json();
    return json?.data?.diff || [];
  } catch (error) {
    console.error("Fetch error:", error);
    return [];
  }
}

export async function fetchSectorLeaders(secId: string): Promise<SectorData['leaders']> {
  // Fields: f14(Name), f3(Change%), f6(Turnover), f62(Net Funds Flow)
  const data = await getMarketData(`b:${secId}`, "f14,f3,f6,f62", 20, "f3");
  if (!data.length) return undefined;

  const numericData = data.map(item => ({
    ...item,
    f3: safeFloat(item.f3),
    f6: safeFloat(item.f6),
    f62: safeFloat(item.f62)
  }));

  const gainer = [...numericData].sort((a, b) => b.f3 - a.f3)[0];
  const volume = [...numericData].sort((a, b) => b.f6 - a.f6)[0];
  const funds = [...numericData].sort((a, b) => b.f62 - a.f62)[0];

  return {
    gainer: { name: gainer.f14, val: gainer.f3 },
    volume: { name: volume.f14, val: volume.f6 },
    funds: { name: funds.f14, val: funds.f62 }
  };
}
