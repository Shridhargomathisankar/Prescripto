import { supabase } from '../config/supabase.js';

function createPopulatablePromise(fetchFn) {
  const promise = fetchFn();
  promise.populate = function () {
    return createPopulatablePromise(fetchFn);
  };
  promise.select = function () {
    return createPopulatablePromise(fetchFn);
  };
  promise.lean = function () {
    return createPopulatablePromise(fetchFn);
  };
  return promise;
}

async function fetchPharmacyDetails(row) {
  if (!row) return null;
  const pharmacyId = row.id;

  const { data: stockData } = await supabase
    .from('pharmacy_stock')
    .select('*')
    .eq('pharmacy_id', pharmacyId)
    .order('medicine_name', { ascending: true });

  const stock = (stockData || []).map((s) => ({
    _id: s.id,
    id: s.id,
    medicineName: s.medicine_name,
    normalizedName: s.normalized_name,
    quantity: Number(s.quantity),
    price: Number(s.price),
    updatedAt: s.updated_at,
  }));

  stock.id = function (stockId) {
    return this.find((item) => String(item._id || item.id) === String(stockId)) || null;
  };

  const instance = {
    _id: row.id,
    id: row.id,
    phone: row.phone || '',
    email: row.email || '',
    name: row.name,
    pharmacyName: row.pharmacy_name,
    location: row.location || '',
    stock,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    toObject() {
      const copy = JSON.parse(JSON.stringify(this));
      copy._id = this._id;
      copy.id = this.id;
      return copy;
    },

    async save() {
      return await updatePharmacyInstance(this);
    },
  };

  return instance;
}

async function updatePharmacyInstance(pharmacy) {
  const { error: pErr } = await supabase
    .from('pharmacies')
    .update({
      phone: pharmacy.phone || '',
      email: pharmacy.email || '',
      name: pharmacy.name,
      pharmacy_name: pharmacy.pharmacyName,
      location: pharmacy.location || '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', pharmacy._id);

  if (pErr) throw new Error(pErr.message);

  if (Array.isArray(pharmacy.stock)) {
    for (const item of pharmacy.stock) {
      if (!item._id && !item.id) {
        const { data: newS, error: sErr } = await supabase
          .from('pharmacy_stock')
          .insert({
            pharmacy_id: pharmacy._id,
            medicine_name: item.medicineName,
            normalized_name: item.normalizedName,
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (sErr) console.error('Error inserting stock:', sErr);
        if (newS) {
          item._id = newS.id;
          item.id = newS.id;
        }
      } else {
        const stockId = item._id || item.id;
        await supabase
          .from('pharmacy_stock')
          .update({
            medicine_name: item.medicineName,
            normalized_name: item.normalizedName,
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', stockId);
      }
    }
  }

  return pharmacy;
}

export const Pharmacy = {
  findOne(query = {}) {
    return createPopulatablePromise(async () => {
      const hasFilter = query.phone || query.email || query._id || query.id || (query.$or && Array.isArray(query.$or));
      if (!hasFilter) return null;

      let req = supabase.from('pharmacies').select('*');
      if (query.phone && !query.$or) {
        req = req.eq('phone', String(query.phone).trim());
      } else if (query.email && !query.$or) {
        req = req.eq('email', String(query.email).trim().toLowerCase());
      } else if (query.$or && Array.isArray(query.$or)) {
        const conditions = [];
        for (const cond of query.$or) {
          if (cond.phone) conditions.push(`phone.eq.${cond.phone}`);
          if (cond.email) conditions.push(`email.eq.${cond.email}`);
        }
        if (conditions.length > 0) {
          req = req.or(conditions.join(','));
        }
      }

      const { data, error } = await req.maybeSingle();
      if (error || !data) return null;
      return await fetchPharmacyDetails(data);
    });
  },

  findById(id) {
    return createPopulatablePromise(async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('pharmacies').select('*').eq('id', id).maybeSingle();
      if (error || !data) return null;
      return await fetchPharmacyDetails(data);
    });
  },

  find(query = {}) {
    return createPopulatablePromise(async () => {
      let req = supabase.from('pharmacies').select('*');
      const { data, error } = await req;
      if (error || !data) return [];

      const list = [];
      for (const row of data) {
        const pharm = await fetchPharmacyDetails(row);

        if (query.stock && query.stock.$elemMatch) {
          const matchRule = query.stock.$elemMatch;
          let stockMatches = true;

          if (matchRule.normalizedName) {
            if (typeof matchRule.normalizedName === 'object' && matchRule.normalizedName.$in) {
              const inList = matchRule.normalizedName.$in;
              stockMatches = (pharm.stock || []).some((s) => inList.includes(s.normalizedName));
            } else {
              stockMatches = (pharm.stock || []).some((s) => s.normalizedName === matchRule.normalizedName);
            }
          }

          if (!stockMatches) continue;
        }

        list.push(pharm);
      }
      return list;
    });
  },

  async create(data) {
    const insertData = {
      phone: data.phone ? String(data.phone).trim() : '',
      name: String(data.name || '').trim(),
      pharmacy_name: String(data.pharmacyName || '').trim(),
      location: data.location ? String(data.location).trim() : '',
    };

    if (data.email && String(data.email).trim()) {
      insertData.email = String(data.email).trim().toLowerCase();
    }

    const { data: newPharm, error } = await supabase
      .from('pharmacies')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(`Pharmacy creation failed: ${error.message}`);
    return await fetchPharmacyDetails(newPharm);
  },

  async deleteOne(query) {
    let req = supabase.from('pharmacies').delete();
    if (query.phone) req = req.eq('phone', query.phone);
    if (query.email) req = req.eq('email', query.email);
    if (query._id || query.id) req = req.eq('id', query._id || query.id);
    const { error } = await req;
    if (error) throw new Error(error.message);
    return true;
  },

  async findByIdAndDelete(id) {
    const { error } = await supabase.from('pharmacies').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },
};

export default Pharmacy;
