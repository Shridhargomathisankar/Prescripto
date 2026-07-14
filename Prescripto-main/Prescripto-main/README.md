# Prescripto

Patient-centric digital prescription platform with two roles: **Patient** and **Doctor**. Built with React, Node.js, MongoDB, and Firebase Phone OTP.

## Features

- **Patient**: Language selection (Tamil/English) → Phone OTP login/registration → Unique Patient ID → Dashboard (prescriptions, scan reports, reminders placeholder) → Voice assistant (navigation + language switch).
- **Doctor**: Phone OTP login → Search patient by Patient ID → View prescription history → Add new prescription (disease, medicines with Morning/Evening/Night, duration).
- **Voice (patient only)**: Floating mic; Web Speech API; Tamil/English; navigation and language switching only (no medical advice).

## Tech Stack

- **Frontend**: React, Tailwind CSS, Vite, React Router, Firebase (Auth)
- **Backend**: Node.js, Express, MongoDB (Mongoose), Firebase Admin (token verification)
- **Auth**: Firebase Phone Number OTP only
- **Voice**: Web Speech API (SpeechRecognition + SpeechSynthesis)

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Firebase project with Phone Authentication enabled

## Setup

### 1. Firebase

1. Create a project at [Firebase Console](https://console.firebase.google.com).
2. Enable **Phone** sign-in under Authentication → Sign-in method.
3. Get Web config: Project settings → General → Your apps → Web app → config object.
4. For backend token verification: Project settings → Service accounts → Generate new private key. Save as `serviceAccountKey.json` (do not commit).

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env:
# PORT=5000
# MONGODB_URI=mongodb://localhost:27017/prescripto
# GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json  (path to Firebase service account JSON)
npm install
npm run dev
```

API runs at `http://localhost:5000`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env with your Firebase Web config (VITE_FIREBASE_*)
npm install
npm run dev
```

App runs at `http://localhost:3000` (proxies `/api` to backend).

## Project Structure

```
Prescripto/
├── backend/
│   ├── src/
│   │   ├── config/     # db, firebase
│   │   ├── middleware/ # auth (Firebase token verify)
│   │   ├── models/     # Patient, Doctor (prescriptions embedded in Patient)
│   │   ├── routes/     # auth, patients, doctors
│   │   ├── utils/      # patientId generation
│   │   └── index.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ # Button, Input, PrescriptionCard, VoiceAssistant
│   │   ├── config/     # firebase, api
│   │   ├── contexts/   # AuthContext, LanguageContext
│   │   ├── i18n/       # translations (en, ta)
│   │   ├── pages/      # LanguageSelect, Patient/Doctor login & dashboards
│   │   ├── App.jsx, main.jsx, index.css
│   │   └── ...
│   └── package.json
├── ARCHITECTURE.md
└── README.md
```

## Important Logic

- **Patient ID**: Generated as `PREFIX-NNNNNN` (e.g. YUVA-839271). PREFIX = first 4 letters of name (uppercase); NNNNNN = 6 random digits. Uniqueness enforced in MongoDB.
- **Prescriptions**: Stored **inside** the patient document (embedded array), not a separate collection. Doctor adds prescription via `POST /api/doctors/patients/:patientId/prescriptions`.
- **Auth**: Frontend sends Firebase ID token in `Authorization: Bearer <token>` for protected routes; backend verifies with Firebase Admin.

## Security & Ethics

- OTP is real (Firebase). No Aadhaar.
- Patient owns data; doctors access only for consultation.
- No AI diagnosis or medicine suggestion. Voice assistant is navigation/accessibility only.

## License

Private / use as needed.
