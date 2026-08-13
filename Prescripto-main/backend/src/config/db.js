import { supabase } from './supabase.js';

export async function connectDB() {
  console.log('✅ Connected to Supabase PostgreSQL');
  return supabase;
}
