import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../config/api';
import Button from '../components/Button';
import Input from '../components/Input';

export default function PharmacyDashboard() {
  const navigate = useNavigate();
  const { user, authReady, logout, getToken } = useAuth();

  const [pharmacy, setPharmacy] = useState(null);
  const [stock, setStock] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [medicineName, setMedicineName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

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
    const id = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [authReady, user, getToken, navigate]);

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

  const handleLogout = () => {
    logout();
    navigate('/pharmacy/login', { replace: true });
  };

  const refreshData = async () => {
    const token = await getToken();
    if (!token) return;
    const [stockData, requestData] = await Promise.all([
      api.pharmacies.stock(token),
      api.pharmacies.requests(token),
    ]);
    setStock(Array.isArray(stockData) ? stockData : []);
    setRequests(Array.isArray(requestData) ? requestData : []);
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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Pharmacy Dashboard</h1>
            <p className="text-sm text-slate-600">{pharmacy?.pharmacyName || 'Pharmacy'}</p>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-red-600">Logout</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Incoming Requests</p>
            <p className="text-2xl font-semibold text-slate-900">{pendingRequests.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Ready Requests</p>
            <p className="text-2xl font-semibold text-slate-900">{readyRequests.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Delivered Requests</p>
            <p className="text-2xl font-semibold text-slate-900">{deliveredRequests.length}</p>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Medicine Stock Management</h2>
          <form onSubmit={handleAddStock} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <Input label="Medicine" value={medicineName} onChange={(e) => setMedicineName(e.target.value)} />
            <Input label="Quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <Input label="Price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            <div className="flex items-end">
              <Button type="submit" className="w-full">Add / Update</Button>
            </div>
          </form>

          <div className="space-y-2">
            {stock.length === 0 && <p className="text-sm text-slate-500">No medicines in stock.</p>}
            {stock.map((item) => (
              <div key={item._id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex flex-wrap items-center gap-3">
                <p className="min-w-40 font-medium text-slate-800">{item.medicineName}</p>
                <input
                  type="number"
                  defaultValue={item.quantity}
                  className="w-24 px-2 py-1 rounded border border-slate-200 text-sm"
                  onBlur={(e) => handleUpdateStock(item, { quantity: Number(e.target.value) })}
                />
                <input
                  type="number"
                  defaultValue={item.price}
                  className="w-24 px-2 py-1 rounded border border-slate-200 text-sm"
                  onBlur={(e) => handleUpdateStock(item, { price: Number(e.target.value) })}
                />
                <span className="text-xs text-slate-500">Qty / Price</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Incoming Medicine Requests</h2>
          <div className="space-y-3">
            {pendingRequests.length === 0 && <p className="text-sm text-slate-500">No pending requests.</p>}
            {pendingRequests.map((r) => (
              <div key={r._id} className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-amber-200 bg-white p-3">
                    <p className="font-medium text-slate-900 mb-2">Patient requested medicines</p>
                    {(r.requestedMedicines || extractRequestItems(r)).map((item) => (
                      <p key={`${r._id}-${item.medicineName}`} className="text-sm text-slate-700">
                        {item.medicineName}: {Number(item.requestedDays) || Number(r.requestedDays) || Number(r.days) || 0} day(s)
                      </p>
                    ))}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="font-medium text-slate-900 mb-1">Doctor prescription</p>
                    <p className="text-sm text-slate-700">Doctor: Dr. {r.prescriptionSnapshot?.doctorName || '—'}</p>
                    <p className="text-sm text-slate-700">Clinic: {r.prescriptionSnapshot?.clinicName || '—'}</p>
                    {(r.prescriptionSnapshot?.medicines || []).map((m) => (
                      <p key={`${r._id}-pr-${m.name}`} className="text-xs text-slate-600">
                        {m.name}: {Number(m.durationInDays) || 0} day(s)
                      </p>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-slate-600">
                  Patient: {r.patientId?.name} ({r.patientId?.patientId})
                </p>
                {(r.requestedMedicines || []).map((item) => (
                  <p key={`${r._id}-bal-${item.medicineName}`} className="text-sm text-slate-600">
                    {item.medicineName} | Purchased: {Number(item.purchasedDays) || 0} day(s) | Remaining: {Number(item.remainingDays) || 0} day(s)
                  </p>
                ))}
                <p className="text-sm text-slate-600">Request status: Pending</p>
                <Button className="mt-2" onClick={() => handleMarkReady(r._id)}>Mark Ready</Button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Ready Requests</h2>
          <div className="space-y-3">
            {readyRequests.length === 0 && <p className="text-sm text-slate-500">No ready orders.</p>}
            {readyRequests.map((r) => (
              <div key={r._id} className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <p className="font-medium text-slate-900">Requested medicines</p>
                <div className="text-sm text-slate-700">
                  {extractRequestItems(r).map((item) => (
                    <p key={`${r._id}-${item.medicineName}`}>
                      {item.medicineName} ({item.quantity})
                    </p>
                  ))}
                </div>
                <p className="text-sm text-slate-600">
                  Patient: {r.patientId?.name} ({r.patientId?.patientId}) | Status: Ready
                </p>
                <Button className="mt-2" onClick={() => handleMarkDelivered(r._id)}>Delivered</Button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Delivered Requests</h2>
          <div className="space-y-3">
            {deliveredRequests.length === 0 && <p className="text-sm text-slate-500">No delivered requests.</p>}
            {deliveredRequests.map((r) => (
              <div key={r._id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="font-medium text-slate-900">{r.patientId?.name} ({r.patientId?.patientId})</p>
                {(r.requestedMedicines || extractRequestItems(r)).map((item) => (
                  <p key={`${r._id}-d-${item.medicineName}`} className="text-sm text-slate-700">
                    {item.medicineName}: {Number(item.requestedDays) || Number(r.days) || 0} day(s)
                  </p>
                ))}
                <p className="text-sm text-slate-600">Status: Delivered</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
