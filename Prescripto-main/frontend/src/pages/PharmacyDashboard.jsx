import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../config/api';
import { useRealtimeSubscription } from '../hooks/useRealtime';
import Button from '../components/Button';
import Input from '../components/Input';
import HeaderBar from '../components/HeaderBar';
import ProfileDrawer from '../components/ProfileDrawer';
import NotificationsPanel from '../components/NotificationsPanel';
import RequestsScreen from '../components/RequestsScreen';
import MobileBottomNavigation from '../components/MobileBottomNavigation';

export default function PharmacyDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, authReady, logout, getToken } = useAuth();
  const { t } = useLanguage();

  const [pharmacy, setPharmacy] = useState(null);
  const [stock, setStock] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const view = searchParams.get('tab') || 'home';

  const setView = useCallback(
    (newTab) => {
      if (!newTab || newTab === 'home') {
        setSearchParams({});
      } else {
        setSearchParams({ tab: newTab });
      }
    },
    [setSearchParams]
  );

  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  // Add Stock Form State
  const [medicineName, setMedicineName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Inventory Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'available' | 'low' | 'out'

  const refreshData = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const [stockData, requestData] = await Promise.all([
        api.pharmacies.stock(token),
        api.pharmacies.requests(token),
      ]);
      setStock(Array.isArray(stockData) ? stockData : []);
      setRequests(Array.isArray(requestData) ? requestData : []);
    } catch (_) {}
  }, [getToken]);

  useEffect(() => {
    if (!authReady) return;
    if (!user || user.role !== 'pharmacy') {
      navigate('/pharmacy/login', { replace: true });
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const [me, stockData, requestData] = await Promise.all([
          api.pharmacies.me(token),
          api.pharmacies.stock(token),
          api.pharmacies.requests(token),
        ]);
        if (!cancelled) {
          setPharmacy(me);
          setStock(Array.isArray(stockData) ? stockData : []);
          setRequests(Array.isArray(requestData) ? requestData : []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load pharmacy data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [authReady, user, getToken, navigate]);

  // Supabase Realtime Subscription (No polling overhead)
  useRealtimeSubscription(
    ['medicine_requests', 'pharmacy_stock'],
    refreshData,
    Boolean(user && user.role === 'pharmacy')
  );

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'pending'),
    [requests]
  );
  const readyRequests = useMemo(
    () => requests.filter((r) => r.status === 'ready'),
    [requests]
  );
  const deliveredRequests = useMemo(
    () => requests.filter((r) => r.status === 'picked_up' || r.status === 'delivered'),
    [requests]
  );

  // Stock Derived Analytics
  const lowStockItems = useMemo(
    () => stock.filter((item) => Number(item.quantity) > 0 && Number(item.quantity) <= 5),
    [stock]
  );
  const outOfStockItems = useMemo(
    () => stock.filter((item) => Number(item.quantity) === 0),
    [stock]
  );

  // Stock Search & Filter Logic
  const filteredStock = useMemo(() => {
    return stock.filter((item) => {
      const matchesSearch = String(item.medicineName || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const qty = Number(item.quantity) || 0;

      if (!matchesSearch) return false;
      if (stockFilter === 'available') return qty > 5;
      if (stockFilter === 'low') return qty > 0 && qty <= 5;
      if (stockFilter === 'out') return qty === 0;
      return true;
    });
  }, [stock, searchQuery, stockFilter]);

  const handleLogout = () => {
    logout();
    navigate('/pharmacy/login', { replace: true });
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      await api.pharmacies.addStock(token, {
        medicineName,
        quantity: Number(quantity),
        price: Number(price),
      });
      setMedicineName('');
      setQuantity('');
      setPrice('');
      setShowAddForm(false);
      await refreshData();
    } catch (e) {
      setError(e.message || 'Failed to save stock');
    }
  };

  const handleUpdateStock = async (item, patch) => {
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      await api.pharmacies.updateStock(token, item._id, patch);
      await refreshData();
    } catch (e) {
      setError(e.message || 'Failed to update stock');
    }
  };

  const handleMarkReady = async (requestId) => {
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      await api.pharmacies.markReady(token, requestId);
      await refreshData();
    } catch (e) {
      setError(e.message || 'Failed to mark request ready');
    }
  };

  const handleMarkDelivered = async (requestId) => {
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      await api.pharmacies.markDelivered(token, requestId);
      await refreshData();
    } catch (e) {
      setError(e.message || 'Failed to mark delivered');
    }
  };

  if (!authReady || (!user && loading)) return null;

  const extractRequestItems = (request) => {
    if (Array.isArray(request.requestedMedicines) && request.requestedMedicines.length > 0) {
      return request.requestedMedicines.map((item) => ({
        medicineName: item.medicineName,
        quantity: item.quantity,
      }));
    }
    return [{
      medicineName: request.medicineName,
      quantity: request.quantity,
    }];
  };

  return (
    <div className="min-h-screen bg-[#F4F7F9] flex flex-col font-sans text-slate-800 antialiased pb-20 md:pb-8">
      <HeaderBar
        title={t('pharmacyPortal') || 'PHARMACY DASHBOARD'}
        user={pharmacy ? { ...pharmacy, role: 'pharmacy' } : null}
        unreadCount={pendingRequests.length}
        onOpenProfile={() => setProfileDrawerOpen(true)}
        onOpenNotifications={() => setNotifPanelOpen((o) => !o)}
        onNavigate={setView}
        onLogout={handleLogout}
      />

      <NotificationsPanel
        open={notifPanelOpen}
        onClose={() => setNotifPanelOpen(false)}
        notifications={pendingRequests.map((r) => ({
          id: r._id,
          title: `Incoming Order from ${r.patientId?.name || 'Patient'}`,
          message: `${(r.requestedMedicines || []).length} item(s) requested`,
          createdAt: r.createdAt,
        }))}
      />

      <ProfileDrawer
        open={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        user={pharmacy ? { ...pharmacy, role: 'pharmacy' } : null}
        onOpenSettings={() => setView('settings')}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 text-rose-700 text-sm border border-rose-200/80 flex items-center justify-between shadow-xs">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-xs text-rose-500 font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {view === 'requests' ? (
          <RequestsScreen
            medicineRequests={requests}
            onNavigateHome={() => setView('home')}
          />
        ) : (
          <>
            {/* Hero / Pharmacy Welcome Banner */}
            <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 rounded-3xl p-6 text-white shadow-md relative overflow-hidden border border-teal-700/50">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-white/15 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-md border border-white/20">
                      🏥 {t('pharmacyPortal') || 'Pharmacy Portal'}
                    </span>
                    <span className="bg-emerald-400/20 text-emerald-100 text-xs font-medium px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                      Live Fulfillment Active
                    </span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white">
                    {pharmacy?.pharmacyName || 'Pharmacy Dashboard'}
                  </h1>
                  <p className="text-teal-100 text-xs md:text-sm mt-1 max-w-xl">
                    {t('pharmacyOverviewDesc') || 'Manage medicine inventory, stock levels, and order fulfillment.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAddForm((o) => !o)}
                    className="px-4 py-2.5 rounded-xl bg-white text-teal-900 hover:bg-teal-50 font-bold text-xs transition shadow-xs flex items-center gap-1.5"
                  >
                    <span>💊</span>
                    <span>{showAddForm ? 'Close Add Form' : t('addStockItem') || 'Add Medicine'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Overview Summary Cards (Soft Pastel Healthcare SaaS Grid) */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 1. Pending Incoming Requests */}
              <div
                onClick={() => setView('pending-orders')}
                className={`bg-gradient-to-br from-amber-50/90 via-amber-50/50 to-orange-50/30 rounded-2xl border p-4.5 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between ${
                  view === 'pending-orders' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-amber-200/70'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center text-xl font-bold">
                    📦
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-200/60">
                    Action Needed
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{pendingRequests.length}</p>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    {t('incomingMedicineRequests') || 'Incoming Requests'}
                  </p>
                </div>
              </div>

              {/* 2. Ready Requests */}
              <div
                onClick={() => setView('ready-orders')}
                className={`bg-gradient-to-br from-sky-50/90 via-sky-50/50 to-cyan-50/30 rounded-2xl border p-4.5 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between ${
                  view === 'ready-orders' ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-sky-200/70'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100/80 text-sky-700 flex items-center justify-center text-xl font-bold">
                    ⚡
                  </div>
                  <span className="text-[10px] font-bold text-sky-800 bg-sky-100/90 px-2.5 py-0.5 rounded-full border border-sky-200/60">
                    Awaiting Pickup
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{readyRequests.length}</p>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    {t('readyRequests') || 'Ready Orders'}
                  </p>
                </div>
              </div>

              {/* 3. Delivered Requests */}
              <div
                onClick={() => setView('completed-orders')}
                className={`bg-gradient-to-br from-emerald-50/90 via-emerald-50/50 to-teal-50/30 rounded-2xl border p-4.5 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between ${
                  view === 'completed-orders' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-emerald-200/70'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center text-xl font-bold">
                    🎉
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                    Fulfilled
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{deliveredRequests.length}</p>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    {t('deliveredRequests') || 'Delivered Orders'}
                  </p>
                </div>
              </div>

              {/* 4. Total Stock Items */}
              <div
                onClick={() => setView('stock')}
                className={`bg-gradient-to-br from-teal-50/90 via-teal-50/50 to-indigo-50/30 rounded-2xl border p-4.5 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between ${
                  view === 'stock' ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-teal-200/70'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100/80 text-teal-700 flex items-center justify-center text-xl font-bold">
                    💊
                  </div>
                  {lowStockItems.length > 0 ? (
                    <span className="text-[10px] font-bold text-rose-800 bg-rose-100/90 px-2.5 py-0.5 rounded-full border border-rose-200/60">
                      {lowStockItems.length} Low Stock
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-100/90 px-2.5 py-0.5 rounded-full border border-teal-200/60">
                      Healthy Stock
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stock.length}</p>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    {t('totalStockItems') || 'Total Inventory Items'}
                  </p>
                </div>
              </div>
            </section>

            {/* Quick View Navigation Tabs Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setView('home')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  view === 'home'
                    ? 'bg-teal-800 text-white shadow-xs border border-teal-700'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-teal-50/50 hover:text-teal-800 hover:border-teal-200'
                }`}
              >
                📊 Overview (All)
              </button>
              <button
                type="button"
                onClick={() => setView('stock')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  view === 'stock'
                    ? 'bg-teal-700 text-white shadow-xs border border-teal-600'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-teal-50/50 hover:text-teal-800 hover:border-teal-200'
                }`}
              >
                💊 Inventory Stock ({stock.length})
              </button>
              <button
                type="button"
                onClick={() => setView('pending-orders')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  view === 'pending-orders'
                    ? 'bg-amber-600 text-white shadow-xs border border-amber-500'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-50/50 hover:text-amber-800 hover:border-amber-200'
                }`}
              >
                📦 Pending Orders ({pendingRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setView('ready-orders')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  view === 'ready-orders'
                    ? 'bg-sky-600 text-white shadow-xs border border-sky-500'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-sky-50/50 hover:text-sky-800 hover:border-sky-200'
                }`}
              >
                ⚡ Ready Orders ({readyRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setView('completed-orders')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  view === 'completed-orders'
                    ? 'bg-emerald-600 text-white shadow-xs border border-emerald-500'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50/50 hover:text-emerald-800 hover:border-emerald-200'
                }`}
              >
                🎉 Delivered Orders ({deliveredRequests.length})
              </button>
            </div>

            {/* SECTION 1: MEDICINE STOCK MANAGEMENT */}
            {(view === 'home' || view === 'stock') && (
              <section className="bg-white rounded-3xl border border-teal-100/80 p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-teal-100/80 text-teal-700 flex items-center justify-center font-bold text-sm">
                        💊
                      </span>
                      <h2 className="text-lg font-bold text-slate-900">
                        {t('pharmacyStock') || 'Medicine Inventory Management'}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Monitor inventory levels, search items, and update quantities & pricing.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddForm((o) => !o)}
                    className="px-3.5 py-2 rounded-xl bg-teal-50 text-teal-800 hover:bg-teal-100 font-bold text-xs transition border border-teal-200/80 flex items-center justify-center gap-1.5 self-start sm:self-auto"
                  >
                    <span>{showAddForm ? '✕ Hide Form' : '➕ Add Medicine'}</span>
                  </button>
                </div>

                {/* Collapsible Add/Update Stock Form Card */}
                {showAddForm && (
                  <div className="bg-gradient-to-br from-teal-50/80 via-slate-50 to-indigo-50/40 border border-teal-100 rounded-2xl p-4.5 shadow-2xs transition">
                    <h3 className="text-xs font-bold text-teal-950 uppercase tracking-wider mb-3">
                      {t('addStockItem') || 'Add / Update Medicine Stock Item'}
                    </h3>
                    <form onSubmit={handleAddStock} className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      <Input
                        label={t('medicineName') || 'Medicine Name'}
                        value={medicineName}
                        onChange={(e) => setMedicineName(e.target.value)}
                        placeholder="e.g. Paracetamol 500mg"
                      />
                      <Input
                        label={t('stockQty') || 'Quantity'}
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="e.g. 50"
                      />
                      <Input
                        label={t('unitPrice') || 'Price (₹)'}
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="e.g. 45"
                      />
                      <div className="flex items-end">
                        <Button type="submit" className="w-full bg-teal-700 hover:bg-teal-800 text-white shadow-xs">
                          Save to Stock
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Stock Search & Filter Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('searchMedicinePlaceholder') || 'Search medicines in inventory...'}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200/90 bg-slate-50/70 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Stock Status Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setStockFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        stockFilter === 'all'
                          ? 'bg-teal-800 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All ({stock.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockFilter('available')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        stockFilter === 'available'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      Available ({stock.length - outOfStockItems.length - lowStockItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockFilter('low')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        stockFilter === 'low'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      Low Stock ({lowStockItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockFilter('out')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        stockFilter === 'out'
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      Out of Stock ({outOfStockItems.length})
                    </button>
                  </div>
                </div>

                {/* Stock List Items */}
                <div className="space-y-2.5">
                  {filteredStock.length === 0 ? (
                    <div className="bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs">
                      {searchQuery ? 'No matching medicines found.' : 'No medicines in inventory stock yet.'}
                    </div>
                  ) : (
                    filteredStock.map((item) => {
                      const qty = Number(item.quantity) || 0;
                      const priceVal = Number(item.price) || 0;
                      const isOut = qty === 0;
                      const isLow = qty > 0 && qty <= 5;

                      return (
                        <div
                          key={item._id}
                          className="bg-slate-50/80 hover:bg-teal-50/30 rounded-2xl border border-slate-200/70 hover:border-teal-200/90 p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                isOut
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : isLow
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              💊
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-slate-900 text-sm">{item.medicineName}</h3>
                                {isOut ? (
                                  <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200/80">
                                    {t('outOfStock') || 'Out of Stock'}
                                  </span>
                                ) : isLow ? (
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200/80">
                                    {t('lowStock') || 'Low Stock'} ({qty} left)
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200/80">
                                    {t('available') || 'Available'}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Current Price: <span className="font-semibold text-slate-700">₹{priceVal}</span> per unit | Quantity: <span className="font-semibold text-slate-700">{qty}</span>
                              </p>
                            </div>
                          </div>

                          {/* Quick Interactive Inline Qty & Price Updater */}
                          <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs shrink-0 self-end sm:self-auto">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Qty</span>
                              <input
                                type="number"
                                defaultValue={qty}
                                className="w-16 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 focus:outline-none transition"
                                onBlur={(e) => handleUpdateStock(item, { quantity: Number(e.target.value) })}
                              />
                            </div>
                            <div className="h-4 w-px bg-slate-200" />
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">₹ Price</span>
                              <input
                                type="number"
                                defaultValue={priceVal}
                                className="w-16 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 text-center focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 focus:outline-none transition"
                                onBlur={(e) => handleUpdateStock(item, { price: Number(e.target.value) })}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            )}

            {/* SECTION 2: INCOMING MEDICINE REQUESTS */}
            {(view === 'home' || view === 'pending-orders') && (
              <section className="bg-white rounded-3xl border border-amber-200/70 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center font-bold text-sm">
                      📦
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      {t('incomingMedicineRequests') || 'Incoming Medicine Requests'}
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-amber-800 bg-amber-100/80 border border-amber-200 px-3 py-1 rounded-full">
                    {pendingRequests.length} Pending
                  </span>
                </div>

                <div className="space-y-4">
                  {pendingRequests.length === 0 ? (
                    <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-6 text-center text-slate-400 text-xs">
                      {t('noPendingOrders') || 'No pending medicine requests at this moment.'}
                    </div>
                  ) : (
                    pendingRequests.map((r) => (
                      <div
                        key={r._id}
                        className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 p-4.5 space-y-3.5 shadow-2xs hover:shadow-xs transition"
                      >
                        {/* Header: Patient Info & ID Tag */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-amber-200/60">
                          <div>
                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                              Order Request
                            </span>
                            <h3 className="font-bold text-slate-900 text-sm mt-1">
                              Patient: {r.patientId?.name || 'Patient'} ({r.patientId?.patientId || 'ID Unset'})
                            </h3>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                          </span>
                        </div>

                        {/* Split Details: Patient Request vs Doctor Prescription */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Patient Requested Medicines Box */}
                          <div className="rounded-xl border border-amber-200/80 bg-white p-3.5 space-y-1.5 shadow-2xs">
                            <p className="font-bold text-amber-900 text-xs flex items-center gap-1.5 mb-2">
                              <span>💊</span>
                              <span>{t('patientRequestedMedicines') || 'Patient requested medicines'}</span>
                            </p>
                            {(r.requestedMedicines || extractRequestItems(r)).map((item) => (
                              <div key={`${r._id}-${item.medicineName}`} className="text-xs text-slate-700">
                                <p className="font-semibold text-slate-900">{item.medicineName}</p>
                                <p className="text-[11px] text-slate-500">
                                  {t('requestedDaysLabel') || 'Requested'}: {Number(item.requestedDays) || Number(r.requestedDays) || Number(r.days) || 0} {t('dayUnit') || 'day(s)'}
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Doctor Prescription Snapshot Box */}
                          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5 shadow-2xs">
                            <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mb-2">
                              <span>🩺</span>
                              <span>{t('doctorPrescription') || 'Doctor prescription'}</span>
                            </p>
                            <p className="text-xs text-slate-700 font-medium">
                              {t('doctor') || 'Doctor'}: Dr. {r.prescriptionSnapshot?.doctorName || '—'}
                            </p>
                            <p className="text-xs text-slate-500">
                              Clinic: {r.prescriptionSnapshot?.clinicName || '—'}
                            </p>
                            {(r.prescriptionSnapshot?.medicines || []).map((m) => (
                              <p key={`${r._id}-pr-${m.name}`} className="text-[11px] text-slate-600">
                                • {m.name}: {Number(m.durationInDays) || 0} {t('dayUnit') || 'day(s)'}
                              </p>
                            ))}
                          </div>
                        </div>

                        {/* Balance Days Breakdown & Action Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                          <div className="text-xs text-slate-600 space-y-0.5">
                            {(r.requestedMedicines || []).map((item) => (
                              <p key={`${r._id}-bal-${item.medicineName}`}>
                                <span className="font-semibold text-slate-800">{item.medicineName}</span> | {t('purchasedDaysLabel') || 'Purchased'}: {Number(item.purchasedDays) || 0} {t('dayUnit') || 'day(s)'} | {t('remainingDaysLabel') || 'Remaining'}: <span className="font-bold text-amber-800">{Number(item.remainingDays) || 0} {t('dayUnit') || 'day(s)'}</span>
                              </p>
                            ))}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
                              {t('statusPending') || 'PENDING'}
                            </span>
                            <Button
                              onClick={() => handleMarkReady(r._id)}
                              className="bg-teal-700 hover:bg-teal-800 text-white shadow-xs text-xs py-1.5 px-4 font-bold"
                            >
                              ⚡ {t('markReady') || 'Mark Ready'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            {/* SECTION 3: READY REQUESTS (AWAITING PICKUP) */}
            {(view === 'home' || view === 'ready-orders') && (
              <section className="bg-white rounded-3xl border border-sky-200/70 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-sky-100/80 text-sky-700 flex items-center justify-center font-bold text-sm">
                      ⚡
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      {t('readyRequests') || 'Ready Requests'}
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-sky-800 bg-sky-100/80 border border-sky-200 px-3 py-1 rounded-full">
                    {readyRequests.length} Ready
                  </span>
                </div>

                <div className="space-y-3">
                  {readyRequests.length === 0 ? (
                    <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-6 text-center text-slate-400 text-xs">
                      {t('noReadyOrders') || 'No ready orders awaiting pickup.'}
                    </div>
                  ) : (
                    readyRequests.map((r) => (
                      <div
                        key={r._id}
                        className="rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50/40 via-white to-sky-50/20 p-4.5 space-y-3 shadow-2xs hover:shadow-xs transition"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider bg-sky-100 px-2.5 py-0.5 rounded-full border border-sky-200">
                              Ready for Pickup / Delivery
                            </span>
                            <h3 className="font-bold text-slate-900 text-sm mt-1">
                              Patient: {r.patientId?.name || 'Patient'} ({r.patientId?.patientId || 'ID Unset'})
                            </h3>
                          </div>
                          <span className="text-xs font-bold text-sky-800 bg-sky-100 px-3 py-1 rounded-full border border-sky-200 shrink-0">
                            {t('statusReady') || 'READY'}
                          </span>
                        </div>

                        <div className="bg-white rounded-xl border border-sky-100 p-3.5 text-xs text-slate-700">
                          <p className="font-bold text-slate-900 mb-1">
                            {t('patientRequestedMedicines') || 'Requested medicines'}:
                          </p>
                          {extractRequestItems(r).map((item) => (
                            <p key={`${r._id}-${item.medicineName}`}>
                              • {item.medicineName} ({item.quantity})
                            </p>
                          ))}
                        </div>

                        <div className="flex items-center justify-end pt-1">
                          <Button
                            onClick={() => handleMarkDelivered(r._id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs py-1.5 px-4 font-bold"
                          >
                            🎉 {t('markDelivered') || 'Mark Delivered'}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            {/* SECTION 4: DELIVERED REQUESTS */}
            {(view === 'home' || view === 'completed-orders') && (
              <section className="bg-white rounded-3xl border border-emerald-200/70 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center font-bold text-sm">
                      🎉
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      {t('deliveredRequests') || 'Delivered Requests'}
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-3 py-1 rounded-full">
                    {deliveredRequests.length} Completed
                  </span>
                </div>

                <div className="space-y-3">
                  {deliveredRequests.length === 0 ? (
                    <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-6 text-center text-slate-400 text-xs">
                      {t('noDeliveredOrders') || 'No delivered requests yet.'}
                    </div>
                  ) : (
                    deliveredRequests.map((r) => (
                      <div
                        key={r._id}
                        className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/30 via-slate-50 to-emerald-50/10 p-4 space-y-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {r.patientId?.name || 'Patient'} ({r.patientId?.patientId || 'ID Unset'})
                          </p>
                          <div className="text-xs text-slate-600 mt-1">
                            {(r.requestedMedicines || extractRequestItems(r)).map((item) => (
                              <span key={`${r._id}-d-${item.medicineName}`} className="mr-2 inline-block font-medium">
                                • {item.medicineName}: {Number(item.requestedDays) || Number(r.days) || 0} {t('dayUnit') || 'day(s)'}
                              </span>
                            ))}
                          </div>
                        </div>

                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 shrink-0 self-end sm:self-auto">
                          {t('statusDelivered') || 'DELIVERED'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <MobileBottomNavigation
        role="pharmacy"
        activeTab={view}
        onNavigate={setView}
        onOpenProfile={() => setProfileDrawerOpen(true)}
      />
    </div>
  );
}
