'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Users, Activity, Wallet, TrendingUp, Shield, 
  Search, RefreshCw, Trash2, Edit, ChevronLeft, ChevronRight,
  UserCheck, UserX, Crown, Calendar, Clock, Database,
  ArrowUpRight, ArrowDownRight, Eye, X, Check, Camera, Plus
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface AdminStats {
  total_users: number;
  verified_users: number;
  active_today: number;
  total_holdings: number;
  total_portfolio_value: number;
  total_assets_tracked: number;
  recent_registrations: number;
}

interface UserAdmin {
  id: number;
  email: string;
  is_verified: boolean;
  is_admin: boolean;
  last_login: string | null;
  created_at: string;
  holdings_count: number;
  total_portfolio_value: number;
}

interface ActivityLog {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

interface HoldingAdmin {
  id: number;
  user_id: number;
  user_email: string;
  symbol: string;
  quantity: number;
  average_cost: number;
  current_value: number;
  created_at: string | null;
}

interface SnapshotAdmin {
  id: number;
  user_id: number;
  user_email: string;
  date: string;
  total_value_try: number;
  daily_change_value: number;
  daily_change_pct: number;
  created_at: string | null;
}

export default function AdminPage() {
  const { isAuthenticated, user, accessToken: token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'activity' | 'holdings' | 'snapshots'>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [holdings, setHoldings] = useState<HoldingAdmin[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserAdmin | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<SnapshotAdmin | null>(null);
  const [newSnapshot, setNewSnapshot] = useState<{user_id: string, date: string, total_value_try: string, daily_change_value: string, daily_change_pct: string} | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  // Debug log - this should appear immediately when page loads
  console.log('[Admin Page] Component rendering, authLoading:', authLoading, 'isAuthenticated:', isAuthenticated, 'token:', token ? 'EXISTS' : 'NULL');

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      console.log('[Admin] checkAdmin called, token:', token ? token.substring(0, 20) + '...' : 'NULL');
      console.log('[Admin] API_BASE_URL:', API_BASE_URL);
      
      if (!token) {
        console.log('[Admin] No token, setting loading false');
        setLoading(false);
        return;
      }
      
      try {
        const url = `${API_BASE_URL}/admin/stats`;
        console.log('[Admin] Fetching:', url);
        
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('[Admin] Response status:', res.status);
        
        if (res.status === 403) {
          setError('Bu sayfaya erişim yetkiniz yok');
          setIsAdmin(false);
        } else if (res.status === 404) {
          console.log('[Admin] 404 - endpoint not found');
          setError('Admin endpoint bulunamadı');
          setIsAdmin(false);
        } else if (res.ok) {
          setIsAdmin(true);
          const data = await res.json();
          console.log('[Admin] Stats received:', data);
          setStats(data);
        } else {
          const errorText = await res.text();
          console.log('[Admin] Error response:', errorText);
          setError(`Hata: ${res.status}`);
        }
      } catch (e) {
        console.error('[Admin] Fetch error:', e);
        setError('Bağlantı hatası');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      if (token) {
        checkAdmin();
      } else if (!isAuthenticated) {
        // Only redirect if we're sure auth is done loading and user is not authenticated
        setLoading(false);
      }
    }
  }, [token, authLoading, isAuthenticated]);

  // Fetch data based on active tab
  useEffect(() => {
    if (!isAdmin || !token) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'users') {
          const res = await fetch(`${API_BASE_URL}/admin/users?skip=${currentPage * 50}&limit=50&search=${searchQuery}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) setUsers(await res.json());
        } else if (activeTab === 'activity') {
          const res = await fetch(`${API_BASE_URL}/admin/activity?skip=${currentPage * 100}&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) setActivityLogs(await res.json());
        } else if (activeTab === 'holdings') {
          const res = await fetch(`${API_BASE_URL}/admin/holdings?skip=${currentPage * 100}&limit=100&symbol=${searchQuery}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) setHoldings(await res.json());
        } else if (activeTab === 'snapshots') {
          const userFilter = searchQuery ? `&user_id=${searchQuery}` : '';
          const res = await fetch(`${API_BASE_URL}/admin/snapshots?skip=${currentPage * 100}&limit=100${userFilter}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) setSnapshots(await res.json());
        } else if (activeTab === 'overview') {
          const res = await fetch(`${API_BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) setStats(await res.json());
        }
      } catch (e) {
        console.error('Fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab, token, isAdmin, currentPage, searchQuery]);

  const handleUpdateUser = async (userId: number, updates: Partial<UserAdmin>) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers(users.map(u => u.id === userId ? updated : u));
        setEditingUser(null);
      }
    } catch (e) {
      console.error('Update error:', e);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Bu kullanıcıyı ve tüm verilerini silmek istediğinize emin misiniz?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
      }
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">
            {!isAuthenticated ? 'Giriş Gerekli' : 'Erişim Engellendi'}
          </h1>
          <p className="text-gray-400 mb-4">
            {!isAuthenticated 
              ? 'Admin paneline erişmek için giriş yapmanız gerekiyor' 
              : (error || 'Bu sayfaya erişim yetkiniz yok')}
          </p>
          <div className="flex flex-col space-y-2">
            {!isAuthenticated ? (
              <button 
                onClick={() => router.push('/login')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                Giriş Yap
              </button>
            ) : (
              <button 
                onClick={() => router.push('/')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                Ana Sayfaya Dön
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-purple-500" />
              <h1 className="text-xl font-bold">Admin Panel</h1>
            </div>
            <button 
              onClick={() => router.push('/')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Portföye Dön
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex space-x-2 mb-6 bg-gray-900 p-1 rounded-xl overflow-x-auto">
          {[
            { id: 'overview', label: 'Genel Bakış', icon: TrendingUp },
            { id: 'users', label: 'Kullanıcılar', icon: Users },
            { id: 'activity', label: 'Aktiviteler', icon: Activity },
            { id: 'holdings', label: 'Portföyler', icon: Wallet },
            { id: 'snapshots', label: 'Snapshots', icon: Camera },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setCurrentPage(0); }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard 
                icon={Users} 
                label="Toplam Kullanıcı" 
                value={stats.total_users.toString()} 
                color="blue"
              />
              <StatCard 
                icon={UserCheck} 
                label="Doğrulanmış" 
                value={stats.verified_users.toString()} 
                color="green"
              />
              <StatCard 
                icon={Clock} 
                label="Bugün Aktif" 
                value={stats.active_today.toString()} 
                color="yellow"
              />
              <StatCard 
                icon={Calendar} 
                label="Son 7 Gün Kayıt" 
                value={stats.recent_registrations.toString()} 
                color="purple"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard 
                icon={Wallet} 
                label="Toplam İşlem" 
                value={stats.total_holdings.toString()} 
                color="indigo"
              />
              <StatCard 
                icon={Database} 
                label="Takip Edilen Varlık" 
                value={stats.total_assets_tracked.toString()} 
                color="cyan"
              />
              <StatCard 
                icon={TrendingUp} 
                label="Toplam Portföy Değeri" 
                value={`₺${stats.total_portfolio_value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`} 
                color="emerald"
                large
              />
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="E-posta ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">E-posta</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Durum</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Portföy</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Son Giriş</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-sm text-gray-400">#{u.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            {u.is_admin && <Crown className="w-4 h-4 text-yellow-500" />}
                            <span className="text-white">{u.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center space-x-1">
                            {u.is_verified ? (
                              <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">Doğrulanmış</span>
                            ) : (
                              <span className="px-2 py-1 text-xs bg-gray-500/20 text-gray-400 rounded-full">Bekliyor</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-white font-medium">₺{u.total_portfolio_value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</div>
                          <div className="text-xs text-gray-500">{u.holdings_count} işlem</div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-400">
                          {u.last_login ? new Date(u.last_login).toLocaleDateString('tr-TR') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center space-x-2">
                            <button 
                              onClick={() => setEditingUser(u)}
                              className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
                <span className="text-sm text-gray-500">{users.length} kullanıcı gösteriliyor</span>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    className="p-2 bg-gray-800 rounded-lg disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={users.length < 50}
                    className="p-2 bg-gray-800 rounded-lg disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Kullanıcı</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">İşlem</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Detay</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {activityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {new Date(log.created_at).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-4 py-3 text-white">{log.user_email || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          log.action === 'LOGIN' ? 'bg-green-500/20 text-green-400' :
                          log.action === 'LOGOUT' ? 'bg-gray-500/20 text-gray-400' :
                          log.action === 'REGISTER' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate">
                        {log.details || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{log.ip_address || '-'}</td>
                    </tr>
                  ))}
                  {activityLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        Henüz aktivite kaydı yok
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Holdings Tab */}
        {activeTab === 'holdings' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Sembol ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Kullanıcı</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Sembol</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Miktar</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Ort. Maliyet</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Güncel Değer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {holdings.map((h) => (
                      <tr key={h.id} className="hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-white">{h.user_email}</td>
                        <td className="px-4 py-3 text-blue-400 font-medium">{h.symbol}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{h.quantity.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">₺{h.average_cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">
                          ₺{h.current_value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                    {holdings.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          Portföy bulunamadı
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Snapshots Tab */}
        {activeTab === 'snapshots' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="User ID ile filtrele..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => setNewSnapshot({ user_id: '', date: new Date().toISOString().split('T')[0], total_value_try: '', daily_change_value: '', daily_change_pct: '' })}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Ekle</span>
              </button>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Kullanıcı</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Tarih</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Toplam Değer</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Günlük Değişim</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">%</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Kayit Zamani</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Islem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {snapshots.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-sm text-gray-400">#{s.id}</td>
                        <td className="px-4 py-3 text-white">{s.user_email}</td>
                        <td className="px-4 py-3 text-gray-300">{s.date}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">
                          ₺{s.total_value_try.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${s.daily_change_value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {s.daily_change_value >= 0 ? '+' : ''}₺{s.daily_change_value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${s.daily_change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {s.daily_change_pct >= 0 ? '+' : ''}{s.daily_change_pct.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {s.created_at ? new Date(s.created_at).toLocaleString('tr-TR', { 
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          }) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center space-x-2">
                            <button 
                              onClick={() => setEditingSnapshot(s)}
                              className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={async () => {
                                if (!confirm('Bu snapshot\'ı silmek istediğinize emin misiniz?')) return;
                                try {
                                  await fetch(`${API_BASE_URL}/admin/snapshots/${s.id}`, {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `Bearer ${token}` }
                                  });
                                  setSnapshots(snapshots.filter(snap => snap.id !== s.id));
                                } catch (e) {
                                  console.error('Delete error:', e);
                                }
                              }}
                              className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {snapshots.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          Snapshot bulunamadı
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Snapshot Modal */}
      {editingSnapshot && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setEditingSnapshot(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Snapshot Düzenle</h3>
              <button onClick={() => setEditingSnapshot(null)} className="p-1 hover:bg-gray-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Toplam Değer (TRY)</label>
                <input
                  type="number"
                  value={editingSnapshot.total_value_try}
                  onChange={(e) => setEditingSnapshot({...editingSnapshot, total_value_try: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Günlük Değişim (TRY)</label>
                <input
                  type="number"
                  value={editingSnapshot.daily_change_value}
                  onChange={(e) => setEditingSnapshot({...editingSnapshot, daily_change_value: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Yüzde (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingSnapshot.daily_change_pct}
                  onChange={(e) => setEditingSnapshot({...editingSnapshot, daily_change_pct: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>

              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE_URL}/admin/snapshots/${editingSnapshot.id}`, {
                      method: 'PUT',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        total_value_try: editingSnapshot.total_value_try,
                        daily_change_value: editingSnapshot.daily_change_value,
                        daily_change_pct: editingSnapshot.daily_change_pct
                      })
                    });
                    if (res.ok) {
                      setSnapshots(snapshots.map(s => s.id === editingSnapshot.id ? editingSnapshot : s));
                      setEditingSnapshot(null);
                    }
                  } catch (e) {
                    console.error('Update error:', e);
                  }
                }}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Snapshot Modal */}
      {newSnapshot && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setNewSnapshot(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Yeni Snapshot</h3>
              <button onClick={() => setNewSnapshot(null)} className="p-1 hover:bg-gray-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">User ID</label>
                <input
                  type="number"
                  value={newSnapshot.user_id}
                  onChange={(e) => setNewSnapshot({...newSnapshot, user_id: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tarih (YYYY-MM-DD)</label>
                <input
                  type="date"
                  value={newSnapshot.date}
                  onChange={(e) => setNewSnapshot({...newSnapshot, date: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Toplam Değer (TRY)</label>
                <input
                  type="number"
                  value={newSnapshot.total_value_try}
                  onChange={(e) => setNewSnapshot({...newSnapshot, total_value_try: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="100000"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Günlük Değişim (TRY)</label>
                <input
                  type="number"
                  value={newSnapshot.daily_change_value}
                  onChange={(e) => setNewSnapshot({...newSnapshot, daily_change_value: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="1000"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Yüzde (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newSnapshot.daily_change_pct}
                  onChange={(e) => setNewSnapshot({...newSnapshot, daily_change_pct: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="1.5"
                />
              </div>

              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE_URL}/admin/snapshots`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        user_id: parseInt(newSnapshot.user_id),
                        date: newSnapshot.date,
                        total_value_try: parseFloat(newSnapshot.total_value_try) || 0,
                        daily_change_value: parseFloat(newSnapshot.daily_change_value) || 0,
                        daily_change_pct: parseFloat(newSnapshot.daily_change_pct) || 0
                      })
                    });
                    if (res.ok) {
                      setNewSnapshot(null);
                      // Refresh snapshots
                      const refreshRes = await fetch(`${API_BASE_URL}/admin/snapshots?limit=100`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      if (refreshRes.ok) setSnapshots(await refreshRes.json());
                    }
                  } catch (e) {
                    console.error('Create error:', e);
                  }
                }}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors"
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setEditingUser(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Kullanıcı Düzenle</h3>
              <button onClick={() => setEditingUser(null)} className="p-1 hover:bg-gray-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">E-posta</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-gray-300">Doğrulanmış</span>
                <button
                  onClick={() => setEditingUser({...editingUser, is_verified: !editingUser.is_verified})}
                  className={`w-10 h-6 rounded-full transition-colors ${editingUser.is_verified ? 'bg-green-500' : 'bg-gray-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${editingUser.is_verified ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-gray-300">Admin</span>
                <button
                  onClick={() => setEditingUser({...editingUser, is_admin: !editingUser.is_admin})}
                  className={`w-10 h-6 rounded-full transition-colors ${editingUser.is_admin ? 'bg-purple-500' : 'bg-gray-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${editingUser.is_admin ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

              <button
                onClick={() => handleUpdateUser(editingUser.id, {
                  email: editingUser.email,
                  is_verified: editingUser.is_verified,
                  is_admin: editingUser.is_admin
                })}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ icon: Icon, label, value, color, large = false }: { 
  icon: any; 
  label: string; 
  value: string; 
  color: string;
  large?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-400',
    green: 'from-green-500/20 to-green-600/5 border-green-500/30 text-green-400',
    yellow: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/30 text-yellow-400',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30 text-purple-400',
    indigo: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/30 text-indigo-400',
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30 text-cyan-400',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-4 ${large ? 'p-6' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${colorMap[color].split(' ').pop()}`} />
      </div>
      <div className={`font-bold text-white ${large ? 'text-2xl' : 'text-xl'}`}>{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}
