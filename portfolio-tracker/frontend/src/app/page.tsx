"use client"

import { useState, useEffect, useRef, Fragment, useMemo } from 'react';
import { Plus, Minus, RefreshCw, TrendingUp, Search, Wallet, ArrowUpRight, ArrowDownRight, Trash2, X, PieChart as PieChartIcon, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Pencil, MoreVertical } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import { BIST_STOCKS } from '@/data/bist_stocks';
import { CRYPTO_COINS } from '@/data/crypto_coins';
import { METALS } from '@/data/metals';
import { TEFAS_FUNDS } from '@/data/tefas_funds';

// Cash currencies
const CASH_CURRENCIES = [
  { symbol: 'CASH_TRY', name: 'Türk Lirası (₺)' },
  { symbol: 'CASH_USD', name: 'Amerikan Doları ($)' },
  { symbol: 'CASH_EUR', name: 'Euro (€)' },
  { symbol: 'CASH_GBP', name: 'İngiliz Sterlini (£)' },
  { symbol: 'CASH_CHF', name: 'İsviçre Frangı' },
  { symbol: 'CASH_JPY', name: 'Japon Yeni (¥)' },
  { symbol: 'CASH_GOLD', name: 'Altın (Gram)' },
];
    

interface Holding {
  id: number;
  symbol: string;
  name: string;
  quantity: number;
  average_cost: number;
  current_price: number;
  total_value: number;
  profit_loss: number;
  profit_loss_pct: number;
  total_value_try: number;
  profit_loss_try: number;
  daily_change_pct: number;
  currency: string;
}

