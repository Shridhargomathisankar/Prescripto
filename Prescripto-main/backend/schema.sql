-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Patients Table
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR UNIQUE NOT NULL,
  phone VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  age INTEGER NOT NULL,
  blood_group VARCHAR,
  medical_info TEXT,
  gender VARCHAR DEFAULT '',
  location VARCHAR DEFAULT '',
  language VARCHAR DEFAULT 'en',
  reminder_settings JSONB DEFAULT '{"morningTime":"10:00","afternoonTime":"13:00","nightTime":"20:00","reminderType":"notification","alarmTone":"default","messageTone":"default"}'::jsonb,
  active_session JSONB DEFAULT NULL,
  reminders JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Doctors Table
CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  clinic_name VARCHAR NOT NULL,
  specialization VARCHAR DEFAULT '',
  experience INTEGER DEFAULT 0,
  location VARCHAR DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Pharmacies Table
CREATE TABLE IF NOT EXISTS pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR DEFAULT '',
  email VARCHAR DEFAULT '',
  name VARCHAR NOT NULL,
  pharmacy_name VARCHAR NOT NULL,
  location VARCHAR DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Pharmacy Stock Table
CREATE TABLE IF NOT EXISTS pharmacy_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE CASCADE,
  medicine_name VARCHAR NOT NULL,
  normalized_name VARCHAR NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Prescriptions Table
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  disease VARCHAR NOT NULL,
  doctor_name VARCHAR,
  clinic_name VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Prescription Medicines Table
CREATE TABLE IF NOT EXISTS prescription_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  dosage VARCHAR DEFAULT '',
  morning BOOLEAN DEFAULT false,
  afternoon BOOLEAN DEFAULT false,
  evening BOOLEAN DEFAULT false,
  night BOOLEAN DEFAULT false,
  duration_in_days INTEGER DEFAULT 7
);

-- 7. Patient Reports Table
CREATE TABLE IF NOT EXISTS patient_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  url TEXT,
  data_url TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Access Requests Table
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  status VARCHAR DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  session_started_at TIMESTAMPTZ,
  session_ended_at TIMESTAMPTZ,
  auto_close_at TIMESTAMPTZ
);

-- 9. Consult Requests Table
CREATE TABLE IF NOT EXISTS consult_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  requested_date TIMESTAMPTZ NOT NULL,
  status VARCHAR DEFAULT 'pending',
  rescheduled_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Patient Notifications Table
CREATE TABLE IF NOT EXISTS patient_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  message TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Doctor Notifications Table
CREATE TABLE IF NOT EXISTS doctor_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  patient_name VARCHAR,
  requested_date TIMESTAMPTZ,
  status VARCHAR DEFAULT 'pending',
  rescheduled_date TIMESTAMPTZ,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Medicine Requests Table
CREATE TABLE IF NOT EXISTS medicine_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  requested_medicines JSONB DEFAULT '[]'::jsonb,
  requested_days INTEGER,
  prescribed_days INTEGER,
  is_partial_request BOOLEAN DEFAULT false,
  prescription_snapshot JSONB DEFAULT '{}'::jsonb,
  medicine_name VARCHAR NOT NULL,
  normalized_medicine_name VARCHAR NOT NULL,
  days INTEGER NOT NULL,
  doses_per_day INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  price_per_unit NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0,
  status VARCHAR DEFAULT 'pending',
  payment_mode VARCHAR DEFAULT 'cash',
  reorder_of UUID REFERENCES medicine_requests(id) ON DELETE SET NULL,
  refill_reminder_at TIMESTAMPTZ,
  refill_reminder_sent BOOLEAN DEFAULT false,
  requested_at TIMESTAMPTZ DEFAULT now(),
  ready_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctors_phone ON doctors(phone);
CREATE INDEX IF NOT EXISTS idx_pharmacies_phone ON pharmacies(phone);
CREATE INDEX IF NOT EXISTS idx_pharmacies_email ON pharmacies(email);
CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_norm_name ON pharmacy_stock(normalized_name);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_medicine_requests_patient_id ON medicine_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_medicine_requests_pharmacy_id ON medicine_requests(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_medicine_requests_prescription_id ON medicine_requests(prescription_id);
