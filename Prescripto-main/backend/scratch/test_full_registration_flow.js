import 'dotenv/config';
import Patient from '../src/models/Patient.js';
import Pharmacy from '../src/models/Pharmacy.js';
import Doctor from '../src/models/Doctor.js';
import { generateUniquePatientId } from '../src/utils/patientId.js';

async function testAllRegistrations() {
  console.log('=== TESTING FULL REGISTRATION FLOW ===');

  // 1. PATIENT REGISTRATION
  try {
    const phone = '9988776655';
    await Patient.deleteOne({ phone }).catch(() => {});

    const pId = await generateUniquePatientId('Alice Smith');
    const patient = await Patient.create({
      patientId: pId,
      phone,
      name: 'Alice Smith',
      age: 28,
      bloodGroup: 'B+',
      medicalInfo: 'No allergies'
    });
    console.log('✅ Patient Registration Passed:', patient._id, patient.patientId);
    await Patient.deleteOne({ phone }).catch(() => {});
  } catch (err) {
    console.error('❌ Patient Registration Failed:', err);
  }

  // 2. PHARMACY REGISTRATION (Phone-based without email)
  try {
    const phone = '9988776644';
    await Pharmacy.deleteOne({ phone }).catch(() => {});

    const pharmacy = await Pharmacy.create({
      phone,
      name: 'Bob Pharmacy Owner',
      pharmacyName: 'Apollo Meds',
      location: 'Main Street'
    });
    console.log('✅ Pharmacy Registration Passed:', pharmacy._id, pharmacy.pharmacyName);
    await Pharmacy.deleteOne({ phone }).catch(() => {});
  } catch (err) {
    console.error('❌ Pharmacy Registration Failed:', err);
  }

  // 3. DOCTOR REGISTRATION
  try {
    const phone = '9988776633';
    await Doctor.deleteOne({ phone }).catch(() => {});

    const doctor = await Doctor.create({
      phone,
      name: 'Dr. Carol White',
      clinicName: 'White Care Clinic',
      specialization: 'Cardiology'
    });
    console.log('✅ Doctor Registration Passed:', doctor._id, doctor.name);
    await Doctor.deleteOne({ phone }).catch(() => {});
  } catch (err) {
    console.error('❌ Doctor Registration Failed:', err);
  }
}

testAllRegistrations();