export default function Home() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReduceModalOpen, setIsReduceModalOpen] = useState(false);
  const [reduceHolding, setReduceHolding] = useState<Holding | null>(null);
  const [reduceQuantity, setReduceQuantity] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editHolding, setEditHolding] = useState<Holding | null>(null);
  const [editCost, setEditCost] = useState('');
  const [openActionMenu, setOpenActionMenu] = useState<number | null>(null);

  // Form State
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState(''); // New: for Total Amt mode
  const [cost, setCost] = useState('');
  const [inputMode, setInputMode] = useState<'quantity' | 'amount'>('quantity');
  const [currentPrice, setCurrentPrice] = useState(0);
  
  // Constants
  const OZ_TO_GRAM = 31.1034768;
  // Autocomplete State
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'BIST' | 'Crypto' | 'Metals' | 'Funds' | 'Cash'>('BIST');
  
  const isMetal = activeCategory === 'Metals';
  const [filteredStocks, setFilteredStocks] = useState<any[]>(BIST_STOCKS);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Update filtered stocks when Category or Symbol changes
  useEffect(() => {
    // Determine source
    let sourceData: any[] = BIST_STOCKS;
    if (activeCategory === 'Crypto') sourceData = CRYPTO_COINS;
    if (activeCategory === 'Metals') sourceData = METALS;
    if (activeCategory === 'Funds') sourceData = TEFAS_FUNDS;
    if (activeCategory === 'Cash') sourceData = CASH_CURRENCIES;
    
    if (symbol === '') {
        setFilteredStocks(sourceData);
    } else {
        const filtered = sourceData.filter((stock: any) => 
            stock.symbol.toLowerCase().includes(symbol.toLowerCase()) || 
            stock.name.toLowerCase().includes(symbol.toLowerCase())
        );
        setFilteredStocks(filtered);
    }
  }, [symbol, activeCategory]);
  
  const [historyData, setHistoryData] = useState([]);
  
  // Colors for Pie Chart
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

  // App State
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const fetchHoldings = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://141.144.249.56:8000/holdings');
      if (!res.ok) throw new Error('Failed to fetch holdings');
      const data = await res.json();
      setHoldings(data);
      setError('');
      
      // Fetch History if holdings exist
      if (data.length > 0) {
          fetchHistory();
      }
    } catch (err) {
      setError('Could not load portfolio. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };
  
  const [portfolioStats, setPortfolioStats] = useState<any>(null);
  const [selectedStat, setSelectedStat] = useState<any>(null);
  const [activeTotalModal, setActiveTotalModal] = useState<'VALUE' | 'PL' | null>(null);
  const [activePeriod, setActivePeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const fetchHistory = async () => {
      try {
          const res = await fetch('http://141.144.249.56:8000/portfolio/history');
          if (res.ok) {
              const data = await res.json();
              setHistoryData(data);
          }
          
          // Fetch Stats
          const statsRes = await fetch('http://141.144.249.56:8000/portfolio/stats');
          if (statsRes.ok) {
              const statsData = await statsRes.json();
              setPortfolioStats(statsData);
          }
      } catch (e) {
          console.error("Failed to fetch history/stats");
      }
  };

  useEffect(() => {
    fetchHoldings();

    // Click outside to close standard autocomplete dropdown
    function handleClickOutside(event: MouseEvent) {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
          setShowSuggestions(false);
        }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);



  const handleSelectStock = async (stockSymbol: string) => {
      setSymbol(stockSymbol);
      setShowSuggestions(false);
      
      // Fetch Price
      setFetchingPrice(true);
      try {
        const res = await fetch(`http://141.144.249.56:8000/price/${stockSymbol}`);
        if (res.ok) {
            const data = await res.json();
            if (data.price) {
                let price = data.price;
                if (isMetal) price = price / OZ_TO_GRAM; // Convert Ounce Price to Gram Price
                
                setCost(price.toFixed(2));
                setCurrentPrice(price);
            }
        }
      } catch (e) {
        console.error("Failed to fetch price", e);
      } finally {
        setFetchingPrice(false);
      }
  };

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Special handling for Cash - simple amount input
    if (activeCategory === 'Cash') {
      const cashAmount = parseFloat(quantity);
      if (!symbol || cashAmount <= 0) {
        setError('Para birimi seçin ve miktar girin');
        return;
      }
      
      setAdding(true);
      setError('');
      
      try {
        const res = await fetch('http://141.144.249.56:8000/holdings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            symbol: symbol,
            quantity: cashAmount,
            unit_cost: 1  // Cash is always 1:1
          }),
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || 'Failed to add cash');
        }
        
        setSymbol('');
        setQuantity('');
        setIsModalOpen(false);
        await fetchHoldings();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setAdding(false);
      }
      return;
    }
    
    // Calculate final quantity
    let finalQuantity = 0;
    if (inputMode === 'quantity') {
        finalQuantity = parseFloat(quantity);
    } else {
        if (!cost || parseFloat(cost) === 0) {
            setError('Cost is required for By Amount calculation');
            return;
        }
        // Round to nearest integer ONLY for BIST stocks
        if (activeCategory === 'BIST') {
            finalQuantity = Math.round(parseFloat(amount) / parseFloat(cost));
            if (finalQuantity === 0) finalQuantity = 1; // Ensure at least 1 share
        } else {
            // For Crypto, Metals, and Funds, allow precise decimals
            finalQuantity = parseFloat(amount) / parseFloat(cost);
        }
    }

    if (!symbol || finalQuantity <= 0 || !cost) return;

    setAdding(true);
    setError('');

    try {
      // Prepare data for backend
      // If Metal: Quantity (Grams) -> Ounces, Unit Cost (Per Gram) -> Per Ounce
      const payloadQuantity = isMetal ? finalQuantity / OZ_TO_GRAM : finalQuantity;
      const payloadUnitCost = isMetal ? parseFloat(cost) * OZ_TO_GRAM : parseFloat(cost);

      const res = await fetch('http://141.144.249.56:8000/holdings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            symbol,
            quantity: payloadQuantity,
            unit_cost: payloadUnitCost
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to add holding');
      }

      // Reset Form
      setSymbol('');
      setQuantity('');
      setAmount('');
      setCost('');
      setCurrentPrice(0);
      setIsModalOpen(false); // Close Modal
      fetchHoldings();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const handleRefresh = async () => {
      setIsRefreshing(true);
      try {
          // Trigger backend refresh
          await fetch('http://141.144.249.56:8000/refresh', { method: 'POST' });
          // Fetch updated holdings
          await fetchHoldings();
          setLastUpdated(new Date());
      } catch (e) {
          console.error("Refresh failed", e);
      } finally {
          setIsRefreshing(false);
      }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this holding?")) return;

    try {
        const res = await fetch(`http://141.144.249.56:8000/holdings/${id}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete');
        fetchHoldings();
    } catch (err) {
        alert("Error deleting holding");
    }
  };

  // Quick add: Open modal with symbol pre-filled
  const handleQuickAdd = (holding: Holding) => {
    // Determine category based on symbol
    if (['-USD', 'BTC', 'ETH', 'SOL', 'AVAX'].some(s => holding.symbol.includes(s))) {
      setActiveCategory('Crypto');
    } else if (holding.symbol.includes('=') || ['GC=F', 'SI=F', 'PL=F', 'PA=F', 'HG=F'].includes(holding.symbol)) {
      setActiveCategory('Metals');
    } else if (holding.symbol.length === 3 && /^[A-Z0-9]+$/.test(holding.symbol)) {
      setActiveCategory('Funds');
    } else {
      setActiveCategory('BIST');
    }
    setSymbol(holding.symbol);
    setQuantity('');
    setCost('');
    setAmount('');
    setIsModalOpen(true);
  };

  // Open reduce modal
  const handleOpenReduceModal = (holding: Holding) => {
    setReduceHolding(holding);
    setReduceQuantity('');
    setIsReduceModalOpen(true);
  };

  // Submit reduce
  const handleReduceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reduceHolding || !reduceQuantity) return;
    
    const qty = parseFloat(reduceQuantity);
    if (qty <= 0 || qty > reduceHolding.quantity) {
      alert('Geçersiz miktar');
      return;
    }

    try {
      const res = await fetch(`http://141.144.249.56:8000/holdings/${reduceHolding.id}/reduce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Reduce failed');
      }
      
      setIsReduceModalOpen(false);
      setReduceHolding(null);
      setReduceQuantity('');
      await fetchHoldings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Open edit modal
  const handleOpenEditModal = (holding: Holding) => {
    setEditHolding(holding);
    setEditCost(holding.average_cost.toString());
    setIsEditModalOpen(true);
  };

  // Submit edit cost
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editHolding || !editCost) return;
    
    const newCost = parseFloat(editCost);
    if (newCost <= 0) {
      alert('Geçersiz maliyet');
      return;
    }

    try {
      const res = await fetch(`http://141.144.249.56:8000/holdings/${editHolding.id}/update-cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ average_cost: newCost })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Update failed');
      }
      
      setIsEditModalOpen(false);
      setEditHolding(null);
      setEditCost('');
      await fetchHoldings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const totalPortfolioValue = holdings.reduce((acc, h) => acc + h.total_value_try, 0);
  const totalProfitLoss = holdings.reduce((acc, h) => acc + h.profit_loss_try, 0);
  const totalPortfolioCost = totalPortfolioValue - totalProfitLoss; // Derived back for Percentage calculation
  const totalProfitLossPct = totalPortfolioCost > 0 ? (totalProfitLoss / totalPortfolioCost) * 100 : 0;
  
  // Pie Chart State
  const [activeIndex, setActiveIndex] = useState(0);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  // Sorting Logic
  const [sortConfig, setSortConfig] = useState<{key: keyof Holding | '', direction: 'asc' | 'desc'}>({ key: 'profit_loss', direction: 'desc' });

  const requestSort = (key: keyof Holding) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedHoldings = [...holdings].sort((a, b) => {
      if (!sortConfig.key) return 0;
      
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
  });
  
  // Grouping Logic
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'BIST': true,
    'Crypto': true,
    'Metals': true
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({...prev, [group]: !prev[group]}));
  };

  const getAssetGroup = (symbol: string) => {
      // Cash holdings start with CASH_
      if (symbol.startsWith('CASH_')) return 'Nakit';
      if (['-USD', 'BTC', 'ETH', 'SOL', 'AVAX'].some(s => symbol.includes(s))) return 'Crypto';
      if (symbol.includes('=') || ['GC=F', 'SI=F', 'PL=F', 'PA=F', 'HG=F'].includes(symbol)) return 'Metals';
      // TEFAS Funds: 3-letter alphanumeric symbols (no suffix like .IS)
      if (symbol.length === 3 && /^[A-Z0-9]+$/.test(symbol)) return 'Funds';
      return 'BIST';
  };

  const groupedHoldings = sortedHoldings.reduce((acc, h) => {
      const group = getAssetGroup(h.symbol);
      if (!acc[group]) acc[group] = [];
      acc[group].push(h);
      return acc;
  }, {} as Record<string, Holding[]>);

  const groupTotals = Object.entries(groupedHoldings).map(([group, items]) => {
      const totalValue = items.reduce((sum, h) => sum + h.total_value_try, 0);
      const totalPL = items.reduce((sum, h) => sum + h.profit_loss_try, 0);
      return { group, totalValue, totalPL };
  });

  // Aggregate chart data based on period
  const aggregatedChartData = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];
    
    if (chartPeriod === 'daily') {
      return historyData;
    }
    
    if (chartPeriod === 'weekly') {
      // Group by week
      const weeks: Record<string, { date: string; value: number; count: number }> = {};
      historyData.forEach((item: any) => {
        const d = new Date(item.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        if (!weeks[weekKey]) {
          weeks[weekKey] = { date: weekKey, value: 0, count: 0 };
        }
        weeks[weekKey].value = item.value; // Take latest value of the week
        weeks[weekKey].count++;
      });
      return Object.values(weeks).sort((a, b) => a.date.localeCompare(b.date));
    }
    
    if (chartPeriod === 'monthly') {
      // Group by month
      const months: Record<string, { date: string; value: number; label: string }> = {};
      const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
      historyData.forEach((item: any) => {
        const d = new Date(item.date);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = monthNames[d.getMonth()];
        if (!months[monthKey]) {
          months[monthKey] = { date: monthKey, value: 0, label };
        }
        months[monthKey].value = item.value; // Take latest value of the month
      });
      return Object.values(months).sort((a, b) => a.date.localeCompare(b.date));
    }
    
    return historyData;
  }, [historyData, chartPeriod]);

  const renderActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
      <g>
        <text x={cx} y={cy} dy={-18} textAnchor="middle" fill="#9ca3af" fontSize={12} fontWeight={600}>
          {payload.symbol}
        </text>
        <text x={cx} y={cy} dy={4} textAnchor="middle" fill="#6b7280" fontSize={10} fontWeight={400}>
           {payload.name && payload.name.length > 20 ? payload.name.substring(0, 20) + '...' : payload.name}
        </text>
        <text x={cx} y={cy} dy={24} textAnchor="middle" fill="#f3f4f6" fontSize={16} fontWeight="bold">
          {payload.currency === 'USD' ? '$' : '₺'}{payload.currency === 'USD' ? payload.total_value.toLocaleString('en-US', {maximumFractionDigits:0}) : payload.total_value.toLocaleString('tr-TR', {maximumFractionDigits:0})}
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 6}
          outerRadius={outerRadius + 10}
          fill={fill}
        />
      </g>
    );
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8 font-sans relative">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Title Card */}
            <div className="md:col-span-1 flex flex-col justify-center space-y-2">
                <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center space-x-3">
                        <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/20">
                        <Wallet className="w-8 h-8 text-white" />
                        </div>
                        <div>
                        <h1 className="text-3xl font-bold tracking-tight">My Portfolio</h1>
                        <p className="text-gray-400 text-sm">Track your BIST investments</p>
                        </div>
                    </div>
                </div>
                
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-2xl font-bold text-white shadow-lg shadow-blue-900/30 transition-all active:scale-95 flex items-center justify-center text-lg space-x-2 border border-blue-400/20"
                >
                    <Plus className="w-6 h-6" />
                    <span>Add New Transaction</span>
                </button>
            </div>

            {/* Total Balance Card */}
            <div 
                onClick={() => setActiveTotalModal('VALUE')}
                className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-sm cursor-pointer hover:bg-gray-800 transition-all group"
            >
                <div className="flex items-center justify-between mb-2">
                     <p className="text-gray-400 text-sm font-medium uppercase tracking-wider group-hover:text-blue-400 transition-colors">Total Portfolio Value</p>
                     <TrendingUp className="w-6 h-6 text-gray-700 group-hover:text-blue-500 transition-colors" />
                </div>
                <h2 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                    ₺{totalPortfolioValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
            </div>

            {/* Profit/Loss Card */}
            <div 
                onClick={() => setActiveTotalModal('PL')}
                className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-sm cursor-pointer hover:bg-gray-800 transition-all group"
            >
                 <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1 group-hover:text-blue-400 transition-colors">Total Profit / Loss</p>
                 <div className="flex items-baseline space-x-3">
                    <h2 className={`text-4xl font-bold ${totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalProfitLoss >= 0 ? '+' : '-'}₺{Math.abs(totalProfitLoss).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h2>
                    <div className={`flex items-center text-sm font-bold px-2 py-1 rounded-full ${totalProfitLossPct >= 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {totalProfitLossPct >= 0 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                        {Math.abs(totalProfitLossPct).toFixed(2)}%
                    </div>
                 </div>
            </div>
        </div>

            {/* Portfolio Stats Grid */}
            {portfolioStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Daily Return', data: portfolioStats.daily, period: 'Daily' },
                        { label: 'Weekly Return', data: portfolioStats.weekly, period: 'Weekly' },
                        { label: 'Monthly Return', data: portfolioStats.monthly, period: 'Monthly' },
                        { label: 'Yearly Return', data: portfolioStats.yearly, period: 'Yearly' },
                    ].map((stat) => {
                        // Safety check: ensure stat.data exists
                        if (!stat.data) {
                            return (
                                <div key={stat.label} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 shadow-lg relative overflow-hidden opacity-50">
                                     <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{stat.label}</h3>
                                     <div className="text-xl font-bold text-gray-600">No Data</div>
                                </div>
                            );
                        }

                        return (
                        <div 
                            key={stat.label} 
                            onClick={() => setSelectedStat(stat)}
                            className="bg-gray-900 p-4 rounded-2xl border border-gray-800 shadow-lg relative overflow-hidden group hover:border-gray-700 transition-all cursor-pointer hover:transform hover:scale-105"
                        >
                            <div className={`absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity ${stat.data.current.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                <TrendingUp className="w-12 h-12" />
                            </div>
                            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{stat.label}</h3>
                            <div className={`text-xl font-bold ${stat.data.current.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {stat.data.current.value >= 0 ? '+' : '-'}₺{Math.abs(stat.data.current.value).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                            </div>
                            <div className={`text-xs font-semibold mt-1 flex items-center ${stat.data.current.percentage >= 0 ? 'text-green-500/70' : 'text-red-500/70'}`}>
                                {stat.data.current.percentage >= 0 ? <ArrowUp className="w-3 h-3 mr-1" /> : <ArrowDown className="w-3 h-3 mr-1" />}
                                {Math.abs(stat.data.current.percentage).toFixed(2)}%
                            </div>
                             {/* Previous Period */}
                            <div className="mt-3 pt-3 border-t border-gray-800/50 flex justify-between items-center text-xs">
                                <span className="text-gray-600">Previous:</span>
                                <span className={`${stat.data.previous.value >= 0 ? 'text-green-500/60' : 'text-red-500/60'}`}>
                                     {stat.data.previous.value >= 0 ? '+' : '-'}₺{Math.abs(stat.data.previous.value).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        </div>
                    )})}
                </div>
            )}
            
            {/* Total History Modal */}
            {activeTotalModal && portfolioStats && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setActiveTotalModal(null)}>
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-white">
                                {activeTotalModal === 'VALUE' ? 'Portfolio Value History' : 'Profit / Loss History'}
                            </h3>
                            <button onClick={() => setActiveTotalModal(null)} className="p-1 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Period Tabs */}
                        <div className="flex border-b border-gray-800">
                            {['daily', 'weekly', 'monthly', 'yearly'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setActivePeriod(p as any)}
                                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activePeriod === p ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        <div className="overflow-y-auto p-4 space-y-2 custom-scrollbar">
                           <div className="grid grid-cols-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                                <div>Date</div>
                                <div className="text-right">Total Value</div>
                                <div className="text-right">Change</div>
                           </div>
                           {portfolioStats[activePeriod]?.history.map((item: any, idx: number) => {
                               let dateLabel = item.date;
                               if (activePeriod === 'monthly') {
                                   const d = new Date(item.date);
                                   dateLabel = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
                               } else if (activePeriod === 'weekly') {
                                    const d = new Date(item.date);
                                   dateLabel = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' (Week)';
                               } else if (activePeriod === 'yearly') {
                                    const d = new Date(item.date);
                                    dateLabel = d.getFullYear().toString();
                               }
                               
                               const totalVal = item.total_value;
                               const changeVal = item.value;
                               const changePct = item.percentage;

                               return (
                               <div key={idx} className="grid grid-cols-3 items-center p-2 rounded-lg hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-800">
                                   <div className="text-sm text-gray-400 font-mono capitalize">{dateLabel}</div>
                                   <div className="text-sm text-right font-medium text-white">
                                        ₺{Math.abs(totalVal).toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                                   </div>
                                   <div className={`text-xs text-right font-bold ${changeVal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                       <div>{changeVal >= 0 ? '+' : '-'}₺{Math.abs(changeVal).toLocaleString('tr-TR', {maximumFractionDigits: 0})}</div>
                                       <div className="opacity-70">{changePct.toFixed(2)}%</div>
                                   </div>
                               </div>
                                );
                           })}
                        </div>
                    </div>
                </div>
            )}

            {/* Total History Modal */}
            {activeTotalModal && portfolioStats && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setActiveTotalModal(null)}>
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-white">
                                {activeTotalModal === 'VALUE' ? 'Portfolio Value History' : 'Profit / Loss History'}
                            </h3>
                            <button onClick={() => setActiveTotalModal(null)} className="p-1 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Period Tabs */}
                        <div className="flex border-b border-gray-800">
                            {['daily', 'weekly', 'monthly', 'yearly'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setActivePeriod(p as any)}
                                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activePeriod === p ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        <div className="overflow-y-auto p-4 space-y-2 custom-scrollbar">
                           <div className="grid grid-cols-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                                <div>Date</div>
                                <div className="text-right">Total Value</div>
                                <div className="text-right">Change</div>
                           </div>
                           {portfolioStats[activePeriod]?.history.map((item: any, idx: number) => {
                               let dateLabel = item.date;
                               if (activePeriod === 'monthly') {
                                   const d = new Date(item.date);
                                   dateLabel = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
                               } else if (activePeriod === 'weekly') {
                                    const d = new Date(item.date);
                                   dateLabel = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' (Week)';
                               } else if (activePeriod === 'yearly') {
                                    const d = new Date(item.date);
                                    dateLabel = d.getFullYear().toString();
                               }
                               
                               const totalVal = item.total_value;
                               const changeVal = item.value;
                               const changePct = item.percentage;

                               return (
                               <div key={idx} className="grid grid-cols-3 items-center p-2 rounded-lg hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-800">
                                   <div className="text-sm text-gray-400 font-mono capitalize">{dateLabel}</div>
                                   <div className="text-sm text-right font-medium text-white">
                                        ₺{Math.abs(totalVal).toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                                   </div>
                                   <div className={`text-xs text-right font-bold ${changeVal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                       <div>{changeVal >= 0 ? '+' : '-'}₺{Math.abs(changeVal).toLocaleString('tr-TR', {maximumFractionDigits: 0})}</div>
                                       <div className="opacity-70">{changePct.toFixed(2)}%</div>
                                   </div>
                               </div>
                                );
                           })}
                        </div>
                    </div>
                </div>
            )}

            {/* Stats History Modal */}
            {selectedStat && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedStat(null)}>
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-white">{selectedStat.period} Performance History</h3>
                            <button onClick={() => setSelectedStat(null)} className="p-1 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-4 space-y-2 custom-scrollbar">
                           <div className="grid grid-cols-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                                <div>Date</div>
                                <div className="text-right">Change</div>
                                <div className="text-right">%</div>
                           </div>
                           {selectedStat.data.history.map((item: any, idx: number) => {
                               let dateLabel = item.date;
                               if (selectedStat.period === 'Monthly') {
                                   const d = new Date(item.date);
                                   dateLabel = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
                               } else if (selectedStat.period === 'Weekly') {
                                    const d = new Date(item.date);
                                   dateLabel = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' (Week)';
                               } else if (selectedStat.period === 'Yearly') {
                                    const d = new Date(item.date);
                                    dateLabel = d.getFullYear().toString();
                               }

                               return (
                               <div key={idx} className="grid grid-cols-3 items-center p-2 rounded-lg hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-800">
                                   <div className="text-sm text-gray-400 font-mono capitalize">{dateLabel}</div>
                                   <div className={`text-sm text-right font-medium ${item.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                       {item.value >= 0 ? '+' : '-'}₺{Math.abs(item.value).toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                                   </div>
                                   <div className={`text-xs text-right ${item.percentage >= 0 ? 'text-green-500/70' : 'text-red-500/70'}`}>
                                       {item.percentage >= 0 ? '+' : ''}{item.percentage.toFixed(2)}%
                                   </div>
                               </div>
                                );
                           })}
                        </div>
                    </div>
                </div>
            )}

        {/* Charts Section */}
        {holdings.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Evolution Chart */}
                <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-200 flex items-center">
                            <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
                            Portfolio Evolution
                        </h3>
                        {/* Period Tabs */}
                        <div className="flex bg-gray-800 rounded-lg p-1">
                            {(['daily', 'weekly', 'monthly'] as const).map((period) => (
                                <button
                                    key={period}
                                    onClick={() => setChartPeriod(period)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                        chartPeriod === period 
                                            ? 'bg-blue-600 text-white' 
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    {period === 'daily' ? 'Günlük' : period === 'weekly' ? 'Haftalık' : 'Aylık'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={aggregatedChartData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis 
                                    dataKey={chartPeriod === 'monthly' ? 'label' : 'date'}
                                    tick={{fill: '#6b7280', fontSize: 12}} 
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(str: string) => {
                                        if (chartPeriod === 'monthly') return str;
                                        const date = new Date(str);
                                        if (chartPeriod === 'weekly') {
                                            return `W${Math.ceil(date.getDate() / 7)}`;
                                        }
                                        return `${date.getDate()}/${date.getMonth()+1}`;
                                    }}
                                />
                                <YAxis 
                                    tick={{fill: '#6b7280', fontSize: 12}} 
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value: number) => `₺${value/1000}k`}
                                    domain={['auto', 'auto']}
                                />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.75rem'}}
                                    itemStyle={{color: '#e5e7eb'}}
                                    formatter={(value: any) => [`₺${(value || 0).toLocaleString('tr-TR')}`, 'Value']}
                                    labelStyle={{color: '#9ca3af', marginBottom: '0.25rem'}}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#3b82f6" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorValue)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribution Chart */}
                <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl">
                    <h3 className="text-lg font-bold text-gray-200 mb-6 flex items-center">
                        <PieChartIcon className="w-5 h-5 mr-2 text-purple-500" />
                        Asset Allocation
                    </h3>
                    <div className="h-[300px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={holdings as any}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="total_value_try"
                                >
                                    {holdings.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.75rem'}}
                                    itemStyle={{color: '#e5e7eb'}}
                                    formatter={(value: any, name: any, props: any) => [
                                        `₺${(value || 0).toLocaleString('tr-TR', {maximumFractionDigits: 0})}`, 
                                        props.payload.name || props.payload.symbol
                                    ]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Custom Legend */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                            <span className="text-2xl font-bold text-white">{holdings.length}</span>
                            <span className="block text-xs text-gray-400">Assets</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 mt-4 max-h-24 overflow-y-auto">
                        {holdings.map((entry, index) => (
                            <div key={entry.symbol} className="flex items-center text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded-full">
                                <div className="w-2 h-2 rounded-full mr-1.5" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                                {entry.symbol} {((entry.total_value_try / totalPortfolioValue) * 100).toFixed(0)}%
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Modal Overlay */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-gray-900 w-full max-w-lg rounded-3xl border border-gray-800 shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-200">
                    
                    {/* Modal Header */}
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                        <h2 className="text-xl font-bold text-white flex items-center">
                            <Plus className="w-5 h-5 mr-3 text-blue-500" />
                            Add Transaction
                        </h2>
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Category Tabs */}
                    <div className="flex p-1 bg-gray-800 rounded-xl mb-6">
                        {(['BIST', 'Crypto', 'Funds', 'Metals', 'Cash'] as const).map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => {
                                    setActiveCategory(cat);
                                    setSymbol('');
                                    setCost('');
                                    setQuantity('');
                                    setAmount('');
                                }}
                                className={`flex-1 py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${activeCategory === cat ? 'bg-gray-700 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                {cat === 'Cash' ? 'Nakit' : cat}
                            </button>
                        ))}
                    </div>

                    {/* Modal Body */}
                    <div className="p-6">
                         <form onSubmit={handleAddHolding} className="space-y-6">
                            
                            {/* Cash Category - Simple Form */}
                            {activeCategory === 'Cash' ? (
                              <>
                                {/* Currency Selection */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-2 ml-1">PARA BİRİMİ SEÇİN</label>
                                  <div className="grid grid-cols-3 gap-2">
                                    {CASH_CURRENCIES.map((curr) => (
                                      <button
                                        key={curr.symbol}
                                        type="button"
                                        onClick={() => setSymbol(curr.symbol)}
                                        className={`py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                                          symbol === curr.symbol 
                                            ? 'bg-blue-600 border-blue-500 text-white' 
                                            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                                        }`}
                                      >
                                        {curr.name.split(' ')[0]}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                
                                {/* Amount Input */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-2 ml-1">
                                    MİKTAR {symbol ? `(${symbol.replace('CASH_', '')})` : ''}
                                  </label>
                                  <input
                                    type="number"
                                    step="any"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-gray-950 border border-gray-700 rounded-xl py-4 px-4 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder-gray-600 text-white font-bold text-2xl text-center"
                                  />
                                </div>
                                
                                {error && (
                                  <div className="text-red-400 text-sm text-center">{error}</div>
                                )}
                                
                                <button
                                  type="submit"
                                  disabled={adding || !symbol || !quantity}
                                  className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:from-gray-600 disabled:to-gray-600 rounded-xl font-bold text-white text-lg transition-all flex items-center justify-center shadow-lg shadow-green-900/30"
                                >
                                  {adding ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  ) : (
                                    'Nakit Ekle'
                                  )}
                                </button>
                              </>
                            ) : (
                              <>
                            {/* Input Mode Toggle */}
                            <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
                                <button
                                    type="button"
                                    onClick={() => setInputMode('quantity')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                                        inputMode === 'quantity' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                                    }`}
                                >
                                    {activeCategory === 'Metals' ? 'By Quantity (Gram)' : 'By Quantity (Adet)'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInputMode('amount')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                                        inputMode === 'amount' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                                    }`}
                                >
                                    By Amount (Tutar)
                                </button>
                            </div>

                            {/* Symbol Input with Autocomplete */}
                            <div className="relative" ref={wrapperRef}>
                                <label className="block text-xs font-medium text-gray-500 mb-2 ml-1">STOCK SYMBOL</label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                                    <input
                                        type="text"
                                        value={symbol}
                                        onChange={(e) => {
                                            setSymbol(e.target.value.toUpperCase());
                                            setShowSuggestions(true);
                                        }}
                                        onFocus={() => setShowSuggestions(true)}
                                        placeholder={
                                            activeCategory === 'BIST' ? "Search BIST stocks (e.g. THYAO)" : 
                                            activeCategory === 'Crypto' ? "Search Crypto (e.g. Bitcoin)" :
                                            activeCategory === 'Metals' ? "Search Metals (e.g. Gold)" :
                                            activeCategory === 'Funds' ? "Search TEFAS Funds (e.g. MAC)" :
                                            "Para birimi seçin (TRY, USD, EUR...)"
                                        }
                                        className="w-full bg-gray-950 border border-gray-700 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder-gray-600 text-white font-medium text-lg uppercase"
                                        autoComplete="off"
                                    />
                                    {fetchingPrice && (
                                        <div className="absolute right-4 top-3.5 w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                    )}
                                </div>
                                
                                {/* Autocomplete Dropdown */}
                                {showSuggestions && (
                                    <div className="absolute z-60 w-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                        {/* Helper text for Funds */}
                                        {activeCategory === 'Funds' && (
                                            <div className="px-4 py-2 text-xs text-blue-400 bg-blue-900/20 border-b border-gray-700">
                                                💡 Tip: Type any 3-letter fund code (e.g. MAC, TCD) - we&apos;ll validate it against TEFAS
                                            </div>
                                        )}
                                        
                                        {filteredStocks.length > 0 ? (
                                            filteredStocks.map((stock) => (
                                                <div
                                                    key={stock.symbol}
                                                    onClick={() => handleSelectStock(stock.symbol)}
                                                    className="px-4 py-3 hover:bg-gray-700 cursor-pointer transition-colors border-b border-gray-700 last:border-0"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-blue-400">{stock.symbol}</span>
                                                        <span className="text-sm text-gray-400 truncate ml-2">{stock.name}</span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                {activeCategory === 'Funds' 
                                                    ? 'No match in popular funds. Try typing the exact 3-letter code!' 
                                                    : 'No matches found'}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-2 ml-1">
                                        {inputMode === 'quantity' ? (activeCategory === 'Metals' ? 'QUANTITY (Gram)' : 'QUANTITY (Adet)') : `TOTAL AMOUNT (${activeCategory === 'BIST' ? '₺' : '$'})`}
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={inputMode === 'quantity' ? quantity : amount}
                                        onChange={(e) => inputMode === 'quantity' ? setQuantity(e.target.value) : setAmount(e.target.value)}
                                        placeholder="0"
                                        className="w-full bg-gray-950 border border-gray-700 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder-gray-600 text-white font-medium text-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-2 ml-1">UNIT COST ({activeCategory === 'BIST' ? '₺' : '$'})</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={cost}
                                        onChange={(e) => setCost(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-gray-950 border border-gray-700 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder-gray-600 text-white font-medium text-lg"
                                    />
                                </div>
                            </div>
                            
                            {/* Calculation Preview */}
                            <div className="flex justify-between items-center px-2 text-sm text-gray-400">
                                <div>
                                    {inputMode === 'amount' && cost && amount && (
                                        <span>
                                            ≈ {activeCategory === 'BIST' 
                                                ? Math.round(parseFloat(amount) / parseFloat(cost)) 
                                                : (parseFloat(amount) / parseFloat(cost)).toFixed(6)} Shares
                                        </span>
                                    )}
                                    {inputMode === 'quantity' && cost && quantity && (
                                        <span>Total: {activeCategory === 'BIST' ? '₺' : '$'}{(parseFloat(quantity) * parseFloat(cost)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                    )}
                                </div>
                                {currentPrice > 0 && (
                                    <span className="text-blue-400">Current Price: {activeCategory === 'BIST' ? '₺' : '$'}{currentPrice.toFixed(2)}</span>
                                )}
                            </div>


                            {error && (
                                <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-400 text-sm flex items-center">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></span>
                                {error}
                                </div>
                            )}

                             <button
                                type="submit"
                                disabled={adding || !symbol || !cost || (inputMode === 'quantity' ? !quantity : !amount)}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-xl font-bold text-white transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center justify-center mt-4"
                                >
                                {adding ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    'Invest'
                                )}
                            </button>
                              </>
                            )}
                         </form>
                    </div>
                </div>
            </div>
        )}

        {/* Assets List */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-xl overflow-hidden z-0">
          <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-gray-200">Holdings</h2>
              <div className="flex items-center space-x-4">
                  {lastUpdated && (
                      <span className="text-xs text-gray-500">
                          Last updated: {lastUpdated.toLocaleTimeString()}
                      </span>
                  )}
                  <button 
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className={`p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 transition-all ${isRefreshing ? 'animate-spin text-blue-500' : 'hover:rotate-180 duration-500'}`}
                      title="Refresh All Prices"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
              </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr>
                  {[
                      { label: 'SYMBOL', key: 'symbol', align: 'left' },
                      { label: 'QUANTITY', key: 'quantity', align: 'right' },
                      { label: 'AVG COST', key: 'average_cost', align: 'right' },
                      { label: 'LAST PRICE', key: 'current_price', align: 'right' },
                      { label: 'TOTAL VALUE', key: 'total_value_try', align: 'right' },
                      { label: 'PROFIT / LOSS', key: 'profit_loss_try', align: 'right' },
                  ].map((col) => (
                      <th 
                        key={col.key}
                        onClick={() => requestSort(col.key as keyof Holding)}
                        className={`px-6 py-4 text-${col.align} text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors group select-none`}
                      >
                       <div className={`flex items-center ${col.align === 'right' ? 'justify-end' : 'justify-start'} space-x-1`}>
                            <span>{col.label}</span>
                            {sortConfig.key === col.key && (
                                sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />
                            )}
                       </div>
                      </th>
                  ))}
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      ACTION
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {holdings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-600">
                        <div className="flex flex-col items-center justify-center space-y-3">
                            <Wallet className="w-12 h-12 text-gray-800" />
                            <p>No holdings yet. Add your first stock above!</p>
                        </div>
                    </td>
                  </tr>
                ) : (
                  Object.entries(groupedHoldings).map(([group, groupItems]) => {
                    const groupTotal = groupTotals.find(g => g.group === group);
                    const isExpanded = expandedGroups[group];

                    return (
                        <Fragment key={group}>
                        {/* Group Header */}
                        <tr 
                            key={`group-header-${group}`} 
                            className="bg-gray-800/80 hover:bg-gray-800 cursor-pointer transition-colors"
                            onClick={() => toggleGroup(group)}
                        >
                            <td colSpan={7} className="px-6 py-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2 text-gray-200 font-bold">
                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        <span>{group}</span>
                                        <span className="text-xs font-normal text-gray-500 ml-2">({groupItems.length} assets)</span>
                                    </div>
                                    <div className="flex items-center space-x-6 text-sm">
                                        <div className="text-gray-300">
                                            <span className="text-gray-500 mr-2">Val:</span>
                                            ₺{groupTotal?.totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                                        </div>
                                        <div className={`${groupTotal?.totalPL && groupTotal.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            <span className="text-gray-500 mr-2">P/L:</span>
                                            {groupTotal?.totalPL && groupTotal.totalPL >= 0 ? '+' : ''}₺{groupTotal?.totalPL.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        
                        {/* Group Items */}
                        {isExpanded && groupItems.map((h) => {
                            // Check if this holding is a Metal
                            const isHoldingMetal = ['GC=F', 'SI=F', 'PL=F', 'PA=F', 'HG=F'].includes(h.symbol) || h.symbol.endsWith('=F') || h.symbol.endsWith('=X');
                            
                            const displayQuantity = isHoldingMetal ? h.quantity * OZ_TO_GRAM : h.quantity;
                            const displayAvgCost = isHoldingMetal ? h.average_cost / OZ_TO_GRAM : h.average_cost;
                            const displayCurrentPrice = isHoldingMetal ? h.current_price / OZ_TO_GRAM : h.current_price;

                            return (
                            <tr key={h.id} className="hover:bg-gray-800/50 transition-colors group border-b border-gray-800/50 last:border-0">
                            <td className="px-6 py-5 pl-10">
                                <div className="font-bold text-blue-400">{h.symbol}</div>
                                <div className="text-xs text-gray-500 truncate max-w-[120px]" title={h.name}>
                                    {h.name}
                                </div>
                            </td>
                            <td className="px-6 py-5 text-right text-gray-300 font-mono">
                                {isHoldingMetal 
                                    ? `${displayQuantity.toFixed(2)} g` 
                                    : (h.currency === 'USD' ? Number(displayQuantity.toFixed(8)) : displayQuantity)}
                            </td>
                            <td className="px-6 py-5 text-right text-gray-400 font-mono">
                                {h.currency === 'USD' ? '$' : '₺'}{displayAvgCost.toFixed(2)}
                            </td>
                            <td className="px-6 py-5 text-right font-mono">
                                <div className="font-medium text-gray-200">
                                    {h.currency === 'USD' ? '$' : '₺'}{displayCurrentPrice.toFixed(2)}
                                </div>
                                <div className={`text-xs font-semibold ${h.daily_change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {h.daily_change_pct >= 0 ? '+' : ''}{h.daily_change_pct.toFixed(2)}%
                                </div>
                            </td>
                            <td className="px-6 py-5 text-right font-mono font-bold text-white">
                                <div>
                                    {h.currency === 'USD' ? '$' : h.currency === 'EUR' ? '€' : h.currency === 'GBP' ? '£' : '₺'}{h.total_value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                {h.currency !== 'TRY' && (
                                    <div className="text-xs text-gray-400">
                                        ≈₺{h.total_value_try.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                )}
                            </td>
                            <td className={`px-6 py-5 text-right font-mono font-bold ${h.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                <div className="flex flex-col items-end">
                                    <span>{h.profit_loss >= 0 ? '+' : ''}{h.currency === 'USD' ? '$' : '₺'}{h.profit_loss.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    <span className={`text-xs ${h.profit_loss_pct >= 0 ? 'text-green-500/70' : 'text-red-500/70'}`}>
                                        {h.profit_loss_pct.toFixed(2)}%
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-5 text-center">
                                <div className="relative">
                                    <button 
                                        onClick={() => setOpenActionMenu(openActionMenu === h.id ? null : h.id)}
                                        className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors"
                                        title="İşlemler"
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                    
                                    {/* Dropdown Menu */}
                                    {openActionMenu === h.id && (
                                        <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                                            <button 
                                                onClick={() => { handleQuickAdd(h); setOpenActionMenu(null); }}
                                                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-green-900/30 hover:text-green-400 flex items-center space-x-3 transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span>Ekle</span>
                                            </button>
                                            <button 
                                                onClick={() => { handleOpenReduceModal(h); setOpenActionMenu(null); }}
                                                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-yellow-900/30 hover:text-yellow-400 flex items-center space-x-3 transition-colors"
                                            >
                                                <Minus className="w-4 h-4" />
                                                <span>Azalt</span>
                                            </button>
                                            <button 
                                                onClick={() => { handleOpenEditModal(h); setOpenActionMenu(null); }}
                                                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-blue-900/30 hover:text-blue-400 flex items-center space-x-3 transition-colors"
                                            >
                                                <Pencil className="w-4 h-4" />
                                                <span>Maliyet Düzenle</span>
                                            </button>
                                            <div className="border-t border-gray-700 my-1"></div>
                                            <button 
                                                onClick={() => { handleDelete(h.id); setOpenActionMenu(null); }}
                                                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-red-900/30 hover:text-red-400 flex items-center space-x-3 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                <span>Sil</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </td>
                            </tr>
                        )})
                        }
                        </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reduce Holding Modal */}
      {isReduceModalOpen && reduceHolding && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 w-full max-w-md rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center">
                <Minus className="w-5 h-5 mr-2 text-yellow-500" />
                Varlık Azalt
              </h2>
              <button 
                onClick={() => { setIsReduceModalOpen(false); setReduceHolding(null); }}
                className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleReduceSubmit} className="p-5 space-y-4">
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-400 font-bold text-lg">{reduceHolding.symbol}</span>
                  <span className="text-gray-400 text-sm">{reduceHolding.name}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Mevcut Miktar: <span className="text-white font-medium">{reduceHolding.quantity}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Azaltılacak Miktar</label>
                <input
                  type="number"
                  step="any"
                  max={reduceHolding.quantity}
                  value={reduceQuantity}
                  onChange={(e) => setReduceQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl py-3 px-4 focus:ring-2 focus:ring-yellow-600 focus:border-transparent outline-none transition-all placeholder-gray-600 text-white font-medium text-lg"
                  autoFocus
                />
                {reduceQuantity && parseFloat(reduceQuantity) > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-gray-400">
                      Azaltılacak değer: <span className="text-yellow-400 font-medium">
                        {reduceHolding.currency === 'USD' ? '$' : '₺'}
                        {(parseFloat(reduceQuantity) * reduceHolding.current_price).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </p>
                    <p className="text-sm text-gray-400">
                      Kalan miktar: <span className="text-white font-medium">{(reduceHolding.quantity - parseFloat(reduceQuantity)).toFixed(4)}</span>
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!reduceQuantity || parseFloat(reduceQuantity) <= 0 || parseFloat(reduceQuantity) > reduceHolding.quantity}
                className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:hover:bg-yellow-600 rounded-xl font-bold text-white transition-all"
              >
                Azalt
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Cost Modal */}
      {isEditModalOpen && editHolding && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 w-full max-w-md rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center">
                <Pencil className="w-5 h-5 mr-2 text-blue-500" />
                Maliyet Düzenle
              </h2>
              <button 
                onClick={() => { setIsEditModalOpen(false); setEditHolding(null); }}
                className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-400 font-bold text-lg">{editHolding.symbol}</span>
                  <span className="text-gray-400 text-sm">{editHolding.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-500">
                    Miktar: <span className="text-white font-medium">{editHolding.quantity}</span>
                  </div>
                  <div className="text-gray-500">
                    Mevcut Maliyet: <span className="text-white font-medium">{editHolding.currency === 'USD' ? '$' : '₺'}{editHolding.average_cost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Yeni Ortalama Maliyet ({editHolding.currency === 'USD' ? '$' : '₺'})</label>
                <input
                  type="number"
                  step="any"
                  value={editCost}
                  onChange={(e) => setEditCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder-gray-600 text-white font-medium text-lg"
                  autoFocus
                />
                {editCost && parseFloat(editCost) > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-gray-400">
                      Yeni Toplam Maliyet: <span className="text-blue-400 font-medium">
                        {editHolding.currency === 'USD' ? '$' : '₺'}
                        {(parseFloat(editCost) * editHolding.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!editCost || parseFloat(editCost) <= 0}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-xl font-bold text-white transition-all"
              >
                Kaydet
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
