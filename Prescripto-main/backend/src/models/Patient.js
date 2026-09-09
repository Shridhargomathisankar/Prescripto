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

async function fetchPatientDetails(row) {
  if (!row) return null;
  const patientId = row.id;

  // 1. Prescriptions + Medicines + Doctor details
  const { data: rxData, error: rxErr } = await supabase
    .from('prescriptions')
    .select(`
      id, disease, doctor_id, doctor_name, clinic_name, created_at,
      prescription_medicines ( id, name, dosage, morning, afternoon, evening, night, duration_in_days ),
      doctors ( id, name, clinic_name, specialization )
    `)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });

  if (rxErr) console.error('fetchPatientDetails rxErr:', rxErr);

  const prescriptions = (rxData || []).map((p) => {
    const rawDoc = Array.isArray(p.doctors) ? p.doctors[0] : p.doctors;
    const docObj = rawDoc
      ? {
          _id: rawDoc.id,
          id: rawDoc.id,
          name: rawDoc.name,
          clinicName: rawDoc.clinic_name,
          specialization: rawDoc.specialization,
          toString() {
            return String(rawDoc.id);
          },
        }
      : p.doctor_id
      ? String(p.doctor_id)
      : null;

    return {
      _id: p.id,
      id: p.id,
      disease: p.disease,
      doctorId: docObj,
      doctorName: p.doctor_name || p.doctors?.name || '',
      clinicName: p.clinic_name || p.doctors?.clinic_name || '',
      createdAt: p.created_at,
      medicines: (p.prescription_medicines || []).map((m) => ({
        _id: m.id,
        id: m.id,
        name: m.name,
        dosage: m.dosage || '',
        morning: Boolean(m.morning),
        afternoon: Boolean(m.afternoon),
        evening: Boolean(m.evening),
        night: Boolean(m.night),
        durationInDays: m.duration_in_days || 7,
      })),
    };
  });

  // 2. Reports
  const { data: reportsData } = await supabase
    .from('patient_reports')
    .select('*')
    .eq('patient_id', patientId)
    .order('uploaded_at', { ascending: true });

  const reports = (reportsData || []).map((r) => ({
    _id: r.id,
    id: r.id,
    name: r.name,
    url: r.url || '',
    dataUrl: r.data_url || '',
    uploadedAt: r.uploaded_at,
  }));

  // 3. Access Requests
  const { data: arData } = await supabase
    .from('access_requests')
    .select(`
      id, doctor_id, status, requested_at, responded_at, session_started_at, session_ended_at, auto_close_at,
      doctors ( id, name, clinic_name )
    `)
    .eq('patient_id', patientId)
    .order('requested_at', { ascending: true });

  const accessRequests = (arData || []).map((r) => {
    const rawDoc = Array.isArray(r.doctors) ? r.doctors[0] : r.doctors;
    const docObj = rawDoc
      ? {
          _id: rawDoc.id,
          id: rawDoc.id,
          name: rawDoc.name,
          clinicName: rawDoc.clinic_name,
          toString() {
            return String(rawDoc.id);
          },
        }
      : r.doctor_id
      ? String(r.doctor_id)
      : null;

    return {
      _id: r.id,
      id: r.id,
      doctorId: docObj,
      status: r.status,
      requestedAt: r.requested_at,
      respondedAt: r.responded_at,
      sessionStartedAt: r.session_started_at,
      sessionEndedAt: r.session_ended_at,
      autoCloseAt: r.auto_close_at,
    };
  });

  // 4. Consult Requests
  const { data: crData } = await supabase
    .from('consult_requests')
    .select(`
      id, doctor_id, requested_date, status, rescheduled_date, created_at,
      doctors ( id, name, clinic_name )
    `)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });

  const consultRequests = (crData || []).map((c) => {
    const docObj = c.doctors
      ? {
          _id: c.doctors.id,
          id: c.doctors.id,
          name: c.doctors.name,
          clinicName: c.doctors.clinic_name,
          toString() {
            return String(c.doctors.id);
          },
        }
      : c.doctor_id
      ? String(c.doctor_id)
      : null;

    return {
      _id: c.id,
      id: c.id,
      doctorId: docObj,
      requestedDate: c.requested_date,
      status: c.status,
      rescheduledDate: c.rescheduled_date,
      createdAt: c.created_at,
    };
  });

  // 5. Notifications
  const { data: notifData } = await supabase
    .from('patient_notifications')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });

  const notifications = (notifData || []).map((n) => ({
    _id: n.id,
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    meta: n.meta || {},
    read: Boolean(n.read),
    createdAt: n.created_at,
  }));

  const instance = {
    _id: row.id,
    id: row.id,
    patientId: row.patient_id,
    phone: row.phone,
    name: row.name,
    age: row.age,
    bloodGroup: row.blood_group || '',
    medicalInfo: row.medical_info || '',
    gender: row.gender || '',
    location: row.location || '',
    language: row.language || 'en',
    reminderSettings: row.reminder_settings || {
      morningTime: '10:00',
      afternoonTime: '13:00',
      nightTime: '20:00',
      reminderType: 'notification',
      alarmTone: 'default',
      messageTone: 'default',
    },
    activeSession: row.active_session || null,
    reminders: row.reminders || [],
    prescriptions,
    reports,
    accessRequests,
    consultRequests,
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
      return await updatePatientInstance(this);
    },
  };

  return instance;
}

