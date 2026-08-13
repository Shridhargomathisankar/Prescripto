import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

import LanguageSelect from './pages/LanguageSelect';
import PatientLogin from './pages/PatientLogin';
import PatientRegister from './pages/PatientRegister';
import PatientDashboard from './pages/PatientDashboard';
import PatientMedicineRequest from './pages/PatientMedicineRequest';
import DoctorLogin from './pages/DoctorLogin';
import DoctorDashboard from './pages/DoctorDashboard';
import PharmacyLogin from './pages/PharmacyLogin';
import PharmacyDashboard from './pages/PharmacyDashboard';
import { PatientDashboardErrorBoundary } from './pages/PatientDashboardErrorBoundary';

const ENABLE_EXPERIMENTAL_PATIENT_MEDICINE_ROUTE = false;

function PrivatePatient({ children }) {
  const { user, authReady } = useAuth();
  if (!authReady) return null;

  const stored = localStorage.getItem('prescripto_auth_v1');
  const parsed = stored ? JSON.parse(stored) : null;
  const effectiveUser = user || parsed?.user;
  const effectiveRole = user?.role || parsed?.role;

  if (!effectiveUser || effectiveRole !== 'patient') {
    return <Navigate to="/patient/login" replace />;
  }
  return children;
}

function PrivateDoctor({ children }) {
  const { user, authReady } = useAuth();
  if (!authReady) return null;

  const stored = localStorage.getItem('prescripto_auth_v1');
  const parsed = stored ? JSON.parse(stored) : null;
  const effectiveUser = user || parsed?.user;
  const effectiveRole = user?.role || parsed?.role;

  if (!effectiveUser || effectiveRole !== 'doctor') {
    return <Navigate to="/doctor/login" replace />;
  }
  return children;
}

function PrivatePharmacy({ children }) {
  const { user, authReady } = useAuth();
  if (!authReady) return null;

  const stored = localStorage.getItem('prescripto_auth_v1');
  const parsed = stored ? JSON.parse(stored) : null;
  const effectiveUser = user || parsed?.user;
  const effectiveRole = user?.role || parsed?.role;

  if (!effectiveUser || effectiveRole !== 'pharmacy') {
    return <Navigate to="/pharmacy/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LanguageSelect />} />

      <Route path="/patient/login" element={<PatientLogin />} />
      <Route path="/patient/register" element={<PatientRegister />} />
      <Route
        path="/patient/dashboard"
        element={
          <PrivatePatient>
            <PatientDashboardErrorBoundary>
              <PatientDashboard />
            </PatientDashboardErrorBoundary>
          </PrivatePatient>
        }
      />
      {ENABLE_EXPERIMENTAL_PATIENT_MEDICINE_ROUTE && (
        <Route
          path="/patient/medicine-request"
          element={
            <PrivatePatient>
              <PatientMedicineRequest />
            </PrivatePatient>
          }
        />
      )}

      <Route path="/doctor/login" element={<DoctorLogin />} />
      <Route
        path="/doctor/dashboard"
        element={
          <PrivateDoctor>
            <DoctorDashboard />
          </PrivateDoctor>
        }
      />

      <Route path="/pharmacy/login" element={<PharmacyLogin />} />
      <Route
        path="/pharmacy/dashboard"
        element={
          <PrivatePharmacy>
            <PharmacyDashboard />
          </PrivatePharmacy>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
