# Healthcare Clinic Backend

This backend mirrors the React frontend data model and is now the source of truth for clinic records, visits, concerns, medicine inventory, login, and nurse profile data.

## Setup

1. Start Apache/MySQL in XAMPP.
2. Import `server/schema.sql` in phpMyAdmin or MySQL.
3. Copy `server/.env.example` to `server/.env` and adjust the database values if needed.
4. Optional: create a frontend `.env` with `VITE_API_URL=http://localhost:4000/api` if you change the API port.
5. Run `npm install`.
6. Run `npm run server`.
7. In another terminal, run `npm run dev`.

If you already imported an older schema before `medicines.category` existed, run `server/migrations/001_add_medicine_category.sql` once.

Default login:

- Email: `interworldcolleges@clinic.com`
- Password: `password123`

## Tables

- `users`: nurse/admin login accounts.
- `patient_records`: students and school staff records.
- `visits`: clinic visits, concerns, time in, and time out.
- `visit_medicines`: medicines given during a visit.
- `medicines`: medicine inventory, category, description, image, and stock.
- `nurse_profiles`: profile data shown on the nurse profile page.

## Endpoints

All endpoints except `POST /api/auth/login` and `GET /api/health` require `Authorization: Bearer <token>`.

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`

### Dashboard

- `GET /api/dashboard/stats`

### Patient Records

- `GET /api/patient-records?q=search`
- `GET /api/patient-records/:id`
- `POST /api/patient-records`
- `PUT /api/patient-records/:id`
- `DELETE /api/patient-records/:id`

### Visits / Concerns

- `GET /api/visits?q=search&concern=Headache&status=active`
- `POST /api/visits`
- `PUT /api/visits/:id`
- `PATCH /api/visits/:id/discharge`
- `DELETE /api/visits/:id`
- `DELETE /api/visits/:id?deleteOrphanPatient=true`
- `GET /api/visits/meta/concerns`

`POST /api/visits` creates or updates the matching patient record and decrements stock for any medicines listed in `medicines`.

### Medicines

- `GET /api/medicines?q=search`
- `POST /api/medicines`
- `PUT /api/medicines/:id`
- `PATCH /api/medicines/:id/adjust` with `{ "delta": 1 }` or `{ "delta": -1 }`
- `DELETE /api/medicines/:id`

### Nurse Profile

- `GET /api/nurse-profile`
