# KSP Transport Management System

Enterprise Fleet, Freight Billing, Driver Expense & Settlement Logistics Platform.

---

## Architecture Overview

```
                          ┌─────────────────────────────┐
                          │   PostgreSQL 18 Database    │
                          │      (Port: 5433)           │
                          └──────────────▲──────────────┘
                                         │
                                         │ TCP Pool
                                         │
                          ┌──────────────┴──────────────┐
                          │   Node.js + Express.js API  │
                          │   TypeScript + JWT + RBAC   │
                          │      (Port: 5000)           │
                          └───────▲─────────────▲───────┘
                                  │             │
                    REST API (JSON)             REST API (JSON)
                                  │             │
        ┌─────────────────────────┴────┐   ┌────┴─────────────────────────┐
        │     React.js Admin Panel     │   │   React Native Mobile App    │
        │    Vite + TypeScript + SPA   │   │  Expo + TypeScript + Native  │
        │      (Port: 5173)            │   │  (Android / iOS / Web)       │
        └──────────────────────────────┘   └──────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Admin Panel** | React.js 18, TypeScript, Vite, Vanilla CSS Design System, Lucide Icons |
| **Mobile App** | React Native 0.76, Expo 52, TypeScript, React Navigation, Expo Print (PDF) |
| **Backend API** | Node.js, Express.js, TypeScript, pg (node-postgres), JWT, bcryptjs, Helmet, CORS |
| **Database** | PostgreSQL 18 (Relational schema with ACID transactions, foreign keys, indexes) |
| **Authentication** | Username + Password + bcrypt (rounds=12) + JWT tokens (Strictly NO OTP) |

---

## Directory Structure

```
/
├── admin/                  # React.js + TypeScript Admin Portal (Vite)
│   ├── src/
│   │   ├── components/     # Layout, DataTable, Modal, StatCard, StatusBadge
│   │   ├── context/        # AuthContext
│   │   ├── pages/          # 17 Modules (Dashboard, Masters, Trips, Payments, Settlements, Reports)
│   │   ├── services/       # Centralized Axios API services
│   │   └── types/          # Full domain interfaces
├── backend/                # Express.js + TypeScript REST API
│   ├── database/           # schema.sql, seed.sql, seed.ts
│   ├── src/
│   │   ├── config/         # PostgreSQL connection pool
│   │   ├── controllers/    # Auth, Masters, Trips, Payments, Expenses, Settlements, Reports, Logs
│   │   ├── middleware/     # Auth (JWT), RBAC, Centralized Error Handling
│   │   ├── routes/         # Modular Express routers
│   │   └── types/          # Domain models
├── mobile/                 # React Native + TypeScript Expo Application
│   ├── src/
│   │   ├── constants/      # KSP Design tokens & colors
│   │   ├── context/        # AsyncStorage AuthContext
│   │   ├── navigation/     # RootStack and BottomTab navigators
│   │   ├── screens/        # Splash, Login, Home, NewTrip, Payment, Expenses, Settlement, Ledger, History, Profile
│   │   ├── services/       # Centralized Mobile API services
│   │   └── utils/          # PDF generator (expo-print & expo-sharing)
├── database/               # PostgreSQL schema.sql and seed.sql
└── docs/                   # Complete architecture, database, API and analysis docs
```

---

## Getting Started

### 1. Database Setup (PostgreSQL)

```bash
# Apply schema and seed
$env:PGPASSWORD="qwerty"
psql -U postgres -p 5433 -h localhost -c "CREATE DATABASE ksp_transport;"
psql -U postgres -p 5433 -h localhost -d ksp_transport -f "./database/schema.sql"
```

### 2. Backend Startup

```bash
cd backend
npm install
npm run build
npm run db:seed    # Seeds admin user (admin / Admin@123) and sample masters
npm start          # Runs on http://localhost:5000
```

### 3. Admin Panel Startup

```bash
cd admin
npm install
npm run dev        # Runs on http://localhost:5173
```

### 4. Mobile App Startup

```bash
cd mobile
npm install
npm start          # Starts Expo Metro bundler
```

---

## Default Credentials

| Role | Username | Password | Access |
|---|---|---|---|
| **Admin** | `admin` | `Admin@123` | Admin Portal (`http://localhost:5173`) |
| **Transport User** | `driver1` | `User@123` | Mobile Application / Driver Portal |
