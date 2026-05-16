# Changelog (Start to End)

## 2026-03-24: Initialization & WhatsApp Per-Tenant Instance Support
- Created project blueprint (`goals-and-structure.md`) and changelog (`start-to-end.md`).
- Starting feature implementation to support one Evolution API WhatsApp instance per `gymId` instead of a single global `Dev` instance.

## 2026-05-06 to 2026-05-15: PDF Standardization & Native Automation Engine
- **PDF Standardization**: Replaced hardcoded gym details in PDFs (Bills, Plans, Reports) with dynamic data fetched from the `GymSettings` model. Created `pdfUtils.js` to manage centralized header/footer generation.
- **Native Automation Engine**: Removed all `n8n` dependencies and proxies. Built a native React dashboard (`AutomationEngine.jsx`) to manage 9 WhatsApp automations with granular ON/OFF toggles.
- **Backend Toggle Enforcement**: Added security gates in `attendance.js`, `bill.js`, `subscription.js`, `automationService.js`, and `whatsappController.js` to ensure WhatsApp messages are only sent if the corresponding toggle is enabled in the database.
- **Build Fixes**: Fixed asynchronous rendering bugs in `Newsub.jsx` and `PersonalizedPlan.jsx`, and resolved a context API URL routing issue.

## 2026-05-15: WhatsApp Registration Trigger & PDF Utils Fix
- **New Member Welcome**: Created a new `sendNewMemberWelcomeMessage` function to send WhatsApp messages immediately upon a member's registration (in `member.js`). Previously, the "New Registration" toggle was erroneously wired only to new subscriptions.
- **PDF Centralization Completion**: Executed the previously incomplete task of centralizing PDF generation into `pdfUtils.js`. Removed hardcoded generation blocks from `bill.js` and imported the dynamic utility.
