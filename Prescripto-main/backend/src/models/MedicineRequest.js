import { supabase } from '../config/supabase.js';

function createPopulatablePromise(fetchFn) {
  let populateConfigs = [];
  let sortConfig = null;

  const executor = async () => {
    return await fetchFn(populateConfigs, sortConfig);
  };

  const promise = Promise.resolve().then(executor);

  promise.populate = function (config) {
    populateConfigs.push(config);
    return createPopulatablePromise((pop, sort) => fetchFn(pop || populateConfigs, sort || sortConfig));
  };

  promise.sort = function (config) {
    sortConfig = config;
    return createPopulatablePromise((pop, sort) => fetchFn(pop || populateConfigs, sort || sortConfig));
  };

  promise.lean = function () {
    return createPopulatablePromise((pop, sort) => fetchFn(pop || populateConfigs, sort || sortConfig));
  };

  return promise;
}

async function fetchMedicineRequestDetails(row, populateConfigs = []) {
  if (!row) return null;

  let patientObj = row.patient_id;
  let pharmacyObj = row.pharmacy_id;

  for (const pop of populateConfigs || []) {
    const path = typeof pop === 'string' ? pop : pop?.path;
    if (path === 'patientId' && row.patient_id) {
      const { data: pData } = await supabase
        .from('patients')
        .select('*')
        .eq('id', row.patient_id)
        .maybeSingle();

      if (pData) {
        patientObj = {
          _id: pData.id,
          id: pData.id,
          patientId: pData.patient_id,
          name: pData.name,
          phone: pData.phone,
        };
      }
    }

    if (path === 'pharmacyId' && row.pharmacy_id) {
      const { data: pharmData } = await supabase
        .from('pharmacies')
        .select('*')
        .eq('id', row.pharmacy_id)
        .maybeSingle();

      if (pharmData) {
        pharmacyObj = {
          _id: pharmData.id,
          id: pharmData.id,
          pharmacyName: pharmData.pharmacy_name,
          location: pharmData.location,
        };
      }
    }
  }

  const instance = {
    _id: row.id,
    id: row.id,
    patientId: patientObj,
    pharmacyId: pharmacyObj,
    prescriptionId: row.prescription_id,
    doctorId: row.doctor_id,
    requestedMedicines: row.requested_medicines || [],
    requestedDays: row.requested_days,
    prescribedDays: row.prescribed_days,
    isPartialRequest: Boolean(row.is_partial_request),
    prescriptionSnapshot: row.prescription_snapshot || {},
    medicineName: row.medicine_name,
    normalizedMedicineName: row.normalized_medicine_name,
    days: row.days,
    dosesPerDay: row.doses_per_day,
    quantity: row.quantity,
    pricePerUnit: Number(row.price_per_unit) || 0,
    totalAmount: Number(row.total_amount) || 0,
    status: row.status || 'pending',
    paymentMode: row.payment_mode || 'cash',
    reorderOf: row.reorder_of || null,
    refillReminderAt: row.refill_reminder_at,
    refillReminderSent: Boolean(row.refill_reminder_sent),
    requestedAt: row.requested_at,
    readyAt: row.ready_at,
    pickedUpAt: row.picked_up_at,
    createdAt: row.created_at || row.requested_at,
    updatedAt: row.updated_at || row.requested_at,

    toObject() {
      const copy = JSON.parse(JSON.stringify(this));
      copy._id = this._id;
      copy.id = this.id;
      return copy;
    },

    async save() {
      return await updateMedicineRequestInstance(this);
    },
  };

  return instance;
}

async function updateMedicineRequestInstance(request) {
  const pId = typeof request.patientId === 'object' ? request.patientId._id || request.patientId.id : request.patientId;
  const phId = typeof request.pharmacyId === 'object' ? request.pharmacyId._id || request.pharmacyId.id : request.pharmacyId;

  const { error } = await supabase
    .from('medicine_requests')
    .update({
      patient_id: pId,
      pharmacy_id: phId,
      status: request.status,
      refill_reminder_sent: Boolean(request.refillReminderSent),
      ready_at: request.readyAt ? new Date(request.readyAt).toISOString() : null,
      picked_up_at: request.pickedUpAt ? new Date(request.pickedUpAt).toISOString() : null,
    })
    .eq('id', request._id);

  if (error) throw new Error(error.message);
  return request;
}

