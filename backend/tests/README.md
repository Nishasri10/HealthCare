# Backend test coverage

Run `npm test` from `backend`. The tests cover API health, security headers, structured not-found errors, unauthenticated access rejection, and clinic-local date conversion.

Appointment concurrency, role-specific database ownership, and medical-record workflows require a configured, isolated MySQL test database. Do not point workflow tests at production data. This repository does not automatically create, truncate, or reset a test database.
