# Prescripto – Architecture Plan (Refined)

## 1. Product Scope

Prescripto is a **patient–doctor digital prescription and continuity-of-care** system. It is **not** a pharmacy or dispensing system.

- **Digital prescriptions**: Doctors issue prescriptions; patients view and store them.
- **Medical history continuity**: Longitudinal view of prescriptions and relevant history per patient.
- **Reminders**: Patient-facing reminders (e.g. medication, follow-up).
- **Voice assistant**: Patient-only; navigation and Tamil/English language switching—**not** for medical advice.

**Out of scope**: Pharmacists, dispensing, stock, pharmacy workflows, OAuth2, external IdP, medical advice via voice.

---

## 2. Roles and Actors

| Role    | Description | Capabilities |
|---------|-------------|--------------|
| **Patient** | Person receiving care | View own prescriptions & history, receive reminders, use voice for navigation/language (Tamil/English). |
| **Doctor**  | Prescriber             | Create/edit prescriptions for patients, view patient history for continuity, manage own profile. |

No pharmacist, admin, or other roles in core scope.

---

## 3. High-Level Architecture

- **Style**: Layered application with clear separation: API → application services → domain → data.
- **Data**: Single primary store—**MongoDB** (document-based). Prescriptions are **embedded in the patient document**, not normalized across collections.
- **Auth**: **Firebase Phone Number OTP only**; no OAuth2, no external IdP.
- **Voice**: Patient app only; navigation + language switching (Tamil/English); no medical advice.

---

## 4. Bounded Contexts (Simplified)

| Context | Responsibility | Key Concepts |
|---------|----------------|--------------|
| **Identity & access** | Firebase Phone OTP auth; link phone to Patient/Doctor; sessions | User (Patient/Doctor), Phone, Session |
| **Patient** | Patient profile + **embedded prescriptions** + medical history continuity | Patient document (profile + prescriptions[] + history) |
| **Prescribing** | Doctor creates/updates prescriptions; prescriptions stored **inside** patient document | Prescription (embedded), Medication, Dosage, Duration |
| **Reminders** | Patient reminders (medication, follow-up); no dispensing logic | Reminder, Channel (push/in-app), Schedule |
| **Voice (patient)** | Navigation and language switching (Tamil/English) only | Locale, Navigation intent, TTS/STT config |

No dispensing, pharmacy, or stock context.

---

## 5. Data Architecture (MongoDB)

### 5.1 Document Model

- **Database**: MongoDB.
- **Prescriptions**: Stored **inside the patient document** as an embedded array (or sub-documents), not as a separate collection with foreign keys.
- **Rationale**: Aligns with “patient-centric” view, simplifies reads for history/continuity, and fits two-role, no-dispensing scope.

### 5.2 Core Collections (Conceptual)

| Collection | Purpose | Document Shape (Conceptual) |
|------------|---------|----------------------------|
| **patients** | One document per patient. **Embedded prescriptions** and continuity data. | `{ _id, phone, profile{}, prescriptions[], historyMetadata?, reminders[], createdAt, updatedAt }` |
| **doctors** | Doctor profile and linkage to Firebase phone. | `{ _id, phone, profile{}, createdAt, updatedAt }` |
| **reminders** (optional) | If reminders are heavy or shared, can be separate with `patientId` reference; otherwise embedded in patient. | `{ _id, patientId, type, schedule, channel, ... }` |
| **audit / logs** | Optional; for compliance and debugging (who did what, when). | Event-style or log documents with actor, action, resource, timestamp. |

- **prescriptions** (embedded in patient): Each item has prescription metadata (date, doctor reference/id), medications (name, dosage, duration, instructions), and optionally follow-up. No dispensing or pharmacy fields.
- **Medical history continuity**: Served from the same patient document (prescriptions + any minimal history metadata); no separate “dispensing” or “fulfillment” data.

### 5.3 Doctor–Patient Relationship

- Doctors are identified by `_id` or stable doctor reference.
- Prescriptions embedded in patient document store **doctor reference** (e.g. `doctorId`) for continuity and display—no relational joins; doctor details can be cached or read from `doctors` when needed.

### 5.4 No Relational Prescription Model

- No separate `prescriptions` collection with foreign keys to patients.
- No pharmacy, stock, or dispensing tables.

---

## 6. Authentication Architecture

- **Method**: **Firebase Phone Number OTP only.**
- **Flow**: User enters phone → Firebase sends OTP → user submits OTP → Firebase returns auth token (e.g. custom token or ID token). Backend verifies Firebase token and resolves role (Patient vs Doctor).
- **No OAuth2, no external IdP** (no Google/Microsoft/Apple sign-in as primary auth).
- **Session**: Backend issues its own session/JWT after Firebase verification, or trusts Firebase ID token per request; session stores role (patient/doctor) and internal user id.
- **MFA**: Optional future: second factor (e.g. same phone, different channel); not required for initial architecture.

