# Carepoint — Local Healthcare Appointment Demo

A local full-stack appointment and medical-record demo built with React, Vite, Express, and JSON files. It requires only Node.js and npm: **no MySQL, database server, cloud account, or paid service is needed.**

> **Demo only:** Do not enter real patient information. Local JSON storage is not suitable for real clinical data or production deployment.

## Features

- Patient, doctor, and administrator accounts with JWT authentication and role/ownership checks.
- Public patient registration; administrators cannot be selected during registration.
- A JSON-backed directory with 30 medical specialities and 35 fictional demo doctor profiles in development, including multiple doctors in popular specialities, name/speciality search, filters, sorting, profiles, and backend-managed bookable future slots.
- Serialized booking and rescheduling updates to prevent same-process double booking.
- Appointment status transitions, owner-only appointment lists, and cancellation rules.
- Availability management, completed-visit medical records, and patient/author-scoped record access.
- Admin user, doctor, speciality, appointment, and operational report pages. Admin APIs do not expose clinical record contents.
- Responsive React UI; loading, empty, and error states; frontend API requests use Axios.

## Technology and folders

- `frontend/` — React, Vite, React Router, Axios, Lucide icons, Recharts.
- `backend/` — Express API, JWT, bcryptjs, validation, JSON file storage.
- `backend/data/` — created automatically for users, doctors, specialisations, availability, appointments, and medical records. Private data files are ignored by Git.
- `backend/scripts/createAdmin.js` — safely bootstrap the first local admin.
- `backend/scripts/resetData.js` — confirmation-guarded local data reset.
- `docs/API.md` — API endpoints and access rules.
- `docs/JSON-STORAGE.md` — JSON storage behavior and limitations.

## Prerequisites

- Node.js 20 or newer and npm.
- VS Code and a modern browser.

## Windows setup

Open two terminals in VS Code, with the project folder as the current directory.

### 1. Configure and start the backend

```powershell
Set-Location "C:\Rithesh\Nishasri\Healthcare Appointment\backend"
npm install
Copy-Item .env.example .env
```

Edit `backend\.env`. Generate a random JWT secret in PowerShell and paste its output as the `JWT_SECRET` value:

```powershell
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Set `CLINIC_TIMEZONE` to the clinic's IANA timezone if needed (default `Asia/Kolkata`). The API creates missing empty JSON data files at startup. Then run:

```powershell
npm run dev
```

Check the API at <http://localhost:4000/api/health>; it should return `{"data":{"status":"ok"}}`.

Because the copied `.env.example` sets `NODE_ENV=development`, the backend adds the fictional speciality directory, doctor profiles, and appointment slots to JSON storage on first startup. This directory seeding is idempotent, preserves existing accounts and profiles, and does not run in production. These directory-only accounts have no shared demo password and are not sign-in accounts. To run the same directory seeding explicitly, use `npm run seed:directory` from `backend` with `ALLOW_DEMO_SEED=true` and `NODE_ENV=development`. The separate `npm run seed` command below creates demo sign-in accounts only when explicitly enabled.

### 2. Start the frontend

In the second terminal:

```powershell
Set-Location "C:\Rithesh\Nishasri\Healthcare Appointment\frontend"
npm install
Copy-Item .env.example .env
npm run dev
```

Open <http://localhost:5173>. `frontend\.env` sets `VITE_API_BASE_URL=http://localhost:4000/api`; this is the full API base path (including `/api`). The default backend configuration allows `localhost:5173` and `127.0.0.1:5173` for local development.

## Administrator and demo accounts

Create the initial administrator without relying on a seeded/demo account:

```powershell
Set-Location "C:\Rithesh\Nishasri\Healthcare Appointment\backend"
npm run create-admin
```

This local-only command prompts for account details, hides password input in an interactive terminal, requires the explicit `CREATE ADMIN` confirmation phrase, and refuses to run if an administrator already exists. Use a unique password with at least 12 characters. Password input is not printed by the script.

To seed fictional doctor/patient/admin demo accounts and sample availability, explicitly enable seeding in a development PowerShell session:

```powershell
$env:ALLOW_DEMO_SEED = 'true'
$env:SEED_DEMO_PASSWORD = 'choose-a-unique-password-of-12-chars-or-more'
npm run seed
Remove-Item Env:ALLOW_DEMO_SEED, Env:SEED_DEMO_PASSWORD
```

To seed only the fictional doctor directory and specialities without creating demo sign-in accounts or appointments, use:

```powershell
Set-Location "C:\Rithesh\Nishasri\Healthcare Appointment\backend"
$env:NODE_ENV = 'development'
$env:ALLOW_DEMO_SEED = 'true'
npm run seed:directory
Remove-Item Env:ALLOW_DEMO_SEED
```

Demo users are `patient.demo@healthcare.local`, `doctor.demo@healthcare.local`, and `admin.demo@healthcare.local`; they share the password used in `SEED_DEMO_PASSWORD`. The seed is disabled in production and does not reset existing passwords. Do not use demo accounts in production. Directory profiles are entirely fictional demonstrations, not real licensed clinicians; do not treat their details or seeded appointment slots as real-world availability.

## Data reset

Reset deletes all locally stored accounts, appointments, availability, specialisations, and medical records. It requires an exact confirmation phrase and is disabled in production. Back up `backend\data` first if its contents matter:

```powershell
Set-Location "C:\Rithesh\Nishasri\Healthcare Appointment\backend"
npm run reset-data
```

## Tests and build

