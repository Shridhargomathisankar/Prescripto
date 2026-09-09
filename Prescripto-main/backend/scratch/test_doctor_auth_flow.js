import 'dotenv/config';
import Doctor from '../src/models/Doctor.js';
import { verifyIdToken } from '../src/config/firebase.js';

function normalizePhone(phone) {
  if (!phone) return phone;
  return String(phone).replace(/\D/g, '').slice(-10);
}

async function testDoctorAuthFlow() {
  console.log('=== TESTING DOCTOR AUTH FLOW ===');
  
  const testPhone = '9876543210';
  const idToken = `demo-token-${testPhone}`;

  console.log('1. Incoming idToken:', idToken);

  // 2. Decode Token
  const decoded = await verifyIdToken(idToken);
  console.log('2. Decoded token result:', decoded);

  let rawPhone =
    decoded.phone_number ||
    decoded.firebase?.identities?.phone?.[0] ||
    (typeof idToken === 'string' && idToken.replace(/\D/g, '')) ||
    null;

  console.log('3. Raw extracted phone:', rawPhone);

  const phone = normalizePhone(rawPhone);
  console.log('[VERIFY] Extracted Phone:', phone);
  console.log('[VERIFY] Doctor Lookup Phone:', phone);

  // 4. Ensure Doctor exists for test
  let doctor = await Doctor.findOne({ phone });
  if (!doctor) {
    console.log('Creating test doctor record in Supabase...');
    doctor = await Doctor.create({
      phone,
      name: 'Dr. John Test',
      clinicName: 'HealthCare Clinic',
      specialization: 'General Medicine'
    });
  }

  // 5. Run Doctor.findOne({ phone })
  const resultDoctor = await Doctor.findOne({ phone });
  console.log('[VERIFY] Doctor Result:', resultDoctor);

  console.log('\n--- VERIFY RESPONSE PAYLOAD ---');
  if (resultDoctor) {
    const payload = {
      role: 'patient', // wait, if role matches doctor:
      roleMatched: 'doctor',
      user: resultDoctor,
      isNew: false
    };
    console.log('Payload sent to frontend:', JSON.stringify(payload, null, 2));
  } else {
    console.log('Doctor not found in DB. Returning isNew: true payload.');
  }

  // Clean up test doctor
  await Doctor.deleteOne({ phone }).catch(() => {});
}

testDoctorAuthFlow();
