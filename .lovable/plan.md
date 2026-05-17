I found the code already renders a per-message Delete button beside Requeue, and a Purge all button in each DLQ card header. If you only see Requeue, the most likely issue is the action area is cramped/overflowing at your current viewport or the deployed preview is showing an older layout.

Plan:
1. Make each DLQ message action area stack responsively so Requeue and Delete are always visible, not squeezed off-screen.
2. Change Delete to a clearer destructive button using the existing design system variant, keeping the required confirmation dialog.
3. Keep the existing backend delete behavior (`delete_email`) and existing Purge all behavior unchanged.
4. Add a short inline label near DLQ actions so it is obvious that individual messages can be requeued or permanently deleted.
5. Verify the DLQ row layout in the preview after the change.