---

## 7. API and Application Layers

- **API layer**: REST (or similar) for web/mobile; versioned endpoints; clear error and validation contracts.
- **Application layer**: Use cases only—e.g. “Create prescription (for patient)”, “Get patient history”, “Set reminder”, “Switch language”. No dispensing or pharmacy logic.
- **Domain rules**: e.g. prescription must have doctor reference, patient reference (implicit via document), medications, dosage; no dispensing or stock rules.
- **Authorization**: By role (Patient vs Doctor) and resource (patient can only access own document; doctor only assigned/accessible patients as per product rules).

---

## 8. Voice Assistant (Patient Only)

- **Scope**: **Navigation and language switching (Tamil/English) only.** Not for medical advice, diagnosis, or treatment.
- **Capabilities**:  
  - Navigate app (e.g. “go to prescriptions”, “show history”).  
  - Switch UI/content language between Tamil and English.  
  - Possibly: read-back of static content (e.g. “read my last prescription”) as informational only, not advice.
- **Implementation**: Intent handling for “navigation” and “language”; TTS/STT for Tamil and English; no medical Q&A or recommendation engine.
- **Not in scope**: Drug interaction advice, dosage advice, or any clinical decision support via voice.

---

## 9. Reminders

- **Purpose**: Medication reminders, follow-up reminders (e.g. next visit).
- **Ownership**: Patient-scoped; no dispensing or pharmacy.
- **Channels**: In-app and/or push; optional future: SMS (still non-dispensing).
- **Data**: Either embedded in patient document or separate `reminders` collection with `patientId`; schedule and type (medication vs follow-up) only.

---

## 10. Security and Compliance (High Level)

- **Auth**: Firebase Phone OTP only; verify token on backend; bind session to role and internal id.
- **Authorization**: Role-based (Patient, Doctor); resource-level (patient sees only self; doctor sees only patients they are allowed to see).
- **Data**: Encryption in transit (TLS); encryption at rest (MongoDB/provider); no PII in logs where avoidable; prescriptions and history as sensitive.
- **Audit**: Log access and changes (who created/updated prescriptions, who viewed history) for continuity and compliance—stored in MongoDB or dedicated log store.

---

## 11. Frontend and Clients

- **Patient**: Web and/or mobile app; voice for navigation + Tamil/English switching; views: prescriptions, history, reminders, language/settings.
- **Doctor**: Web and/or mobile app; views: create/edit prescription (for a patient), patient history (continuity), own profile; no dispensing UI.
- **State**: Auth state from Firebase + backend session; server state from API (prescriptions and history from patient document).

---

## 12. Integration and External Systems

- **Firebase**: Auth (Phone OTP only); optional: push notifications for reminders.
- **No**: Pharmacy systems, stock, EMR (unless added later as optional integration for history only).
- **Optional later**: Notifications (e.g. SMS gateway for OTP or reminders); still no dispensing.

---

## 13. Deployment and Operations (Summary)

- **Runtime**: Containers (e.g. Docker); optional orchestration (e.g. Kubernetes) when scaling.
- **Database**: MongoDB (managed or self-hosted); backups and retention for documents (including embedded prescriptions).
- **CI/CD**: Build, test, deploy; secrets (e.g. Firebase, MongoDB) in vault/env, not in code.
- **Observability**: Logs, metrics, health checks; optional tracing for API flows.

---

## 14. Phased Implementation (Revised)

1. **Phase 1 – Foundation**  
   - MongoDB + `patients` and `doctors` collections.  
   - Firebase Phone OTP auth; role resolution (Patient/Doctor).  
   - Patient document with embedded `prescriptions[]` (minimal schema).  
   - API: register/login, get own profile, get own prescriptions/history (patient), create prescription (doctor, writes into patient document).

2. **Phase 2 – Continuity and Reminders**  
   - Medical history continuity (read from patient document).  
   - Reminders (embedded or separate collection); in-app/push.  
   - Doctor: view patient history; patient: view history and reminders.

3. **Phase 3 – Voice and Language**  
   - Patient voice: navigation intents and Tamil/English language switching.  
   - TTS/STT (Tamil/English); no medical advice flows.

4. **Phase 4 – Polish and Compliance**  
   - Audit logging, retention, performance; optional reporting; no dispensing or pharmacy features.

---

## 15. Constraints Summary

| Area | Decision |
|------|----------|
| **Roles** | Patient and Doctor only. |
| **Scope** | Digital prescriptions, medical history continuity, reminders. No pharmacy, dispensing, or stock. |
| **Database** | MongoDB; prescriptions **embedded in patient document**. |
| **Auth** | Firebase Phone Number OTP only; no OAuth2, no external IdP. |
| **Voice** | Patient only; navigation + language (Tamil/English); not for medical advice. |

This document is the refined architecture plan for Prescripto under the stated constraints. No code is generated; implementation can follow this plan.
