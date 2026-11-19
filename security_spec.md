# Security & Firestore Rules Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Safety Net**: Every unmapped path is denied (`allow read, write: if false;`).
2. **Email Verification & Identity**: All authenticated operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Anti-Privilege-Escalation**: Non-admin users creating their `/users/{userId}` document cannot self-assign `role: "Super Administrator"`. Only the bootstrapped Super Admin (`jaahwix@gmail.com` with verified email) or an existing Super Admin can promote users or change roles.
4. **Multi-Hospital PII Isolation**: Identifiable clinical records (`patients`, `encounters`, `screenings`, `followUpTasks`, `referrals`, `labOrders`, `prescriptions`, `bloodDonors`, `insuranceClaims`, `telemedicineAppointments`) carry `facilityId`, `createdByUid`, and bounded `authorizedUids` (max 25). Queries (`allow list`) strictly enforce `isBootstrappedAdmin() || resource.data.createdByUid == request.auth.uid || request.auth.uid in resource.data.authorizedUids` with zero `get()` calls in `allow list`.
5. **Immutable Audit Trail**: `auditLogs` can be appended by verified authenticated actors for their own `actorUid == request.auth.uid`, and cannot be updated or deleted by any user.
6. **Temporal Integrity & String/Array Bounds**: All timestamps (`createdAt`, `updatedAt`) on server-stamped operations or validated ISO strings are strictly bounded in size, all IDs pass `isValidId()`, and every string and array has explicit `.size()` limits.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `GET /patients/pat_001` without `request.auth`.
2. **Unverified Email Spoof**: `GET /facilities/fac_001` with `email: "jaahwix@gmail.com"` and `email_verified: false`.
3. **Self-Assigned Super Admin**: `CREATE /users/attacker_uid` with `{ role: "Super Administrator", uid: "attacker_uid" }` by non-admin.
4. **Shadow Field Injection**: `CREATE /patients/pat_999` including unexpected ghost key `{ isVerifiedOverride: true }`.
5. **Cross-User Identity Spoofing**: `CREATE /patients/pat_999` with `createdByUid: "other_uid"` when `request.auth.uid == "attacker_uid"`.
6. **ID Poisoning (1.5KB ID)**: `CREATE /facilities/<1500_char_id>` violating `isValidId()`.
7. **Blanket List Scrape**: `LIST /patients` without `where('authorizedUids', 'array-contains', uid)` by a non-admin user.
8. **Cross-Facility Read**: Facility B user calling `GET /patients/facility_A_patient` when not in `authorizedUids`.
9. **Audit Log Tampering**: `UPDATE /auditLogs/log_001` or `DELETE /auditLogs/log_001` by any user.
10. **Terminal Alert Overwrite**: Non-admin attempting to mutate `triggerRule` or `createdByUid` when updating `/publicHealthAlerts/alert_001`.
11. **Oversized Payload Denial-of-Wallet**: `CREATE /encounters/enc_001` with a 50KB `nursingNotes` string.
12. **Unbounded Array Injection**: `CREATE /facilities/fac_001` with 100 items in `departments` array (exceeds max 25).
