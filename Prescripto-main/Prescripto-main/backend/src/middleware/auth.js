import { verifyIdToken } from '../config/firebase.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = header.replace('Bearer ', '').trim();
    const decoded = await verifyIdToken(token);

    // Extract phone or email from Firebase token
    let phone = decoded.phone_number || decoded.firebase?.identities?.phone?.[0];
    const email = decoded.email || (decoded.firebase && decoded.firebase.identities && decoded.firebase.identities.email && decoded.firebase.identities.email[0]) || null;

    // If phone exists normalize to DB format
    if (phone) {
      phone = String(phone).replace('+91', '').replace(/\D/g, '');
    }

    if (!phone && !email) {
      return res.status(401).json({ error: 'No phone or email found in token' });
    }

    req.user = {
      uid: decoded.uid,
      phone: phone || null,
      email: email || null,
    };

    next();
  } catch (err) {
    const code = err?.code || err?.errorInfo?.code || '';
    const isExpired = String(code).includes('id-token-expired');
    if (isExpired) {
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
