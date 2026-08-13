import { useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../config/api';

function calculateDailyDoseCount(medicine) {
  const slots = [medicine?.morning, medicine?.afternoon, medicine?.evening, medicine?.night];
  const count = slots.filter(Boolean).length;
  return count > 0 ? count : 1;
}

function getMedicineDays(medicine, prescriptionFallbackDuration = 0) {
  const perMedicine = Number(medicine?.durationInDays);
  if (Number.isFinite(perMedicine) && perMedicine > 0) return perMedicine;
  const fallback = Number(prescriptionFallbackDuration) || 0;
  return fallback > 0 ? fallback : 7;
}

function getPrescriptionMaxDays(medicines = [], prescriptionFallbackDuration = 0) {
  return medicines.reduce(
    (max, med) => Math.max(max, getMedicineDays(med, prescriptionFallbackDuration)),
    0
  );
}

export default function PrescriptionCard({ prescription, onConsultAgain, enableMedicineRequest = false }) {
  const { t } = useLanguage();
  const { user, getToken } = useAuth();
  const [selectedMedicineMap, setSelectedMedicineMap] = useState({});
  const [medicineDays, setMedicineDays] = useState({});
  const [availability, setAvailability] = useState([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState('');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  if (!prescription) return null;

  const safePrescription = prescription || {};
  const { _id, disease, medicines = [], createdAt, doctorName, clinicName, doctorId } = safePrescription;
  const date = createdAt ? new Date(createdAt).toLocaleDateString() : '';
  const canRequest = enableMedicineRequest && user?.role === 'patient' && Boolean(_id);

  const maxPrescriptionDays = getPrescriptionMaxDays(medicines, safePrescription.duration);
  const expiryDate = createdAt && maxPrescriptionDays > 0
    ? new Date(new Date(createdAt).getTime() + maxPrescriptionDays * 24 * 60 * 60 * 1000)
    : null;
  const isExpiredByDate = expiryDate ? new Date() > expiryDate : false;
  const isExhausted = medicines.length > 0 && medicines.every((m) => (Number(m.remainingDays) || 0) <= 0);
  const isExpired = isExpiredByDate || isExhausted;

  const selectedMedicines = useMemo(
    () => medicines.filter((m) => selectedMedicineMap[m.name]),
    [medicines, selectedMedicineMap]
  );

  const selectedItems = useMemo(() => {
    return selectedMedicines
      .map((medicine) => {
        const requestedDays = Number(medicineDays[medicine.name]);
        if (!Number.isFinite(requestedDays) || requestedDays <= 0) return null;
        const maxDays = Number(medicine.remainingDays ?? getMedicineDays(medicine, safePrescription.duration)) || 0;
        const dosesPerDay = calculateDailyDoseCount(medicine);
        return {
          medicineName: medicine.name,
          days: requestedDays,
          dosesPerDay,
          maxDays,
          quantity: dosesPerDay * requestedDays,
        };
      })
      .filter(Boolean);
  }, [selectedMedicines, medicineDays]);

  const totalQuantity = useMemo(
    () => selectedItems.reduce((sum, i) => sum + i.quantity, 0),
    [selectedItems]
  );

  const hasInvalidRequestedDays = selectedItems.some((item) => item.days > item.maxDays);

  const resetRequestState = () => {
    setAvailability([]);
    setSelectedPharmacyId('');
    setRequestError('');
    setRequestSuccess('');
  };

  const checkAvailability = async () => {
    if (!_id || selectedItems.length === 0 || hasInvalidRequestedDays || isExpired) return;
    setAvailabilityLoading(true);
    setRequestError('');
    setRequestSuccess('');
    setAvailability([]);
    setSelectedPharmacyId('');
    try {
      const token = await getToken();
      if (!token) return;
      const res = await api.patients.pharmacyAvailabilityMulti(token, {
        prescriptionId: _id,
        selectedMedicines: selectedItems.map((item) => ({
          medicineName: item.medicineName,
          days: item.days,
        })),
      });
      setAvailability(Array.isArray(res.pharmacies) ? res.pharmacies : []);
    } catch (e) {
      setRequestError(e.message || 'Failed to check pharmacy availability');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const submitMedicineRequest = async () => {
    if (!_id || !selectedPharmacyId || selectedItems.length === 0 || hasInvalidRequestedDays || isExpired) return;
    setSubmitLoading(true);
    setRequestError('');
    setRequestSuccess('');
    try {
      const token = await getToken();
      if (!token) return;
      await api.patients.createMedicineRequest(token, {
        patientId: user?._id,
        prescriptionId: _id,
        selectedMedicines: selectedItems.map((item) => ({
          medicineName: item.medicineName,
          days: item.days,
          quantity: item.quantity,
        })),
        quantity: totalQuantity,
        pharmacyId: selectedPharmacyId,
      });
      setRequestSuccess('Medicine request sent successfully.');
      setRequestSent(true);
    } catch (e) {
      setRequestError(e.message || 'Failed to send medicine request');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-teal-800">{disease}</h3>
          {isExpired ? (
            <p className="text-xs font-semibold text-red-700 mt-1">EXPIRED</p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">Active prescription</p>
          )}
        </div>
        {date && <span className="text-xs text-slate-400 whitespace-nowrap">{date}</span>}
      </div>

      {(doctorName || clinicName || doctorId) && (
        <div className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-2 space-y-2">
          <p className="font-medium text-slate-700">{t('prescribedBy')}</p>
          {doctorName && <p className="text-slate-800">Dr. {doctorName}</p>}
          {clinicName && <p className="text-slate-500 text-xs">{clinicName}</p>}
          {onConsultAgain && doctorId && (
            <button
              type="button"
              onClick={() => onConsultAgain(prescription)}
              className="mt-2 text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline"
            >
              {t('consultAgain')}
            </button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {medicines?.map((m, i) => {
          const maxDays = Number(m.remainingDays ?? getMedicineDays(m, safePrescription.duration)) || 0;
          const checked = Boolean(selectedMedicineMap[m.name]);
          return (
            <div key={`${m.name}-${i}`} className="bg-slate-50 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-800">{m.name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Prescribed: {getMedicineDays(m, safePrescription.duration)} day(s)
                  </p>
                  {'remainingDays' in m && (
                    <p className="text-xs text-slate-500">
                      Purchased: {Number(m.purchasedDays) || 0} day(s) | Remaining: {maxDays} day(s)
                    </p>
                  )}
                </div>
                {canRequest && !requestSent && !isExpired && (
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-1 accent-teal-600"
                    checked={checked}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setSelectedMedicineMap((prev) => ({ ...prev, [m.name]: isChecked }));
                      if (!isChecked) {
                        setMedicineDays((prev) => {
                          const copy = { ...prev };
                          delete copy[m.name];
                          return copy;
                        });
                      }
                      resetRequestState();
                    }}
                  />
                )}
              </div>

              {canRequest && checked && !requestSent && !isExpired && (
                <div className="mt-2">
                  <label className="block text-xs text-slate-500 mb-1">
                    Days (max {maxDays})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, maxDays)}
                    value={medicineDays[m.name] || ''}
                    onChange={(e) => {
                      let value = e.target.value.replace(/[^\d]/g, '');
                      if (value && Number(value) > maxDays) value = String(maxDays);
                      setMedicineDays((prev) => ({ ...prev, [m.name]: value }));
                      resetRequestState();
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canRequest && !requestSent && !isExpired && selectedMedicines.length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-3">
          {(requestError || requestSuccess) && (
            <div className={`rounded-lg px-3 py-2 text-xs ${requestError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {requestError || requestSuccess}
            </div>
          )}

          {selectedItems.some((item) => item.days > item.maxDays) && (
            <p className="text-xs text-red-600">
              Requested days exceed remaining balance for one or more medicines.
            </p>
          )}

          {selectedItems.length > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-700 space-y-1">
              {selectedItems.map((item) => (
                <p key={item.medicineName}>
                  {item.medicineName}: {item.quantity} units ({item.days} day(s))
                </p>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={checkAvailability}
            disabled={selectedItems.length === 0 || hasInvalidRequestedDays || availabilityLoading}
            className="w-full px-3 py-2 rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {availabilityLoading ? 'Checking...' : 'Check Pharmacy Availability'}
          </button>

          {availability.length > 0 && (
            <div className="space-y-2">
              {availability.map((p) => (
                <label
                  key={p.pharmacyId}
                  className={`block rounded-xl border p-3 ${p.available ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name={`pharmacy-${_id}`}
                      disabled={!p.available}
                      checked={selectedPharmacyId === String(p.pharmacyId)}
                      onChange={() => setSelectedPharmacyId(String(p.pharmacyId))}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-900">{p.pharmacyName}</p>
                      <p className="text-xs text-slate-600">{p.location}</p>
                      <p className="text-xs font-medium">{p.available ? 'Available' : 'Not Available'}</p>
                      {Array.isArray(p.items) && p.items.map((item) => (
                        <p key={`${p.pharmacyId}-${item.medicineName}`} className="text-xs text-slate-600">
                          {item.medicineName}: {item.requestedDays} day(s), required {item.quantityRequired}, in stock {item.availableQuantity}
                        </p>
                      ))}
                    </div>
                  </div>
                </label>
              ))}
              <button
                type="button"
                onClick={submitMedicineRequest}
                disabled={!selectedPharmacyId || submitLoading}
                className="w-full px-3 py-2 rounded-xl text-sm font-medium bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitLoading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          )}
        </div>
      )}

      {canRequest && requestSent && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs text-emerald-700 font-medium">
            Request sent. Track updates in Medicine Requirement Status.
          </p>
        </div>
      )}
    </div>
  );
}
