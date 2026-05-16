# Gym Management System - Blueprint

## 1. Project Overview
A multi-tenant Software-as-a-Service (SaaS) application for gym management, allowing gym owners to manage multiple branches.

## 2. Core Objectives
- Complete data isolation between different gyms and branches using a `gymId` tenant architecture.
- Full member management, attendance tracking, and subscription handling.
- Integrated billing and expense tracking.
- Staff and equipment management.
- WhatsApp automation integration for notifications (using Evolution API).

## 3. Tech Stack
- **Frontend**: React (Vite)
- **Backend**: Node.js, Express
- **Database**: MongoDB with Mongoose
- **Third-Party**: Evolution API for WhatsApp, SweetAlert/Toastify for UI notifications.

## 4. Architecture Pattern
Multi-tenant architecture where every collection is scoped by `gymId`. A Mongoose plugin (`tenantPlugin`) ensures data isolation.

## 5. Core Modules
- **Authentication**: User registration, login, JWT issuance scoped to `gymId`.
- **Members & Subscriptions**: Handling fitness memberships and personalized plans.
- **Operations & Management**: Equipment, Expenses, Bills, Staff, Attendance.
- **WhatsApp Integration**: Connecting to Evolution API.

## 6. Data Structure Plan
- `UserSchema`: Stores credentials and owned/associated `gymId`s.
- `GymSettings`: Stores branch-specific settings such as name, logo, address, and WhatsApp configuration.
- Other module schemas reference the current `gymId`.

## 7. Security Plan
- Strict validation of `gymId` via `verifyUser` middleware.
- Using `tenantPlugin` to auto-inject `gymId` into Mongoose queries.

## 8. Scalability Plan
- Containerized deployment readiness (Docker).
- Stateless application backend to allow horizontal scaling.
- Unique WhatsApp instances for each tenant in Evolution API.

## 9. Major Implementation Phases
- Phase 1: Core multi-tenant architecture setup.
- Phase 2: Base management features (Members, Staff, Equipment, Billing).
- Phase 3: Communication & Marketing (WhatsApp Automation transition to per-tenant instances).
- Phase 4: Refinement and bug-fixing.

## 10. Risk Analysis
- **Data Leakage**: Risk of one gym viewing another gym's data. Mitigated by `tenantPlugin` and middleware checks.
- **WhatsApp API Limits**: Managing multiple Evolution API instances. Requires scalable hosting for Evolution API.

## 11. Non-Goals
- Native mobile app development (handled independently or deferred).
- Heavy marketing automation beyond WhatsApp.

## 12. Definition of Done
- Features are functional, isolated by `gymId`.
- No cross-tenant data leakage.
- UI gracefully handles loading states and errors.
