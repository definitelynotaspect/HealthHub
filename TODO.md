# Manage Students Page — Patient Update Form Fix

## Task
Make the patient update form on the Manage Students page complete and consistent with the Concern Page and Visit History pages. Support all staff positions (Admin, Instructor, Guard, Maintenance).

## Plan
- [x] 1. Add **Staff** to `positionOptions` array.
- [x] 2. Update `isStaffPosition` helper to include `'Staff'` so all staff positions show the Employee ID field in both the register form and the update (detail) form.
- [x] 3. Removed **Dean** from all pages (`ManageStudentsPage.jsx`, `ConcernPage.jsx`, `VisitHistoryPage.jsx`) per user request.
- [x] 4. Removed **Staff** from all pages (`ManageStudentsPage.jsx`, `ConcernPage.jsx`, `VisitHistoryPage.jsx`) per user request.
- [x] 5. Verify production build passes (`npm run build`).

## Follow-up
- Reload the app and test the update modal for staff patients (Admin, Instructor, Guard, Maintenance).
