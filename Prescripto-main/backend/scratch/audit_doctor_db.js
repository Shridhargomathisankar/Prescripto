import 'dotenv/config';
import { supabase } from '../src/config/supabase.js';
import Doctor from '../src/models/Doctor.js';

async function auditDoctors() {
  console.log('=== AUDITING DOCTORS TABLE IN SUPABASE ===');

  const { data: rows, error } = await supabase.from('doctors').select('*');
  if (error) {
    console.error('Failed to fetch doctors:', error);
    return;
  }

  console.log(`Total Doctor rows found in Supabase: ${rows.length}`);

  if (rows.length === 0) {
    console.log('No doctors found. Creating an old doctor record and a new doctor record for diagnostic audit...');

    const oldDoc = await Doctor.create({
      phone: '9876543210',
      name: 'Dr. Old Working',
      clinicName: 'City General Hospital',
      specialization: 'Cardiology'
    });
    console.log('Created Old Doctor:', oldDoc.id);

    const newDoc = await Doctor.create({
      phone: '9123456789',
      name: 'Dr. Newly Registered',
      clinicName: 'Sunrise Clinic',
      specialization: 'Pediatrics'
    });
    console.log('Created New Doctor:', newDoc.id);
  }

  const { data: updatedRows } = await supabase.from('doctors').select('*').order('created_at', { ascending: true });

  console.log('\n--- RAW DATABASE ROWS ---');
  updatedRows.forEach((row, idx) => {
    console.log(`\nDoctor #${idx + 1} (${idx === 0 ? 'OLD DOCTOR' : 'NEW DOCTOR'}):`);
    console.log(JSON.stringify(row, null, 2));
  });

  console.log('\n--- API VERIFY JSON RESPONSE ---');
  for (let i = 0; i < Math.min(2, updatedRows.length); i++) {
    const row = updatedRows[i];
    const doc = await Doctor.findOne({ phone: row.phone });
    const payload = {
      role: 'doctor',
      user: doc,
      isNew: false
    };
    console.log(`\nPOST /api/auth/verify JSON Response for Phone "${row.phone}" (${i === 0 ? 'Old Doctor' : 'New Doctor'}):`);
    console.log(JSON.stringify(payload, null, 2));
  }
}

auditDoctors();
