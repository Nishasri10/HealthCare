# Local JSON storage and data policy

This project does not use a database server. The Express API stores its data in JSON arrays under `backend/data/` by default: `users.json`, `doctors.json`, `specialisations.json`, `availability.json`, `appointments.json`, and `medical-records.json`. Set `DATA_DIR` to an absolute path to use a different directory. The legacy `DATA_DIRECTORY` variable is also accepted when `DATA_DIR` is unset. The API creates missing files as empty arrays at startup.

Each write is serialized through a process-local queue. The store writes temporary files and renames them into place; an in-process multi-file write failure restores files already replaced. Malformed JSON raises an explicit server error and is never silently reset. Keep backups before editing data manually. The default data directory is ignored by Git because it can contain credentials and medical information. A custom data directory must be kept outside source control and backed up appropriately.

## First start and demo data

1. Copy `backend/.env.example` to `backend/.env`.
2. Replace `JWT_SECRET` with a private random value of at least 32 characters and choose the clinic's IANA `CLINIC_TIMEZONE`.
3. Start the API. It initializes missing JSON data files. With `NODE_ENV=development`, startup also adds the 30 fictional directory specialities, 35 doctor profiles, and stored future slots. Seeding is idempotent, preserves existing accounts and profiles, and is disabled in production; these directory-only accounts do not share a usable demo password.
4. To add separate fictional demo sign-in accounts, set `ALLOW_DEMO_SEED=true` and a unique `SEED_DEMO_PASSWORD` (12-72 UTF-8 bytes) in the development environment, then run `npm run seed` from `backend`. This explicit seed refuses production mode, is safe to rerun, and never resets existing account passwords.
5. To seed only the directory, set `ALLOW_DEMO_SEED=true` and `NODE_ENV=development`, then run `npm run seed:directory` from `backend`; reruns preserve existing doctor profiles, user credentials, appointments, and records.
6. For a non-demo first administrator, run `npm run create-admin` from `backend`. The command is development-only, interactively confirms creation, and refuses if an administrator already exists.

## Consistency and limitations

Appointment booking, rescheduling, profile updates, and status changes run inside the serialized JSON write queue. This prevents same-process double booking and overlapping slot writes, but does not coordinate multiple Node processes, machines, or server replicas. Atomic renames and rollback cover ordinary in-process write failures, not sudden power loss across several files. JSON files have no database transactions, access controls, encryption-at-rest, audit guarantees, or safe concurrent multi-server access. Hosting filesystems may be ephemeral: data can disappear when an instance is replaced or redeployed. A provider-mounted persistent disk and an absolute `DATA_DIR` are needed to retain JSON files, but that does not make this a production-ready clinical record system.

This is a local learning/demo application. All bundled clinicians and their availability are fictional demo data, not actual licensed providers or real appointment availability. Never store real patient data or deploy it as a production health-record service. A production migration should use a properly secured database, transactions/locking, backups, access auditing, encryption, and a privacy/security review.
