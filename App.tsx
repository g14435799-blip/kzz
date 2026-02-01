
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  getMarketData, 
  fetchSectorLeaders, 
  safeFloat 
} from './services/eastMoneyService';
import { 
  BondData, 
  SectorData, 
  HistorySnapshot, 
  MarketStatus 
} from './types';
import { 
  TrendingUp, 
  Activity, 
  Clock, 
  RefreshCw, 
  BarChart3, 
  BrainCircuit,
  Smartphone,
  X,
  Share2
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

const App: React.FC = () => {
  const [bonds, setBonds] = useState<BondData[]>([]);
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [isTrading, setIsTrading] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(30);
  const [aiCommentary, setAiCommentary] = useState<string>("正在思考盘面动态...");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkTradingTime = () => {
    const now = new Date();
    const hm = now.getHours() * 100 + now.getMinutes();
    return (hm >= 925 && hm <= 1131) || (hm >= 1300 && hm <= 1505);
  };

  const fetchData = useCallback(async () => {
    const trading = checkTradingTime();
    setIsTrading(trading);
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const hmStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const bondRaw = await getMarketData("b:MK0354", "f12,f14,f2,f3,f10,f6,f22", 8, "f3");
    setBonds(bondRaw.map(r => ({
      f12: r.f12,
      f14: r.f14,
      f2: safeFloat(r.f2),
      f3: safeFloat(r.f3),
      f10: safeFloat(r.f10),
      f6: safeFloat(r.f6),
      f22: safeFloat(r.f22)
    })));

    const sectorRaw = await getMarketData("m:90 t:2", "f12,f14,f3", 3, "f3");
    const processedSectors = await Promise.all(sectorRaw.map(async (s) => {
      const leaders = await fetchSectorLeaders(s.f12);
      return {
        f12: s.f12,
        f14: s.f14,
        f3: safeFloat(s.f3),
        leaders
      };
    }));
    setSectors(processedSectors);

    if (now.getMinutes() % 5 === 0 || history.length === 0) {
      const currentSnap: Record<string, number> = {};
      processedSectors.forEach(s => {
        currentSnap[s.f14] = s.f3;
      });
      
      setHistory(prev => {
        if (prev.length > 0 && prev[prev.length - 1].time === hmStr) return prev;
        const newHistory = [...prev, { time: hmStr, data: currentSnap }];
        return newHistory.slice(-12);
      });
    }

    setLastUpdateTime(timeStr);
    setCountdown(trading ? 30 : 300);
  }, [history.length]);

  const generateAICommentary = async () => {
    if (bonds.length === 0 && sectors.length === 0) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `基于以下实时市场数据提供简短的专家分析（不超过150字）：可转债领涨：${bonds.slice(0, 3).map(b => `${b.f14}(${b.f3}%)`).join(', ')}。行业板块领涨：${sectors.map(s => `${s.f14}(${s.f3}%)`).join(', ')}。请指出资金攻击方向和风险。`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      setAiCommentary(response.text || "暂时无法分析。");
    } catch (e) {
      setAiCommentary("AI 策略师离线。");
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!isAutoRefresh) return;
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchData();
          return isTrading ? 30 : 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTrading, fetchData, isAutoRefresh]);

  const currentUrl = window.location.href;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}&bgcolor=1e293b&color=ffffff`;

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-20 md:pb-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-700 shadow-xl">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="bg-red-500 p-2 md:p-3 rounded-xl shadow-lg shadow-red-500/20">
            <TrendingUp className="text-white w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Master Strategist <span className="text-red-500 italic">WEB</span></h1>
            <p className="text-slate-400 text-[10px] md:text-sm flex items-center gap-2 mt-0.5 md:mt-1">
              <Clock className="w-3 h-3 md:w-4 md:h-4" />
              {lastUpdateTime} | <span className={isTrading ? "text-green-400 font-semibold" : "text-slate-500"}>{isTrading ? MarketStatus.TRADING : MarketStatus.CLOSED}</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3 justify-between md:justify-end">
          <button 
            onClick={() => setShowQrModal(true)}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600 text-slate-300 flex items-center gap-2 text-sm"
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden sm:inline">手机查看</span>
          </button>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${isAutoRefresh ? 'bg-slate-700 text-slate-200' : 'bg-red-600 text-white'}`}
            >
              {isAutoRefresh ? `${countdown}s` : '手动'}
            </button>
            <button 
              onClick={fetchData}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600"
            >
              <RefreshCw className="w-4 h-4 md:w-5 md:h-5 text-slate-300" />
            </button>
          </div>
        </div>
      </header>

      {/* AI Insight */}
      <section className="bg-gradient-to-br from-indigo-900/40 to-slate-800 p-4 md:p-6 rounded-2xl border border-indigo-500/20 shadow-lg relative overflow-hidden">
        <div className="flex items-center gap-3 mb-3 md:mb-4">
          <BrainCircuit className="text-indigo-400 w-5 h-5 md:w-6 md:h-6" />
          <h2 className="text-sm md:text-lg font-semibold text-indigo-100 uppercase tracking-wider">AI 策略师洞察</h2>
          <button 
            onClick={generateAICommentary}
            disabled={isAiLoading}
            className="ml-auto text-[10px] px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 rounded-full transition-all text-indigo-200"
          >
            {isAiLoading ? '分析中...' : '重新分析'}
          </button>
        </div>
        <p className={`text-xs md:text-sm text-slate-300 leading-relaxed italic ${isAiLoading ? 'animate-pulse' : ''}`}>
          "{aiCommentary}"
        </p>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 shadow-lg overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center">
            <h3 className="text-slate-100 font-bold flex items-center gap-2 uppercase text-sm md:text-base">
              <Activity className="w-4 h-4 text-cyan-400" />
              可转债行情
            </h3>
            <span className="hidden sm:inline text-[10px] text-slate-500 font-mono">MK0354</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm min-w-[500px]">
              <thead>
                <tr className="bg-slate-900/50 text-slate-400 font-medium">
                  <th className="px-4 py-3">名称/代码</th>
                  <th className="px-4 py-3">现价</th>
                  <th className="px-4 py-3">涨幅%</th>
                  <th className="px-4 py-3 text-center">涨速</th>
                  <th className="px-4 py-3 text-center">成交</th>
                  <th className="px-4 py-3 text-right">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {bonds.map((bond) => (
                  <tr key={bond.f12} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-100">{bond.f14}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{bond.f12}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-200">{bond.f2.toFixed(2)}</td>
                    <td className={`px-4 py-3 font-bold ${bond.f3 >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {bond.f3 >= 0 ? '+' : ''}{bond.f3.toFixed(2)}%
                    </td>
                    <td className={`px-4 py-3 text-center ${Math.abs(bond.f22) >= 1 ? 'animate-blink-red rounded px-1' : ''}`}>
                       <span className={`font-mono ${bond.f22 >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                         {bond.f22 >= 0 ? '+' : ''}{bond.f22.toFixed(2)}
                       </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-400">{(bond.f6 / 1e8).toFixed(2)}亿</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${bond.f22 > 0.5 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
                        {bond.f22 > 0.5 ? '攀升' : '震荡'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lg:hidden p-2 text-center text-[10px] text-slate-500 bg-slate-900/20 border-t border-slate-700">
            👈 左右滑动查看更多数据
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-lg p-4 md:p-6">
          <h3 className="text-slate-100 font-bold mb-4 flex items-center gap-2 uppercase text-sm md:text-base">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            行业龙头
          </h3>
          <div className="space-y-4">
            {sectors.map((sector, idx) => (
              <div key={sector.f12} className="p-3 md:p-4 bg-slate-900/50 rounded-xl border border-slate-700 hover:border-amber-500/30 transition-all">
                <div className="flex justify-between items-start mb-2 md:mb-3">
                  <div>
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest block mb-0.5">RANK {idx + 1}</span>
                    <h4 className="font-bold text-slate-100 text-sm md:text-base">{sector.f14}</h4>
                  </div>
                  <div className={`text-sm md:text-lg font-bold ${sector.f3 >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {sector.f3 >= 0 ? '+' : ''}{sector.f3.toFixed(2)}%
                  </div>
                </div>
                {sector.leaders && (
                  <div className="grid grid-cols-1 gap-1.5 text-[10px] md:text-xs">
                    <div className="flex justify-between p-1.5 bg-slate-800 rounded border border-slate-700/50">
                      <span className="text-slate-500">强度:</span>
                      <span className="text-red-400 font-medium">{sector.leaders.gainer.name}</span>
                    </div>
                    <div className="flex justify-between p-1.5 bg-slate-800 rounded border border-slate-700/50">
                      <span className="text-slate-500">成交:</span>
                      <span className="text-slate-200 font-medium">{sector.leaders.volume.name}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-700 shadow-lg">
        <h3 className="text-slate-100 font-bold mb-4 md:mb-6 flex items-center gap-2 uppercase text-sm md:text-base">
          <Clock className="w-4 h-4 text-purple-400" />
          5分钟轮动轨迹
        </h3>
        <div className="h-[200px] md:h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickMargin={5} />
              <YAxis stroke="#94a3b8" fontSize={10} unit="%" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', fontSize: '10px' }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{fontSize: '10px'}}/>
              {sectors.map((s, idx) => (
                <Line 
                  key={s.f14} 
                  type="monotone" 
                  dataKey={`data.${s.f14}`} 
                  name={s.f14}
                  stroke={idx === 0 ? '#f87171' : idx === 1 ? '#fbbf24' : '#60a5fa'} 
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 max-w-sm w-full relative shadow-2xl">
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-2xl">
                  <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">在手机上查看</h3>
                <p className="text-slate-400 text-sm">
                  请使用手机浏览器或微信扫描上方二维码，即可同步实时监控盘面。
                </p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-xl border border-slate-700 text-xs font-mono text-slate-400 break-all">
                <Share2 className="w-4 h-4 shrink-0" />
                {currentUrl}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center md:text-left grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-slate-500 pt-4">
        <p>数据来源：东方财富网 | 系统状态：{isTrading ? '实时' : '复盘'}</p>
        <p className="md:text-right">© 2024 MASTER STRATEGIST WEB</p>
      </footer>
    </div>
  );
};

export default App;
