
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
  Copy,
  Check,
  AlertTriangle,
  Sparkles
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
  const [aiCommentary, setAiCommentary] = useState<string>("等待盘面数据同步...");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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

    try {
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
    } catch (err) {
      console.error("Data fetch error:", err);
    }
    setCountdown(trading ? 30 : 300);
  }, [history.length]);

  const generateAICommentary = async () => {
    if (bonds.length === 0) {
      setAiCommentary("未获取到足够的可转债数据，暂无法开启 AI 分析。");
      return;
    }
    
    setIsAiLoading(true);
    setAiError(null);
    
    try {
      const key = process.env.API_KEY;
      if (!key) {
        throw new Error("API_KEY_MISSING");
      }

      const ai = new GoogleGenAI({ apiKey: key });
      const prompt = `你是一位顶级A股盘面分析师。请根据以下实时数据提供专业见解（150字以内）：
1. 可转债活跃前五：${bonds.slice(0, 5).map(b => `${b.f14}(${b.f3}%)`).join(', ')}
2. 领涨行业：${sectors.map(s => `${s.f14}(${s.f3}%)`).join(', ')}
请回答：当前的资金攻击重点在哪里？市场情绪是恐慌还是贪婪？作为策略师你会建议关注什么风险？不要输出废话。`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      if (response && response.text) {
        setAiCommentary(response.text);
      } else {
        throw new Error("EMPTY_RESPONSE");
      }
    } catch (e: any) {
      console.error("AI Insight Generation Failed:", e);
      let errorDesc = "AI 分析遇到了问题";
      
      if (e.message === "API_KEY_MISSING") {
        errorDesc = "未检测到 API KEY。请检查 Vercel 环境变量并 Redeploy。";
      } else if (e.message.includes("fetch")) {
        errorDesc = "网络连接异常。AI 无法连接到 Google 服务，请确认网络环境是否支持。";
      } else if (e.message.includes("429")) {
        errorDesc = "请求太频繁。API 配额已达上限，请稍后再试。";
      }
      
      setAiError(errorDesc);
      setAiCommentary("策略分析中断。");
    } finally {
      setIsAiLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 当市场数据加载完成后，尝试运行一次 AI
  useEffect(() => {
    if (bonds.length > 0 && aiCommentary === "等待盘面数据同步...") {
      generateAICommentary();
    }
  }, [bonds]);

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
    <div className="min-h-screen p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-20 md:pb-8 bg-slate-950 text-slate-50">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="bg-red-500 p-2 md:p-3 rounded-xl shadow-lg shadow-red-500/20">
            <TrendingUp className="text-white w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Master Strategist <span className="text-red-500 italic">WEB</span></h1>
            <p className="text-slate-400 text-[10px] md:text-sm flex items-center gap-2 mt-0.5 md:mt-1">
              <Clock className="w-3 h-3 md:w-4 md:h-4" />
              {lastUpdateTime || '加载中...'} | <span className={isTrading ? "text-green-400 font-semibold" : "text-slate-500"}>{isTrading ? MarketStatus.TRADING : MarketStatus.CLOSED}</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3 justify-between md:justify-end">
          <button 
            onClick={() => setShowQrModal(true)}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 text-slate-300 flex items-center gap-2 text-sm"
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden sm:inline">手机查看</span>
          </button>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${isAutoRefresh ? 'bg-slate-800 text-slate-200' : 'bg-red-600 text-white'}`}
            >
              {isAutoRefresh ? `${countdown}s` : '手动'}
            </button>
            <button 
              onClick={fetchData}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              <RefreshCw className="w-4 h-4 md:w-5 md:h-5 text-slate-300" />
            </button>
          </div>
        </div>
      </header>

      {/* AI Insight Section with Enhanced Feedback */}
      <section className={`relative overflow-hidden p-4 md:p-6 rounded-2xl border transition-all duration-500 shadow-lg ${aiError ? 'border-red-500/30 bg-red-500/5' : 'border-indigo-500/20 bg-gradient-to-br from-indigo-900/40 to-slate-900'}`}>
        {isAiLoading && (
          <div className="absolute top-0 left-0 h-1 bg-indigo-500 animate-loading-bar w-full"></div>
        )}
        
        <div className="flex items-center gap-3 mb-3 md:mb-4">
          <BrainCircuit className={`${aiError ? 'text-red-400' : 'text-indigo-400'} w-5 h-5 md:w-6 md:h-6`} />
          <h2 className="text-sm md:text-lg font-semibold text-indigo-100 uppercase tracking-wider">AI 策略分析</h2>
          {isAiLoading && <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />}
          
          <button 
            onClick={generateAICommentary}
            disabled={isAiLoading}
            className={`ml-auto flex items-center gap-1 text-[10px] px-3 py-1 border rounded-full transition-all ${isAiLoading ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-indigo-500/20 hover:bg-indigo-500/40 border-indigo-500/30 text-indigo-200'}`}
          >
            <RefreshCw className={`w-3 h-3 ${isAiLoading ? 'animate-spin' : ''}`} />
            重新触发
          </button>
        </div>

        {aiError ? (
          <div className="flex items-start gap-3 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs md:text-sm text-red-200 font-medium">诊断报告</p>
              <p className="text-[10px] md:text-xs text-red-300 opacity-80 mt-1">{aiError}</p>
            </div>
          </div>
        ) : (
          <div className={`p-4 rounded-xl bg-slate-950/40 border border-slate-800/50 ${isAiLoading ? 'opacity-50' : 'opacity-100'}`}>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed italic">
              "{aiCommentary}"
            </p>
          </div>
        )}
      </section>

      {/* Main Grid: Market Data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
          <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-slate-100 font-bold flex items-center gap-2 uppercase text-sm md:text-base">
              <Activity className="w-4 h-4 text-cyan-400" />
              可转债行情
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">TOP 8 ACTIVE</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm min-w-[550px]">
              <thead>
                <tr className="bg-slate-950/50 text-slate-400 font-medium">
                  <th className="px-4 py-3">代码名称</th>
                  <th className="px-4 py-3">最新价</th>
                  <th className="px-4 py-3">涨跌幅</th>
                  <th className="px-4 py-3 text-center">涨速</th>
                  <th className="px-4 py-3 text-center">成交额</th>
                  <th className="px-4 py-3 text-right">活跃度</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {bonds.map((bond) => (
                  <tr key={bond.f12} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-100">{bond.f14}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{bond.f12}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-200">{bond.f2.toFixed(3)}</td>
                    <td className={`px-4 py-3 font-bold ${bond.f3 >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {bond.f3 >= 0 ? '+' : ''}{bond.f3.toFixed(2)}%
                    </td>
                    <td className={`px-4 py-3 text-center ${Math.abs(bond.f22) >= 0.8 ? 'animate-blink-red rounded' : ''}`}>
                       <span className={`font-mono ${bond.f22 >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                         {bond.f22 >= 0 ? '+' : ''}{bond.f22.toFixed(2)}
                       </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-400">{(bond.f6 / 1e8).toFixed(2)}亿</td>
                    <td className="px-4 py-3 text-right">
                      <div className={`inline-block h-1.5 rounded-full ${bond.f22 > 0 ? 'bg-red-500' : 'bg-slate-700'}`} style={{ width: `${Math.min(Math.abs(bond.f22) * 20, 100)}%` }}></div>
                    </td>
                  </tr>
                ))}
                {bonds.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500 italic">
                      正在从东方财富网同步实时行情...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sector Panel */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg p-4 md:p-6">
          <h3 className="text-slate-100 font-bold mb-4 flex items-center gap-2 uppercase text-sm md:text-base">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            行业攻击方向
          </h3>
          <div className="space-y-4">
            {sectors.map((sector, idx) => (
              <div key={sector.f12} className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 hover:border-amber-500/30 transition-all">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <span className="text-[10px] text-amber-500/60 font-bold">#0{idx + 1}</span>
                    <h4 className="font-bold text-slate-100">{sector.f14}</h4>
                  </div>
                  <div className={`text-base font-bold ${sector.f3 >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {sector.f3 >= 0 ? '+' : ''}{sector.f3.toFixed(2)}%
                  </div>
                </div>
                {sector.leaders && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-slate-900 rounded-lg text-[11px]">
                      <span className="text-slate-500">强势龙头:</span>
                      <span className="text-red-400 font-bold">{sector.leaders.gainer.name}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-slate-900 rounded-lg text-[11px]">
                      <span className="text-slate-500">主力流向:</span>
                      <span className="text-slate-200">{sector.leaders.volume.name}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart: Sector Rotation */}
      <section className="bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-800 shadow-lg">
        <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2 uppercase text-sm md:text-base">
          <Clock className="w-4 h-4 text-purple-400" />
          行业轮动轨迹 (5分钟采样)
        </h3>
        <div className="h-[250px] md:h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickMargin={10} />
              <YAxis stroke="#64748b" fontSize={10} unit="%" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                itemStyle={{ padding: '2px 0' }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              {sectors.map((s, idx) => (
                <Line 
                  key={s.f14} 
                  type="monotone" 
                  dataKey={`data.${s.f14}`} 
                  name={s.f14}
                  stroke={idx === 0 ? '#f87171' : idx === 1 ? '#fbbf24' : '#60a5fa'} 
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#0f172a', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* QR Share Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-3xl shadow-lg">
                  <img src={qrCodeUrl} alt="QR Code" className="w-44 h-44" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">多端同步分析</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  扫描上方二维码，在手机端实时监控主力资金动向与 AI 策略建议。
                </p>
              </div>
              <button 
                onClick={copyToClipboard}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl transition-all font-bold text-sm ${copied ? 'bg-green-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? '链接已成功复制' : '复制网址以分享'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="text-center md:text-left grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-500 pt-6 border-t border-slate-900">
        <p>实时引擎：EastMoney Push2 | AI 核心：Gemini 3 Flash | 运行环境：浏览器端</p>
        <p className="md:text-right">© 2025 MASTER STRATEGIST • 盘面变化极快，AI 分析仅供参考</p>
      </footer>

      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
        .animate-loading-bar {
          animation: loading-bar 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default App;