async function updatePatientInstance(patient) {
  // 1. Update core fields on patients table
  const { error: patientErr } = await supabase
    .from('patients')
    .update({
      name: patient.name,
      age: Number(patient.age),
      blood_group: patient.bloodGroup,
      medical_info: patient.medicalInfo,
      gender: patient.gender,
      location: patient.location,
      language: patient.language,
      reminder_settings: patient.reminderSettings,
      active_session: patient.activeSession,
      reminders: patient.reminders,
      updated_at: new Date().toISOString(),
    })
    .eq('id', patient._id);

  if (patientErr) throw new Error(patientErr.message);

  // 2. Prescriptions sync
  if (Array.isArray(patient.prescriptions)) {
    for (const rx of patient.prescriptions) {
      if (!rx._id && !rx.id) {
        // Insert new prescription
        const docId = typeof rx.doctorId === 'object' ? rx.doctorId._id || rx.doctorId.id : rx.doctorId;
        const { data: newRx, error: rxInsErr } = await supabase
          .from('prescriptions')
          .insert({
            patient_id: patient._id,
            doctor_id: docId || null,
            disease: rx.disease,
            doctor_name: rx.doctorName || '',
            clinic_name: rx.clinicName || '',
          })
          .select()
          .single();

        if (rxInsErr) console.error('Error inserting prescription:', rxInsErr);

        if (newRx && Array.isArray(rx.medicines)) {
          rx._id = newRx.id;
          rx.id = newRx.id;

          const medsToInsert = rx.medicines.map((m) => ({
            prescription_id: newRx.id,
            name: m.name,
            dosage: m.dosage || '',
            morning: Boolean(m.morning),
            afternoon: Boolean(m.afternoon),
            evening: Boolean(m.evening),
            night: Boolean(m.night),
            duration_in_days: Number(m.durationInDays) || 7,
          }));

          const { data: insertedMeds, error: medInsErr } = await supabase
            .from('prescription_medicines')
            .insert(medsToInsert)
            .select();

          if (medInsErr) console.error('Error inserting medicines:', medInsErr);
          else if (insertedMeds) {
            insertedMeds.forEach((im, idx) => {
              if (rx.medicines[idx]) {
                rx.medicines[idx]._id = im.id;
                rx.medicines[idx].id = im.id;
              }
            });
          }
        }
      }
    }
  }

  // 3. Reports sync
  if (Array.isArray(patient.reports)) {
    for (const rep of patient.reports) {
      if (!rep._id && !rep.id) {
        const { data: newRep, error: repErr } = await supabase
          .from('patient_reports')
          .insert({
            patient_id: patient._id,
            name: rep.name,
            url: rep.url || '',
            data_url: rep.dataUrl || '',
            uploaded_at: rep.uploadedAt ? new Date(rep.uploadedAt).toISOString() : new Date().toISOString(),
          })
          .select()
          .single();

        if (repErr) console.error('Error inserting report:', repErr);
        if (newRep) {
          rep._id = newRep.id;
          rep.id = newRep.id;
        }
      }
    }
  }

  // 4. Access Requests sync
  if (Array.isArray(patient.accessRequests)) {
    for (const ar of patient.accessRequests) {
      const docId = typeof ar.doctorId === 'object' ? ar.doctorId._id || ar.doctorId.id : ar.doctorId;
      if (!ar._id && !ar.id) {
        const { data: newAr, error: arInsErr } = await supabase
          .from('access_requests')
          .insert({
            patient_id: patient._id,
            doctor_id: docId,
            status: ar.status || 'pending',
            requested_at: ar.requestedAt ? new Date(ar.requestedAt).toISOString() : new Date().toISOString(),
            responded_at: ar.respondedAt ? new Date(ar.respondedAt).toISOString() : null,
            session_started_at: ar.sessionStartedAt ? new Date(ar.sessionStartedAt).toISOString() : null,
            session_ended_at: ar.sessionEndedAt ? new Date(ar.sessionEndedAt).toISOString() : null,
            auto_close_at: ar.autoCloseAt ? new Date(ar.autoCloseAt).toISOString() : null,
          })
          .select()
          .single();

        if (arInsErr) console.error('Error inserting access request:', arInsErr);

        if (newAr) {
          ar._id = newAr.id;
          ar.id = newAr.id;
        }
      } else {
        const arId = ar._id || ar.id;
        await supabase
          .from('access_requests')
          .update({
            status: ar.status,
            responded_at: ar.respondedAt ? new Date(ar.respondedAt).toISOString() : null,
            session_started_at: ar.sessionStartedAt ? new Date(ar.sessionStartedAt).toISOString() : null,
            session_ended_at: ar.sessionEndedAt ? new Date(ar.sessionEndedAt).toISOString() : null,
            auto_close_at: ar.autoCloseAt ? new Date(ar.autoCloseAt).toISOString() : null,
          })
          .eq('id', arId);
      }
    }
  }

  // 5. Consult Requests sync
  if (Array.isArray(patient.consultRequests)) {
    for (const cr of patient.consultRequests) {
      const docId = typeof cr.doctorId === 'object' ? cr.doctorId._id || cr.doctorId.id : cr.doctorId;
      if (!cr._id && !cr.id) {
        const { data: newCr, error: crInsErr } = await supabase
          .from('consult_requests')
          .insert({
            patient_id: patient._id,
            doctor_id: docId,
            requested_date: cr.requestedDate ? new Date(cr.requestedDate).toISOString() : new Date().toISOString(),
            status: cr.status || 'pending',
            rescheduled_date: cr.rescheduledDate ? new Date(cr.rescheduledDate).toISOString() : null,
            created_at: cr.createdAt ? new Date(cr.createdAt).toISOString() : new Date().toISOString(),
          })
          .select()
          .single();

        if (crInsErr) console.error('Error inserting consult request:', crInsErr);

        if (newCr) {
          cr._id = newCr.id;
          cr.id = newCr.id;
        }
      } else {
        const crId = cr._id || cr.id;
        await supabase
          .from('consult_requests')
          .update({
            status: cr.status,
            rescheduled_date: cr.rescheduledDate ? new Date(cr.rescheduledDate).toISOString() : null,
          })
          .eq('id', crId);
      }
    }
  }

  // 6. Notifications sync
  if (Array.isArray(patient.notifications)) {
    for (const n of patient.notifications) {
      if (!n._id && !n.id) {
        const { data: newN, error: nInsErr } = await supabase
          .from('patient_notifications')
          .insert({
            patient_id: patient._id,
            type: n.type,
            title: n.title,
            message: n.message,
            meta: n.meta || {},
            read: Boolean(n.read),
            created_at: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
          })
          .select()
          .single();

        if (nInsErr) console.error('Error inserting notification:', nInsErr);

        if (newN) {
          n._id = newN.id;
          n.id = newN.id;
        }
      } else {
        const nId = n._id || n.id;
        await supabase
          .from('patient_notifications')
          .update({
            read: Boolean(n.read),
          })
          .eq('id', nId);
      }
    }
  }

  return patient;
}

