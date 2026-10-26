# CEF Portal — API & Route Audit Report

**Date:** October 25, 2026  
**Backend Framework:** Flask 3.1.3 (Blueprints with `/api/v1` prefix)  
**Authentication:** JWT Bearer (Access Token 60m, Refresh Token 7d, RS256/HS256)  
**Database:** PostgreSQL 16 via SQLAlchemy 2.0.51 ORM  

---

## 1. Complete API Route Inventory

| Blueprint | Method | Endpoint Route | Frontend Caller | Database / Storage Dependencies | Status / Test Result |
|---|---|---|---|---|---|
| **Auth** | `POST` | `/api/v1/auth/register` | `authService.register` in `useAuth.ts` | `users`, `audit_logs` | PASSED (HTTP 201) |
| **Auth** | `POST` | `/api/v1/auth/login` | `authService.login` in `useAuth.ts` | `users`, `audit_logs` | PASSED (HTTP 200, JWT returned) |
| **Auth** | `POST` | `/api/v1/auth/refresh` | Axios interceptor in `apiClient.ts` | `users` (token verification) | PASSED (HTTP 200, new token) |
| **Auth** | `POST` | `/api/v1/auth/logout` | `authService.logout` in `useAuth.ts` | `users`, `audit_logs` | PASSED (HTTP 200) |
| **Auth** | `GET` | `/api/v1/auth/me` | `authService.getMe` in `useAuth.ts` | `users` | PASSED (HTTP 200, current user) |
| **Candidates** | `GET` | `/api/v1/candidates/my-applications` | `candidateService.getMyApplications` | `candidate_applications` | PASSED (HTTP 200, indexed query) |
| **Candidates** | `POST` | `/api/v1/candidates/applications` | `candidateService.createApplication` | `candidate_applications`, `candidate_application_districts`, `candidate_application_blocks`, `candidate_verification_items`, `audit_logs` | PASSED (HTTP 201, atomic commit) |
| **Candidates** | `GET` | `/api/v1/candidates/applications/<id>` | `candidateService.getApplicationById` | `candidate_applications`, `districts`, `blocks`, `documents` | PASSED (HTTP 200) |
| **Candidates** | `PUT` | `/api/v1/candidates/applications/<id>` | `candidateService.updateApplication` | `candidate_applications`, `audit_logs` | PASSED (HTTP 200, status validation) |
| **Candidates** | `GET` | `/api/v1/candidates/staged-documents` | `candidateService.getStagedDocuments` | `candidate_documents` (where `application_id IS NULL`) | PASSED (HTTP 200, cached) |
| **Candidates** | `POST` | `/api/v1/candidates/documents/upload` | `candidateService.uploadDocument` | `storage/documents/<user_id>/`, `candidate_documents` | PASSED (HTTP 201, secure UUID naming) |
| **Candidates** | `GET` | `/api/v1/candidates/documents/<id>/download` | Document preview modal & download buttons | Filesystem read + `send_file` with ETag / 304 | PASSED (HTTP 200 / 304 Not Modified) |
| **Locations** | `GET` | `/api/v1/locations/states` | `locationService.getStates` | `location_states` | PASSED (HTTP 200, cached) |
| **Locations** | `POST` | `/api/v1/locations/states` | `locationService.createState` (Admin) | `location_states`, `audit_logs` | PASSED (HTTP 201) |
| **Locations** | `PUT` | `/api/v1/locations/states/<id>` | `locationService.updateState` (Admin) | `location_states`, `audit_logs` | PASSED (HTTP 200) |
| **Locations** | `GET` | `/api/v1/locations/districts` | `locationService.getDistricts` | `location_districts` + `selectinload(blocks)` | PASSED (HTTP 200, N+1 fixed) |
| **Locations** | `POST` | `/api/v1/locations/districts` | `locationService.createDistrict` (Admin) | `location_districts`, `audit_logs` | PASSED (HTTP 201) |
| **Locations** | `PUT` | `/api/v1/locations/districts/<id>` | `locationService.updateDistrict` (Admin) | `location_districts`, `audit_logs` | PASSED (HTTP 200) |
| **Locations** | `GET` | `/api/v1/locations/blocks` | `locationService.getBlocks` | `location_blocks` + `joinedload(district)` | PASSED (HTTP 200, N+1 fixed) |
| **Locations** | `POST` | `/api/v1/locations/blocks` | `locationService.createBlock` (Admin) | `location_blocks`, `audit_logs` | PASSED (HTTP 201) |
| **Locations** | `PUT` | `/api/v1/locations/blocks/<id>` | `locationService.updateBlock` (Admin) | `location_blocks`, `audit_logs` | PASSED (HTTP 200) |
| **Locations** | `POST` | `/api/v1/locations/import` | `locationService.importExcel` (Admin) | Bulk parse + transaction insert | PASSED (HTTP 200, bulk insert) |
| **Roles** | `GET` | `/api/v1/roles/` | `candidateService.getRoles` | `roles` | PASSED (HTTP 200) |
| **Roles** | `POST` | `/api/v1/roles/` | `candidateService.createRole` (Admin) | `roles`, `audit_logs` | PASSED (HTTP 201) |
| **Roles** | `PUT` | `/api/v1/roles/<id>` | `candidateService.updateRole` (Admin) | `roles`, `audit_logs` | PASSED (HTTP 200) |
| **Roles** | `DELETE` | `/api/v1/roles/<id>` | `candidateService.deleteRole` (Admin) | `roles`, `audit_logs` | PASSED (HTTP 200) |
| **Verification** | `GET` | `/api/v1/verification/applications` | `verificationService.getApplications` | `candidate_applications`, `users` | PASSED (HTTP 200, Verifier/Admin) |
| **Verification** | `GET` | `/api/v1/verification/applications/<id>` | `verificationService.getApplicationDetail` | `candidate_applications` (masked/unmasked) | PASSED (HTTP 200, Verifier/Admin) |
| **Verification** | `GET` | `/api/v1/verification/applications/<id>/checklist`| `verificationService.getChecklist` | `candidate_verification_items` | PASSED (HTTP 200, Verifier/Admin) |
| **Verification** | `POST` | `/api/v1/verification/items/<id>/verify` | `verificationService.markItemDone` | `candidate_verification_items`, `audit_logs` | PASSED (HTTP 200, Verifier/Admin) |
| **Verification** | `POST` | `/api/v1/verification/items/<id>/reset` | `verificationService.resetItemStatus` | `candidate_verification_items`, `audit_logs` | PASSED (HTTP 200, Verifier/Admin) |
| **Users / Admin** | `GET` | `/api/v1/admin/users` | `profileService.getUsersList` | `users` | PASSED (HTTP 200, Admin only) |
| **Users / Admin** | `POST` | `/api/v1/admin/users/<id>/approve` | `profileService.approveUser` | `users`, `audit_logs` | PASSED (HTTP 200, Admin only) |
| **Users / Admin** | `POST` | `/api/v1/admin/users/<id>/disable` | `profileService.disableUser` | `users`, `audit_logs` | PASSED (HTTP 200, Admin only) |
| **Users / Admin** | `POST` | `/api/v1/admin/users/create` | `profileService.createUser` | `users`, `audit_logs` | PASSED (HTTP 201, Admin only) |
| **Users / Admin** | `POST` | `/api/v1/admin/change-password` | `profileService.changePassword` | `users`, `audit_logs` | PASSED (HTTP 200) |

