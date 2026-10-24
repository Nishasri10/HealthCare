# REST API

All successful responses use `{ "data": ... }`; errors use `{ "error": { "message": "..." } }`. Protected routes use a bearer JWT in the `Authorization` header. IDs are numeric. Appointment and availability timestamps are ISO 8601 UTC; date filtering/display follows `CLINIC_TIMEZONE`.

## Authentication

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public, rate limited | Register a patient (`name`, `email`, `password`) |
| POST | `/api/auth/login` | Public, rate limited | Sign in and return a JWT plus safe user profile |
| GET | `/api/auth/me` | Signed in | Current user and doctor profile, if applicable |

Public registration never accepts a role. Admins provision doctor accounts. Create the initial admin using `npm run create-admin` from `backend`, or use the explicitly enabled development seed.

## Doctors and availability

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/doctors?search=&specialisation=&availableOn=&mode=&availability=&minFee=&maxFee=&sort=&page=&limit=` | Public | Search active doctors; combine speciality, clinic-local date, consultation mode, availability, and fee filters; sort by name, experience, or fee |
| GET | `/api/doctors/specialisations` | Public | List specialisations |
| GET | `/api/doctors/:id` | Public | Doctor profile |
| GET | `/api/doctors/:id/slots` | Public | Up to 100 future, unbooked slots |
| GET | `/api/doctors/self/availability` | Doctor | Own future slots and booking indicators |
| POST | `/api/doctors/availability` | Doctor | Add future slot; input timestamps need an explicit timezone and match consultation duration |
| DELETE | `/api/doctors/availability/:id` | Doctor, owner only | Remove future slot without appointment history |

Doctor list/profile responses include the doctor profile ID, qualification, years of experience, consultation fee and mode, supported languages, a fictional demo biography, and whether an actual future slot exists in JSON storage. Demo avatars use initials when no profile image is stored. The development directory contains fictional providers only; listing availability reflects stored demo slots, not real-world clinic schedules.

## Appointments

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/appointments` | Patient | Request a slot (`doctorId`, `slotId`, `reason`) |
| GET | `/api/appointments/my` | Patient or doctor | List caller's appointments |
| GET | `/api/appointments/:id` | Patient/doctor owner; admin | Authorized appointment detail; admin does not receive visit reason |
| PATCH | `/api/appointments/:id/status` | Patient or assigned doctor | Apply an allowed status transition |
| PUT | `/api/appointments/:id/reschedule` | Patient owner | Move to a future slot with the same doctor; status returns to `booked` |
| GET | `/api/admin/appointments?status=&page=&limit=` | Admin | Filter and paginate platform appointments without visit reasons |

Transitions are `booked -> confirmed|declined|cancelled` and `confirmed -> completed|cancelled`. Patients can cancel only future booked/confirmed appointments. Doctors can confirm future requests, decline assigned requests, and complete confirmed appointments only after the scheduled slot ends. Booking and rescheduling check slot and overlap conditions inside the process-local serialized JSON write queue; a conflict returns `409`.

## Medical records

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/records` | Treating doctor | Create one record for own completed appointment (`appointmentId`, `diagnosis`, optional `prescription`, `notes`, `followUp`) |
| GET | `/api/records/my` | Patient or doctor | List records the caller may access |
| GET | `/api/records/:id` | Patient owner or treating doctor | Read one authorized record |

Records are immutable through this API. Administrators cannot access record contents.

## Profile and administration

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| PATCH | `/api/profile/me` | Signed in | Update own name/email; doctors may also update professional fields |
| GET | `/api/admin/dashboard` | Admin | JSON-backed counts, trends, speciality counts |
| GET | `/api/admin/users?search=&role=&page=&limit=` | Admin | Paginated safe user list |
| PATCH | `/api/admin/users/:id/status` | Admin | Change patient/doctor account status |
| GET | `/api/admin/doctors?page=&limit=` | Admin | Paginated profiles, including inactive accounts |
| POST | `/api/admin/doctors` | Admin | Create doctor account and profile |
| PATCH | `/api/admin/doctors/:id` | Admin | Update doctor profile |
| GET | `/api/admin/specialisations` | Admin | List specialisations |
| POST | `/api/admin/specialisations` | Admin | Add speciality |
| PUT | `/api/admin/specialisations/:id` | Admin | Update speciality |
| DELETE | `/api/admin/specialisations/:id` | Admin | Delete unused speciality |
| GET | `/api/admin/reports` | Admin | Appointment totals by status and daily trend |

Invalid input returns `400`; missing/invalid authentication `401`; forbidden actions `403`; missing or unauthorized resources `404`; conflicts `409`. JSON storage, persistence, and multi-process limitations are documented in [JSON-STORAGE.md](./JSON-STORAGE.md).
