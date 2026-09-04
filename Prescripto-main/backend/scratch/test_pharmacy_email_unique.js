import 'dotenv/config';
import { supabase } from '../src/config/supabase.js';

async function testEmailConstraint() {
  console.log('Testing inserting two pharmacies with email: "" vs email: null...');
  const p1 = '9777000001';
  const p2 = '9777000002';

  // Clean up
  await supabase.from('pharmacies').delete().eq('phone', p1);
  await supabase.from('pharmacies').delete().eq('phone', p2);

  // Insert 1 with email: ""
  const res1 = await supabase.from('pharmacies').insert({
    phone: p1,
    email: '',
    name: 'Pharm 1 Owner',
    pharmacy_name: 'Pharm 1'
  }).select();
  console.log('Insert 1 result error:', res1.error);

  // Insert 2 with email: ""
  const res2 = await supabase.from('pharmacies').insert({
    phone: p2,
    email: '',
    name: 'Pharm 2 Owner',
    pharmacy_name: 'Pharm 2'
  }).select();
  console.log('Insert 2 result error:', res2.error);

  // Clean up
  await supabase.from('pharmacies').delete().eq('phone', p1);
  await supabase.from('pharmacies').delete().eq('phone', p2);
}

testEmailConstraint();
