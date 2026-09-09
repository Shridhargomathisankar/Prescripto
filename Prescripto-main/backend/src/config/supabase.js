import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from backend root and process.cwd()
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export function cleanSupabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let trimmed = rawUrl.trim();
  trimmed = trimmed.replace(/\/+$/, '');
  trimmed = trimmed.replace(/\/rest\/v1\/?$/i, '');
  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    return trimmed;
  }
}

export function isValidUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes('YOUR_SUPABASE')) return false;
  return /^https?:\/\//i.test(trimmed);
}

export function isValidKey(key) {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (!trimmed || trimmed.includes('YOUR_SUPABASE')) return false;
  return trimmed.length > 5;
}

const rawUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseUrl = cleanSupabaseUrl(rawUrl);

const supabaseKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  ''
).trim();

if (!isValidUrl(supabaseUrl) || !isValidKey(supabaseKey)) {
  console.error(
    '❌ SUPABASE CONFIG ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing or invalid in backend/.env.'
  );
}

export const supabase =
  isValidUrl(supabaseUrl) && isValidKey(supabaseKey)
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

export async function testSupabaseConnection() {
  const url = cleanSupabaseUrl((process.env.SUPABASE_URL || '').trim());
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    ''
  ).trim();

  if (!isValidUrl(url)) {
    throw new Error(
      `SUPABASE_URL is invalid or missing in backend/.env (Current value: "${url || ''}"). Please set a valid HTTP/HTTPS URL.`
    );
  }

  if (!isValidKey(key)) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is invalid or missing in backend/.env. Please set a valid API key.'
    );
  }

  if (!supabase) {
    throw new Error('Supabase client failed to initialize with provided environment variables.');
  }

  const { count, error } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Supabase PostgreSQL query failed: ${error.message}`);
  }

  console.log('✅ Supabase PostgreSQL connection verified successfully.');
  console.log(`Patients table record count: ${count ?? 0}`);
  return true;
}
