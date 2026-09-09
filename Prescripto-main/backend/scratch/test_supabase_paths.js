import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function cleanSupabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let trimmed = rawUrl.trim();
  // Strip trailing slashes and common invalid suffixes
  trimmed = trimmed.replace(/\/+$/, '');
  trimmed = trimmed.replace(/\/rest\/v1\/?$/i, '');
  try {
    const parsed = new URL(trimmed);
    return parsed.origin; // e.g. "https://kpjughzicpiyojhbelvt.supabase.co"
  } catch {
    return trimmed;
  }
}

const inputs = [
  'https://kpjughzicpiyojhbelvt.supabase.co',
  'https://kpjughzicpiyojhbelvt.supabase.co/',
  'https://kpjughzicpiyojhbelvt.supabase.co/rest/v1',
  'https://kpjughzicpiyojhbelvt.supabase.co/rest/v1/',
  'https://kpjughzicpiyojhbelvt.supabase.co/api',
];

async function verifySanitization() {
  console.log('--- SANITIZATION VERIFICATION ---');
  for (const input of inputs) {
    const cleaned = cleanSupabaseUrl(input);
    console.log(`Input:  "${input}"`);
    console.log(`Cleaned:"${cleaned}"`);
    const client = createClient(cleaned, key);
    const res = await client.from('patients').select('id').limit(1);
    console.log(`Result: ${res.error ? res.error.message : 'SUCCESS'}\n`);
  }
}

verifySanitization();