export const MedicineRequest = {
  find(query = {}) {
    return createPopulatablePromise(async (populateConfigs, sortConfig) => {
      let req = supabase.from('medicine_requests').select('*');

      if (query.patientId) {
        req = req.eq('patient_id', query.patientId);
      }
      if (query.pharmacyId) {
        req = req.eq('pharmacy_id', query.pharmacyId);
      }
      if (query.prescriptionId) {
        req = req.eq('prescription_id', query.prescriptionId);
      }
      if (query.status) {
        if (typeof query.status === 'object' && query.status.$in) {
          req = req.in('status', query.status.$in);
        } else {
          req = req.eq('status', query.status);
        }
      }

      if (query.refillReminderSent !== undefined) {
        req = req.eq('refill_reminder_sent', Boolean(query.refillReminderSent));
      }
      if (query.refillReminderAt && query.refillReminderAt.$lte) {
        req = req.lte('refill_reminder_at', new Date(query.refillReminderAt.$lte).toISOString());
      }

      if (sortConfig && sortConfig.requestedAt === -1) {
        req = req.order('requested_at', { ascending: false });
      }

      const { data, error } = await req;
      if (error || !data) return [];

      const list = [];
      for (const row of data) {
        list.push(await fetchMedicineRequestDetails(row, populateConfigs));
      }
      return list;
    });
  },

  findById(id) {
    return createPopulatablePromise(async (populateConfigs) => {
      if (!id) return null;
      const { data, error } = await supabase.from('medicine_requests').select('*').eq('id', id).maybeSingle();
      if (error || !data) return null;
      return await fetchMedicineRequestDetails(data, populateConfigs);
    });
  },

  findOne(query) {
    return createPopulatablePromise(async (populateConfigs) => {
      let req = supabase.from('medicine_requests').select('*');
      if (query._id || query.id) req = req.eq('id', query._id || query.id);
      if (query.patientId) req = req.eq('patient_id', query.patientId);
      if (query.pharmacyId) req = req.eq('pharmacy_id', query.pharmacyId);

      const { data, error } = await req.maybeSingle();
      if (error || !data) return null;
      return await fetchMedicineRequestDetails(data, populateConfigs);
    });
  },

  async create(data) {
    const { data: newReq, error } = await supabase
      .from('medicine_requests')
      .insert({
        patient_id: typeof data.patientId === 'object' ? data.patientId._id : data.patientId,
        pharmacy_id: typeof data.pharmacyId === 'object' ? data.pharmacyId._id : data.pharmacyId,
        prescription_id: data.prescriptionId,
        doctor_id: data.doctorId || null,
        requested_medicines: data.requestedMedicines || [],
        requested_days: data.requestedDays || null,
        prescribed_days: data.prescribedDays || null,
        is_partial_request: Boolean(data.isPartialRequest),
        prescription_snapshot: data.prescriptionSnapshot || {},
        medicine_name: data.medicineName,
        normalized_medicine_name: data.normalizedMedicineName,
        days: Number(data.days),
        doses_per_day: Number(data.dosesPerDay),
        quantity: Number(data.quantity),
        price_per_unit: Number(data.pricePerUnit) || 0,
        total_amount: Number(data.totalAmount) || 0,
        status: data.status || 'pending',
        payment_mode: data.paymentMode || 'cash',
        reorder_of: data.reorderOf || null,
        refill_reminder_at: data.refillReminderAt ? new Date(data.refillReminderAt).toISOString() : null,
        refill_reminder_sent: Boolean(data.refillReminderSent),
        requested_at: data.requestedAt ? new Date(data.requestedAt).toISOString() : new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return await fetchMedicineRequestDetails(newReq);
  },

  async deleteOne(query) {
    let req = supabase.from('medicine_requests').delete();
    if (query._id || query.id) req = req.eq('id', query._id || query.id);
    const { error } = await req;
    if (error) throw new Error(error.message);
    return true;
  },

  async findByIdAndDelete(id) {
    const { error } = await supabase.from('medicine_requests').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },
};

export default MedicineRequest;
