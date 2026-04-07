

## Add Delete Confirmation Dialog to Medication List

### Change — `src/components/medications/MedicationList.tsx`

1. Import `AlertDialog` components from `@/components/ui/alert-dialog`
2. Add `deleteTarget` state (`Medication | null`) to track which medication is queued for deletion
3. Change the trash button's `onClick` from calling `handleDelete(med.id)` directly to `setDeleteTarget(med)`
4. Add an `AlertDialog` at the bottom of the component that shows the medication name and asks for confirmation before executing the delete

Same pattern already used in Appointments and Medical Documents.

