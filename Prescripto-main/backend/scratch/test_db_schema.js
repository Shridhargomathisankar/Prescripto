import 'dotenv/config';
import { supabase } from '../src/config/supabase.js';
import Pharmacy from '../src/models/Pharmacy.js';
import Patient from '../src/models/Patient.js';

async function testDuplicates() {
  console.log('--- TEST 1: Inserting 2 Pharmacies with empty email ---');
  const p1Phone = '9911111111';
  const p2Phone = '9922222222';
  try {
    await Pharmacy.deleteOne({ phone: p1Phone }).catch(() => {});
    await Pharmacy.deleteOne({ phone: p2Phone }).catch(() => {});

    console.log('Inserting Pharmacy 1...');
    const pharm1 = await Pharmacy.create({
      phone: p1Phone,
      name: 'Owner 1',
      pharmacyName: 'Pharmacy 1'
    });
    console.log('Pharmacy 1 inserted:', pharm1._id);

    console.log('Inserting Pharmacy 2...');
    const pharm2 = await Pharmacy.create({
      phone: p2Phone,
      name: 'Owner 2',
      pharmacyName: 'Pharmacy 2'
    });
    console.log('Pharmacy 2 inserted:', pharm2._id);
  } catch (err) {
    console.error('Test 1 ERROR:', err.message, err);
  } finally {
    await Pharmacy.deleteOne({ phone: p1Phone }).catch(() => {});
    await Pharmacy.deleteOne({ phone: p2Phone }).catch(() => {});
  }

  console.log('\n--- TEST 2: Patient registration with null/undefined fields ---');
  const patPhone = '9933333333';
  try {
    await Patient.deleteOne({ phone: patPhone }).catch(() => {});

    console.log('Inserting Patient...');
    const pat = await Patient.create({
      patientId: 'TEST-111111',
      phone: patPhone,
      name: 'Test Patient',
      age: 20
    });
    console.log('Patient inserted:', pat._id);
  } catch (err) {
    console.error('Test 2 ERROR:', err.message, err);
  } finally {
    await Patient.deleteOne({ phone: patPhone }).catch(() => {});
  }
}

testDuplicates();
