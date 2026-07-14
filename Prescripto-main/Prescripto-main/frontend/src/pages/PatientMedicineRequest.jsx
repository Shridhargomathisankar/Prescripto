import { useNavigate } from 'react-router-dom';

export default function PatientMedicineRequest() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Request Medicines</h1>
          <button
            type="button"
            className="text-sm text-teal-600 hover:underline"
            onClick={() => navigate('/patient/dashboard')}
          >
            Back
          </button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-sm text-slate-600">
            Use the prescription cards in your dashboard to request medicines with per-medicine days.
          </p>
        </section>
      </main>
    </div>
  );
}
