# KSP Transport Management System — REST API Specification

**Base URL:** `http://localhost:5000/api`

All authenticated endpoints require an HTTP header:
`Authorization: Bearer <JWT_TOKEN>`

---

## 1. Authentication Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Login with `username` + `password` |
| `POST` | `/auth/logout` | Authenticated | Invalidate session / log audit event |
| `GET` | `/auth/me` | Authenticated | Retrieve current user profile |
| `POST` | `/auth/change-password` | Authenticated | Change user account password |

---

## 2. Dashboard Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/dashboard/admin` | Admin | Full operational, financial & master KPI stats |
| `GET` | `/dashboard/mobile` | Transport User | Today's trips, outstanding balance & recent list |

---

## 3. User Management (Admin Only)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/users` | Paginated user list with role & status filters |
| `POST` | `/users` | Create user with hashed credentials & role |
| `GET` | `/users/:id` | Get user details |
| `PUT` | `/users/:id` | Update user metadata |
| `PATCH` | `/users/:id/status` | Activate or deactivate account |
| `POST` | `/users/:id/reset-password`| Reset user password |

---

## 4. Master Management Endpoints

| Resource | Endpoints |
|---|---|
| **Drivers** | `GET /drivers`, `POST /drivers`, `PUT /drivers/:id`, `PATCH /drivers/:id/status` |
| **Vehicles** | `GET /vehicles`, `POST /vehicles`, `PUT /vehicles/:id`, `PATCH /vehicles/:id/status` |
| **Parties** | `GET /parties`, `POST /parties`, `PUT /parties/:id`, `PATCH /parties/:id/status` |
| **Units** | `GET /units`, `POST /units`, `PUT /units/:id` |
| **Routes** | `GET /routes`, `POST /routes`, `PUT /routes/:id` |
| **Freight Rates** | `GET /freight-rates`, `POST /freight-rates`, `PUT /freight-rates/:id` |
| **Expense Rates** | `GET /expense-rates`, `POST /expense-rates`, `PUT /expense-rates/:id` |

---

## 5. Operations & Business Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/trips` | Paginated trips list with multi-criteria filters |
| `POST` | `/trips` | Create trip with backend freight calculation |
| `GET` | `/trips/:id` | Trip detail breakdown |
| `POST` | `/payments/trip/:trip_id` | Record payment & compute remaining balance |
| `GET` | `/payments/trip/:trip_id` | View payment transaction history |
| `GET` | `/payments/ledger/:party_id` | Party ledger with full statement breakdown |
| `GET` | `/expenses/trip/:trip_id` | List driver expenses, total & advance deduction |
| `POST` | `/expenses/trip/:trip_id` | Add trip expense line item |
| `DELETE` | `/expenses/:id` | Remove expense entry |
| `POST` | `/settlements/trip/:trip_id/generate` | Generate settlement voucher |
| `GET` | `/settlements/trip/:trip_id` | Get settlement slip details |
| `PATCH` | `/settlements/:id/verify` | Mark settlement as verified (Admin) |

---

## 6. Reports & Compliance

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/reports/trips` | Trip dispatch report with summary aggregates |
| `GET` | `/reports/payments` | Collection payments report |
| `GET` | `/reports/settlements` | Driver settlement voucher report |
| `GET` | `/audit-logs` | Compliance audit log trail with JSON detail |