export const Patient = {
  findOne(query = {}) {
    return createPopulatablePromise(async () => {
      if (!query || (!query.phone && !query.patientId && !query.id && !query._id)) {
        return null;
      }
      let req = supabase.from('patients').select('*');
      if (query.phone) req = req.eq('phone', String(query.phone).trim());
      if (query.patientId) req = req.ilike('patient_id', String(query.patientId).trim());
      if (query.id || query._id) req = req.eq('id', query.id || query._id);

      const { data, error } = await req.maybeSingle();
      if (error || !data) return null;
      return await fetchPatientDetails(data);
    });
  },

  findById(id) {
    return createPopulatablePromise(async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('patients').select('*').eq('id', id).maybeSingle();
      if (error || !data) return null;
      return await fetchPatientDetails(data);
    });
  },

  find(query = {}) {
    return createPopulatablePromise(async () => {
      let { data, error } = await supabase.from('patients').select('*');
      if (error || !data) return [];

      const list = [];
      for (const row of data) {
        const patient = await fetchPatientDetails(row);
        let match = true;

        if (query['accessRequests.doctorId'] || query['accessRequests.status'] || query.$or) {
          const docId = query['accessRequests.doctorId'];
          const hasMatch = (patient.accessRequests || []).some((ar) => {
            const arDocId = typeof ar.doctorId === 'object' ? ar.doctorId._id || ar.doctorId.id : ar.doctorId;
            const matchesDoc = !docId || String(arDocId) === String(docId);
            let matchesStatus = true;
            if (query.$or) {
              const statuses = query.$or.map((cond) => cond['accessRequests.status']).filter(Boolean);
              if (statuses.length > 0) {
                matchesStatus = statuses.includes(ar.status);
              }
            }
            return matchesDoc && matchesStatus;
          });
          if (!hasMatch) match = false;
        }

        if (match) list.push(patient);
      }
      return list;
    });
  },

  async create(data) {
    const tableName = 'patients';
    const payload = {
      patient_id: String(data.patientId).trim(),
      phone: String(data.phone).trim(),
      name: String(data.name).trim(),
      age: Number(data.age),
      blood_group: data.bloodGroup ? String(data.bloodGroup).trim() : null,
      medical_info: data.medicalInfo ? String(data.medicalInfo).trim() : null,
      gender: data.gender ? String(data.gender).trim() : '',
      location: data.location ? String(data.location).trim() : '',
      language: data.language ? String(data.language).trim() : 'en',
      reminder_settings: data.reminderSettings || {
        morningTime: '10:00',
        afternoonTime: '13:00',
        nightTime: '20:00',
        reminderType: 'notification',
        alarmTone: 'default',
        messageTone: 'default',
      },
    };

    console.log('[PATIENT CREATE BEFORE INSERT]');
    console.log('Table Name:', tableName);
    console.log('Insert Payload:', JSON.stringify(payload, null, 2));

    const { data: newPatient, error } = await supabase
      .from(tableName)
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[PATIENT CREATE ERROR DIAGNOSTICS]');
      console.error('Table Name:', tableName);
      console.error('Insert Payload:', payload);
      console.error('Full Error Object:', error);
      console.error('error.message:', error.message);
      console.error('error.code:', error.code);
      console.error('error.details:', error.details);
      console.error('error.hint:', error.hint);
      console.error('JSON Error Stringify:', JSON.stringify(error, null, 2));

      throw new Error(`Patient creation failed: ${error.message || 'Unknown Supabase Error'}`);
    }

    console.log('[PATIENT CREATE SUCCESS] Inserted record ID:', newPatient?.id);
    return await fetchPatientDetails(newPatient);
  },

  async findOneAndUpdate(query, update, options = {}) {
    let updateFields = update.$set ? { ...update.$set } : { ...update };
    const setPayload = {};

    if (updateFields.name !== undefined) setPayload.name = updateFields.name;
    if (updateFields.age !== undefined) setPayload.age = Number(updateFields.age);
    if (updateFields.bloodGroup !== undefined) setPayload.blood_group = updateFields.bloodGroup;
    if (updateFields.medicalInfo !== undefined) setPayload.medical_info = updateFields.medicalInfo;
    if (updateFields.gender !== undefined) setPayload.gender = updateFields.gender;
    if (updateFields.location !== undefined) setPayload.location = updateFields.location;
    if (updateFields.language !== undefined) setPayload.language = updateFields.language;
    if (updateFields.reminders !== undefined) setPayload.reminders = updateFields.reminders;

    const rsKeys = Object.keys(updateFields).filter((k) => k.startsWith('reminderSettings.'));
    if (rsKeys.length > 0) {
      const existing = await Patient.findOne(query);
      const rs = existing ? { ...existing.reminderSettings } : {};
      for (const k of rsKeys) {
        const sub = k.split('.')[1];
        rs[sub] = updateFields[k];
      }
      setPayload.reminder_settings = rs;
    }

    setPayload.updated_at = new Date().toISOString();

    let req = supabase.from('patients').update(setPayload);
    if (query.phone) req = req.eq('phone', query.phone);
    if (query.id || query._id) req = req.eq('id', query.id || query._id);

    const { data, error } = await req.select().maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return await fetchPatientDetails(data);
  },

  async deleteOne(query) {
    let req = supabase.from('patients').delete();
    if (query.phone) req = req.eq('phone', query.phone);
    if (query.patientId) req = req.eq('patient_id', query.patientId);
    if (query._id || query.id) req = req.eq('id', query._id || query.id);
    const { error } = await req;
    if (error) throw new Error(error.message);
    return true;
  },

  async findByIdAndDelete(id) {
    const { error } = await supabase.from('patients').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },
};

export default Patient;
