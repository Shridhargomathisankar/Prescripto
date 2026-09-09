import 'dotenv/config';
import { testSupabaseConnection } from '../src/config/supabase.js';

async function main() {
  await testSupabaseConnection();
  console.log('ALL TESTS PASSED!');
}

main().catch(console.error);
