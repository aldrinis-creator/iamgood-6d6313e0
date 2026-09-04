# Unstick Namta Gupta's guardian nomination

## Current state (verified)

- Guardian row `e63c7128-9074-4227-a868-98b8d6ed6c41` (Namta Gupta, phone `+918655975425`, ward `36251580-f6a5-4a5a-a724-3dcd1158b1a5`) is `status = accepted` but `guardian_user_id` is empty and `install_confirmed_at` is empty — the same stuck state Aldrin was in.
- She does already have an account: user `331314eb-5961-48aa-aec2-099710f3e681`, profile name "Namta Gupta", profile phone `+918655975425`, role `guardian`.

So the only thing missing is the link between her account and the guardian row.

## Fix

Run a one-off repair that does exactly what the already-fixed `link_guardian_user_id()` does, for her account:

- Set `guardian_user_id = 331314eb-5961-48aa-aec2-099710f3e681` on guardian row `e63c7128-9074-4227-a868-98b8d6ed6c41` (matched by normalised phone, so no other rows are touched by accident).
- Set `install_confirmed_at` to now on that row.
- Leave `status` as `accepted`, and leave her `profiles.role` as `guardian` — no role or schema changes.

## Verification

Re-read the row afterwards and confirm it shows `status = accepted` with her user id linked, then confirm no other rows changed. With the link present, `GuardianRoute` admits her to `/guardian` on next sign-in.

## Not in scope

The three `expired` rows (Arnaldo Cardozo, Mary D'Mello, Lira Alphonso) stay untouched — those need fresh invites, not a link repair.