---

## 2. Verified Issues & Resolutions

### 1. N+1 Queries in Location APIs
- **Endpoint:** `GET /api/v1/locations/districts?state_id=...` and `GET /api/v1/locations/blocks`
- **Issue:** Marshmallow schemas invoked `obj.blocks` and `obj.district.name`, issuing a distinct SQL query for each record in the result set.
- **Resolution:** Added SQLAlchemy `selectinload(LocationDistrict.blocks)` and `joinedload(LocationBlock.district)`. Database queries dropped from 42 queries to 2 queries for districts, and from 1+N queries to 1 query for blocks.

### 2. Missing HTTP Caching for Document Downloads & Previews
- **Endpoint:** `GET /api/v1/candidates/documents/<id>/download`
- **Issue:** Flask's `send_file()` returned unconditional `200 OK` on every request with `Cache-Control: no-cache`. Reviewing documents in the verification workspace re-downloaded full files repeatedly.
- **Resolution:** Enabled `conditional=True`, `max_age=3600`, and `Cache-Control: private, max-age=3600`. The browser now submits `If-None-Match` and receives `304 Not Modified`, reducing bandwidth to 0 bytes for repeat views.

### 3. Base URL Hardcoding in Refresh Token Call
- **Endpoint:** Axios interceptor refresh call in `frontend/src/api/apiClient.ts`
- **Issue:** `axios.post('/auth/refresh')` bypassed configured base URL prefix `/api/v1`.
- **Resolution:** Updated to `${apiClient.defaults.baseURL || '/api/v1'}/auth/refresh`.

### 4. Duplicate Verification Refetches
- **Endpoint:** `POST /api/v1/verification/items/<id>/verify` & `/reset`
- **Issue:** Frontend workspace component invoked manual `Promise.all([refetchApp(), refetchChecklist()])` immediately after triggering the mutation, competing with TanStack Query's automatic cache invalidation.
- **Resolution:** Removed manual refetches; configured `staleTime: 60000` to prevent unnecessary network refetches on fast tab transitions.

---

## 3. Security, Authorization & Audit Integrity
- **Authentication & RBAC:** All sensitive endpoints enforce `@jwt_required()` and `@role_required(['ADMIN', 'VERIFIER'])`.
- **Document Access Control:** Non-admin candidates can only access documents belonging to their own user ID (`user_id == current_user.id`).
- **Data Protection:** Aadhaar and PAN numbers are masked by default (`********1234`) on verification views unless explicitly requested with administrative privilege.
- **Audit Logging:** Every critical state transition (application submission, verification item change, user creation/approval) persists an immutable record in `audit_logs`.