```powershell
# Backend API and JSON workflow tests
Set-Location "C:\Rithesh\Nishasri\Healthcare Appointment\backend"
npm test
npm run test:integration

# Frontend checks and production build
Set-Location "C:\Rithesh\Nishasri\Healthcare Appointment\frontend"
npm run lint
npm run build
```

`npm run test:integration` uses an isolated temporary JSON directory; it does not modify `backend\data`.

## Deployment configuration

The application can be built and run on separate frontend and backend hosts, but **JSON storage is not durable on an ephemeral hosting filesystem**. This is a local-learning/demo application, not a production clinical-record system. Do not store real patient data. Use a host-provided persistent disk mounted at `DATA_DIR` if you need JSON files to survive instance restarts; even then, this storage is not safe for multiple replicas or production clinical workloads.

### Backend service

Set the backend service root to `backend/`, install with `npm ci`, and use:

- Build command: none required.
- Start command: `npm start` (`node src/server.js`).

Configure these environment variables in the hosting provider's secret/configuration settings (not in source control):

| Variable | Required value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | Supplied by the hosting provider. The server binds to `0.0.0.0`. |
| `FRONTEND_ORIGIN` | The exact deployed frontend origin, for example `https://carepoint.example` (scheme and host only; no path or trailing slash). Production CORS allows only this origin. |
| `JWT_SECRET` | Private cryptographically random secret, at least 32 characters. Generate it securely and store it only in the provider's secret manager. Never expose it as a `VITE_*` variable. |
| `DATA_DIR` | Optional absolute path to a provider-mounted persistent directory, for example `/var/lib/carepoint/data`. Without it, files are stored under `backend/data/`. |
| `CLINIC_TIMEZONE` | Optional IANA timezone; defaults to `Asia/Kolkata`. |
| `JWT_EXPIRES_IN` | Optional token lifetime; defaults to `8h`. |

Generate a secret locally in PowerShell if needed, then enter its output directly into the provider's secret manager (do not paste it into README, source, or a committed `.env`):

```powershell
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

`FRONTEND_ORIGIN` must be set for production startup. `DATA_DIR`, when set, must be an absolute path. JSON files are initialized there if missing; the API does not migrate or copy files from another data directory.

### Frontend static site

Set the frontend service root to `frontend/`, install with `npm ci`, and use:

- Build command: `npm run build`.
- Output directory: `dist`.
- Build-time environment variable: `VITE_API_BASE_URL=https://your-api-host.example/api` (include the `/api` prefix).
- Optional build-time environment variable: `VITE_CLINIC_TIMEZONE=Asia/Kolkata`.

Vite embeds `VITE_*` values into the frontend build, so configure `VITE_API_BASE_URL` before building/rebuilding. It is public configuration: never place credentials or secrets in any `VITE_*` variable.

The frontend uses React Router `BrowserRouter`. Configure the static host to rewrite unknown page paths to `/index.html` with a `200` response (for example, `/*` to `/index.html`). Without this SPA fallback, opening or refreshing paths such as `/doctors/123` may return a host-level 404. Vite development and preview servers provide SPA fallback; production static hosts need their equivalent rewrite rule.

### JSON persistence and deployment limits

On an ephemeral filesystem, files can survive a process restart on the same instance but **must be treated as lost on instance replacement, rescheduling, or redeployment**. A restart/redeploy may also start with a fresh empty data directory. Attach persistent storage and set `DATA_DIR` to its absolute mount path to retain files; back up that directory independently. Persistent local JSON still does not provide multi-instance locking, database transactions, encryption at rest, audit controls, or production-grade clinical data protections. Do not scale the API to multiple instances sharing this JSON store.

The existing `npm run seed` and `npm run seed:directory` scripts are development-only and do not seed production deployments. Create an administrator only through a deliberate, secured operational process; do not enable demo account seeding in production.

## API overview

All APIs are under `/api`. Authenticated routes use a bearer JWT. Success responses use `{ "data": ... }`; errors use `{ "error": { "message": "..." } }`.

- Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`.
- Doctors: `GET /doctors`, `GET /doctors/specialisations`, `GET /doctors/:id`, `GET /doctors/:id/slots`, `POST /doctors/availability`, `GET /doctors/self/availability`, `DELETE /doctors/availability/:id`.
- Appointments: `POST /appointments`, `GET /appointments/my`, `GET /appointments/:id`, `PATCH /appointments/:id/status`, `PUT /appointments/:id/reschedule`.
- Records: `POST /records`, `GET /records/my`, `GET /records/:id`.
- Profile: `PATCH /profile/me`.
- Admin: dashboard, reports, users/status, doctors, specialisations, and appointments under `/admin`; see [docs/API.md](./docs/API.md) for methods and details.

## JSON storage and security limitations

JSON data files are created on demand and preserved across restarts. In development, startup adds missing fictional directory doctors and availability without replacing existing user data; see [docs/JSON-STORAGE.md](./docs/JSON-STORAGE.md). Writes are queued within one Node.js process and temporary-file renames are used for updates. Malformed JSON produces a clear server error; the application does not silently reset it. Appointment booking and rescheduling check the slot while executing in this write queue, preventing same-process duplicate bookings.

This queue is process-local only: JSON files do not provide database transactions, multi-process locks, crash-safe multi-file commits, encryption at rest, auditing, or production-grade concurrent access. Do not run multiple API instances against the same files. This software is an educational local demo, not a secure clinical system. For production, migrate to a secured transactional datastore and add operational, privacy, backup, and security controls.
