import Patient from '../models/Patient.js';

/**
 * Generate a unique Patient ID: PREFIX-NNNNNN
 * PREFIX = first 4 letters of name (uppercase)
 * NNNNNN = random 6 digits
 */

function sanitizePrefix(name) {
  const letters = (name || '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 4);

  return letters || 'P';
}

function randomSixDigits() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function generateUniquePatientId(name) {
  const prefix = sanitizePrefix(name);
  let attempts = 0;
  const maxAttempts = 50;

  while (attempts < maxAttempts) {
    const id = `${prefix}-${randomSixDigits()}`;
    const exists = await Patient.findOne({ patientId: id });
    if (!exists) return id;
    attempts++;
  }

  // fallback (very rare)
  const fallback = `P-${randomSixDigits()}-${Date.now()
    .toString()
    .slice(-4)}`;

  const exists = await Patient.findOne({ patientId: fallback });
  if (!exists) return fallback;

  throw new Error('Unable to generate unique Patient ID');
}
