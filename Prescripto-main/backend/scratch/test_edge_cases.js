import 'dotenv/config';
import Patient from '../src/models/Patient.js';
import Pharmacy from '../src/models/Pharmacy.js';
import Doctor from '../src/models/Doctor.js';
import { generateUniquePatientId } from '../src/utils/patientId.js';

async function testEdgeCases() {
  console.log('--- TEST 1: Register Patient with string age, trimmed fields ---');
  try {
    const phone = '9876540001';
    await Patient.deleteOne({ phone }).catch(() => {});

    const pId = await generateUniquePatientId('John Doe');
    const p = await Patient.create({
      patientId: pId,
      phone,
      name: 'John Doe',
      age: '35',
      bloodGroup: 'O+',
      medicalInfo: 'None'
    });
    console.log('Patient created:', p.id, p.patientId);
    await Patient.deleteOne({ phone }).catch(() => {});
  } catch (err) {
    console.error('Patient Test Error:', err);
  }

  console.log('\n--- TEST 2: Register Pharmacy with missing optional location ---');
  try {
    const phone = '9876540002';
    await Pharmacy.deleteOne({ phone }).catch(() => {});

    const ph = await Pharmacy.create({
      phone,
      name: 'Jane Owner',
      pharmacyName: 'City Pharma',
      location: ''
    });
    console.log('Pharmacy created:', ph.id, ph.pharmacyName);
    await Pharmacy.deleteOne({ phone }).catch(() => {});
  } catch (err) {
    console.error('Pharmacy Test Error:', err);
  }
}

testEdgeCases();
