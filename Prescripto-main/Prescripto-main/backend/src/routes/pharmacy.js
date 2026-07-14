import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Pharmacy from '../models/Pharmacy.js';
import MedicineRequest from '../models/MedicineRequest.js';
import Patient from '../models/Patient.js';

const router = Router();

function normalizePhone(phone) {
  if (!phone) return phone;
  return phone.replace(/\D/g, '').slice(-10);
}

function normalizeMedicineName(name) {
  return String(name || '').trim().toLowerCase();
}

router.get('/availability', async (req, res) => {
  try {
    const medicineName = normalizeMedicineName(req.query.medicineName);
    const quantity = Number(req.query.quantity || 0);

    if (!medicineName || !Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'medicineName and quantity required' });
    }

    const pharmacies = await Pharmacy.find({
      stock: {
        $elemMatch: { normalizedName: medicineName },
      },
    }).lean();

    const list = pharmacies.map((p) => {
      const item = (p.stock || []).find((s) => s.normalizedName === medicineName);
      const availableQty = item?.quantity || 0;
      return {
        pharmacyId: p._id,
        pharmacyName: p.pharmacyName,
        location: p.location,
        medicineName: item?.medicineName || req.query.medicineName,
        price: item?.price || 0,
        availableQuantity: availableQty,
        requestedQuantity: quantity,
        available: availableQty >= quantity,
      };
    });

    list.sort((a, b) => Number(b.available) - Number(a.available));
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.use(requireAuth);

router.get('/me', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const email = req.user.email || null;
    const query = phone ? { phone } : email ? { email } : null;
    if (!query) return res.status(401).json({ error: 'Pharmacy not authenticated' });
    const pharmacy = await Pharmacy.findOne(query);
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });
    return res.json(pharmacy);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/me', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const email = req.user.email || null;
    const query = phone ? { phone } : email ? { email } : null;
    if (!query) return res.status(401).json({ error: 'Pharmacy not authenticated' });
    const pharmacy = await Pharmacy.findOne(query);
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });

    const allowed = ['name', 'pharmacyName', 'location'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        pharmacy[key] = req.body[key];
      }
    }
    await pharmacy.save();
    return res.json(pharmacy);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/stock', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const email = req.user.email || null;
    const query = phone ? { phone } : email ? { email } : null;
    if (!query) return res.status(401).json({ error: 'Pharmacy not authenticated' });
    const pharmacy = await Pharmacy.findOne(query).lean();
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });
    return res.json((pharmacy.stock || []).slice().sort((a, b) => a.medicineName.localeCompare(b.medicineName)));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/stock', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const email = req.user.email || null;
    const query = phone ? { phone } : email ? { email } : null;
    if (!query) return res.status(401).json({ error: 'Pharmacy not authenticated' });
    const pharmacy = await Pharmacy.findOne(query);
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });

    const medicineName = String(req.body.medicineName || '').trim();
    const quantity = Number(req.body.quantity);
    const price = Number(req.body.price);

    if (!medicineName || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: 'medicineName, quantity, price required' });
    }

    const normalizedName = normalizeMedicineName(medicineName);
    const existing = (pharmacy.stock || []).find((s) => s.normalizedName === normalizedName);
    if (existing) {
      existing.quantity = quantity;
      existing.price = price;
      existing.updatedAt = new Date();
    } else {
      pharmacy.stock.push({
        medicineName,
        normalizedName,
        quantity,
        price,
        updatedAt: new Date(),
      });
    }

    await pharmacy.save();
    return res.status(201).json(pharmacy.stock);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/stock/:stockId', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const email = req.user.email || null;
    const query = phone ? { phone } : email ? { email } : null;
    if (!query) return res.status(401).json({ error: 'Pharmacy not authenticated' });
    const pharmacy = await Pharmacy.findOne(query);
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });

    const stock = pharmacy.stock.id(req.params.stockId);
    if (!stock) return res.status(404).json({ error: 'Stock item not found' });

    if (req.body.quantity !== undefined) {
      const qty = Number(req.body.quantity);
      if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ error: 'Invalid quantity' });
      stock.quantity = qty;
    }
    if (req.body.price !== undefined) {
      const price = Number(req.body.price);
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'Invalid price' });
      stock.price = price;
    }
    if (req.body.medicineName !== undefined) {
      const medicineName = String(req.body.medicineName || '').trim();
      if (!medicineName) return res.status(400).json({ error: 'Invalid medicineName' });
      stock.medicineName = medicineName;
      stock.normalizedName = normalizeMedicineName(medicineName);
    }
    stock.updatedAt = new Date();
    await pharmacy.save();

    return res.json(stock);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/requests', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const email = req.user.email || null;
    const query = phone ? { phone } : email ? { email } : null;
    if (!query) return res.status(401).json({ error: 'Pharmacy not authenticated' });
    const pharmacy = await Pharmacy.findOne(query);
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });

    const list = await MedicineRequest.find({ pharmacyId: pharmacy._id })
      .populate({ path: 'patientId', select: 'patientId name phone' })
      .sort({ requestedAt: -1 })
      .lean();

    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/requests/:id/ready', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const email = req.user.email || null;
    const query = phone ? { phone } : email ? { email } : null;
    if (!query) return res.status(401).json({ error: 'Pharmacy not authenticated' });
    const pharmacy = await Pharmacy.findOne(query);
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });

    const request = await MedicineRequest.findOne({ _id: req.params.id, pharmacyId: pharmacy._id });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Only pending request can be marked ready' });

    const items = Array.isArray(request.requestedMedicines) && request.requestedMedicines.length > 0
      ? request.requestedMedicines
      : [{
          normalizedMedicineName: request.normalizedMedicineName,
          quantity: request.quantity,
        }];

    for (const item of items) {
      const stock = (pharmacy.stock || []).find((s) => s.normalizedName === item.normalizedMedicineName);
      if (!stock || stock.quantity < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${item.medicineName || 'requested medicine'}` });
      }
    }

    for (const item of items) {
      const stock = (pharmacy.stock || []).find((s) => s.normalizedName === item.normalizedMedicineName);
      stock.quantity -= item.quantity;
      stock.updatedAt = new Date();
    }

    request.status = 'ready';
    request.readyAt = new Date();
    await pharmacy.save();
    await request.save();

    const patient = await Patient.findById(request.patientId);
    if (patient) {
      patient.notifications = patient.notifications || [];
      patient.notifications.push({
        type: 'reminder',
        title: 'Your medicine is ready',
        message: `Your medicine is ready at ${pharmacy.pharmacyName}.`,
        meta: {
          requestId: request._id,
          pharmacyId: pharmacy._id,
          targetView: 'medicine-requirement-status',
        },
        createdAt: new Date(),
      });
      await patient.save();
    }

    return res.json(request);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/requests/:id/delivered', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const email = req.user.email || null;
    const query = phone ? { phone } : email ? { email } : null;
    if (!query) return res.status(401).json({ error: 'Pharmacy not authenticated' });
    const pharmacy = await Pharmacy.findOne(query);
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });

    const request = await MedicineRequest.findOne({ _id: req.params.id, pharmacyId: pharmacy._id });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'ready') return res.status(400).json({ error: 'Only ready request can be marked delivered' });

    const priorDelivered = await MedicineRequest.find({
      patientId: request.patientId,
      prescriptionId: request.prescriptionId,
      status: { $in: ['picked_up', 'delivered'] },
    }).lean();

    const deliveredByMedicine = new Map();
    for (const delivered of priorDelivered) {
      const items = Array.isArray(delivered.requestedMedicines) && delivered.requestedMedicines.length > 0
        ? delivered.requestedMedicines
        : [{
            medicineName: delivered.medicineName,
            requestedDays: delivered.days,
          }];
      for (const item of items) {
        const key = normalizeMedicineName(item.medicineName);
        deliveredByMedicine.set(key, (deliveredByMedicine.get(key) || 0) + Number(item.requestedDays || 0));
      }
    }

    const currentItems = Array.isArray(request.requestedMedicines) && request.requestedMedicines.length > 0
      ? request.requestedMedicines
      : [{
          medicineName: request.medicineName,
          requestedDays: request.days,
          prescribedDays: request.prescribedDays || request.days,
        }];
    for (const item of currentItems) {
      const key = normalizeMedicineName(item.medicineName);
      const alreadyDelivered = deliveredByMedicine.get(key) || 0;
      const prescribedDays = Number(item.prescribedDays) || 0;
      const requestedDays = Number(item.requestedDays) || 0;
      if (prescribedDays > 0 && alreadyDelivered + requestedDays > prescribedDays) {
        return res.status(400).json({ error: `Balance exceeded for ${item.medicineName}` });
      }
    }

    request.status = 'picked_up';
    request.pickedUpAt = new Date();
    await request.save();

    const patient = await Patient.findById(request.patientId);
    if (patient) {
      patient.notifications = patient.notifications || [];
      patient.notifications.push({
        type: 'reminder',
        title: 'You picked up the medicines',
        message: `Pickup confirmed from ${pharmacy.pharmacyName}.`,
        meta: {
          requestId: request._id,
          pharmacyId: pharmacy._id,
          targetView: 'medicine-requirement-status',
        },
        createdAt: new Date(),
      });
      await patient.save();
    }

    return res.json(request);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
