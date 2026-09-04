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

async function fetchDoctorDetails(row) {
  if (!row) return null;
  const doctorId = row.id;

  const { data: notifData } = await supabase
    .from('doctor_notifications')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: true });

  const notifications = (notifData || []).map((n) => ({
    _id: n.id,
    id: n.id,
    patientId: n.patient_id,
    patientName: n.patient_name || '',
    requestedDate: n.requested_date,
    status: n.status || 'pending',
    rescheduledDate: n.rescheduled_date,
    read: Boolean(n.read),
    createdAt: n.created_at,
  }));

  const instance = {
    _id: row.id,
    id: row.id,
    phone: row.phone,
    name: row.name,
    clinicName: row.clinic_name,
    specialization: row.specialization || '',
    experience: row.experience || 0,
    location: row.location || '',
    notifications,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    toObject() {
      const copy = JSON.parse(JSON.stringify(this));
      copy._id = this._id;
      copy.id = this.id;
      return copy;
    },

    async save() {
      return await updateDoctorInstance(this);
    },
  };

  return instance;
}

async function updateDoctorInstance(doctor) {
  const { error: docErr } = await supabase
    .from('doctors')
    .update({
      phone: doctor.phone,
      name: doctor.name,
      clinic_name: doctor.clinicName,
      specialization: doctor.specialization,
      experience: Number(doctor.experience) || 0,
      location: doctor.location,
      updated_at: new Date().toISOString(),
    })
    .eq('id', doctor._id);

  if (docErr) throw new Error(docErr.message);

  if (Array.isArray(doctor.notifications)) {
    for (const n of doctor.notifications) {
      if (!n._id && !n.id) {
        const { data: newN, error: nErr } = await supabase
          .from('doctor_notifications')
          .insert({
            doctor_id: doctor._id,
            patient_id: n.patientId,
            patient_name: n.patientName || '',
            requested_date: n.requestedDate ? new Date(n.requestedDate).toISOString() : new Date().toISOString(),
            status: n.status || 'pending',
            rescheduled_date: n.rescheduledDate ? new Date(n.rescheduledDate).toISOString() : null,
            read: Boolean(n.read),
            created_at: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
          })
          .select()
          .single();

        if (nErr) console.error('Error inserting doctor notification:', nErr);
        if (newN) {
          n._id = newN.id;
          n.id = newN.id;
        }
      } else {
        const nId = n._id || n.id;
        await supabase
          .from('doctor_notifications')
          .update({
            status: n.status,
            read: Boolean(n.read),
            rescheduled_date: n.rescheduledDate ? new Date(n.rescheduledDate).toISOString() : null,
          })
          .eq('id', nId);
      }
    }
  }

  return doctor;
}

export const Doctor = {
  findOne(query = {}) {
    return createPopulatablePromise(async () => {
      if (!query || (!query.phone && !query.id && !query._id)) {
        return null;
      }
      let req = supabase.from('doctors').select('*');
      if (query.phone) req = req.eq('phone', String(query.phone).trim());
      if (query._id || query.id) req = req.eq('id', query._id || query.id);

      const { data, error } = await req.maybeSingle();
      if (error || !data) return null;
      return await fetchDoctorDetails(data);
    });
  },

  findById(id) {
    return createPopulatablePromise(async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('doctors').select('*').eq('id', id).maybeSingle();
      if (error || !data) return null;
      return await fetchDoctorDetails(data);
    });
  },

  find(query = {}) {
    return createPopulatablePromise(async () => {
      const { data, error } = await supabase.from('doctors').select('*');
      if (error || !data) return [];
      const list = [];
      for (const row of data) {
        list.push(await fetchDoctorDetails(row));
      }
      return list;
    });
  },

  async create(data) {
    const { data: newDoctor, error } = await supabase
      .from('doctors')
      .insert({
        phone: String(data.phone).trim(),
        name: String(data.name).trim(),
        clinic_name: String(data.clinicName).trim(),
        specialization: data.specialization ? String(data.specialization).trim() : '',
        experience: Number(data.experience) || 0,
        location: data.location ? String(data.location).trim() : '',
      })
      .select()
      .single();

    if (error) throw new Error(`Doctor creation failed: ${error.message}`);
    return await fetchDoctorDetails(newDoctor);
  },

  async findOneAndUpdate(query, update, options = {}) {
    let updateFields = update.$set ? { ...update.$set } : { ...update };
    const setPayload = {};

    if (updateFields.name !== undefined) setPayload.name = updateFields.name;
    if (updateFields.clinicName !== undefined) setPayload.clinic_name = updateFields.clinicName;
    if (updateFields.specialization !== undefined) setPayload.specialization = updateFields.specialization;
    if (updateFields.experience !== undefined) setPayload.experience = Number(updateFields.experience);
    if (updateFields.location !== undefined) setPayload.location = updateFields.location;
    if (updateFields.phone !== undefined) setPayload.phone = updateFields.phone;
    setPayload.updated_at = new Date().toISOString();

    let req = supabase.from('doctors').update(setPayload);
    if (query.phone) req = req.eq('phone', query.phone);
    if (query.id || query._id) req = req.eq('id', query.id || query._id);

    const { data, error } = await req.select().maybeSingle();
    if (error) {
      if (error.code === '23505') {
        const err = new Error('Duplicate phone');
        err.code = 11000;
        throw err;
      }
      throw new Error(error.message);
    }
    if (!data) return null;
    return await fetchDoctorDetails(data);
  },

  async deleteOne(query) {
    let req = supabase.from('doctors').delete();
    if (query.phone) req = req.eq('phone', query.phone);
    if (query._id || query.id) req = req.eq('id', query._id || query.id);
    const { error } = await req;
    if (error) throw new Error(error.message);
    return true;
  },

  async findByIdAndDelete(id) {
    const { error } = await supabase.from('doctors').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },
};

export default Doctor;
