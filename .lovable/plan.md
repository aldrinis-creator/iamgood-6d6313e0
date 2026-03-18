

# Build Privacy Request Tracking System

## Overview
Create a `privacy_requests` table and wire up the Settings Privacy tab to persist and display real request history.

## Steps

### 1. Database Migration
Create `privacy_requests` table:
- `id` (UUID, PK), `user_id` (UUID, references auth.users, NOT NULL), `request_type` (text — e.g. "data_access", "correction", "deletion", "export", "objection"), `legal_basis` (text), `status` (text, default 'pending'), `created_at` (timestamptz, default now()), `resolved_at` (timestamptz, nullable)
- RLS: users can SELECT and INSERT their own rows (by `user_id = auth.uid()`)

### 2. Update Settings.tsx Privacy Tab
- Import `useQuery` and `useMutation` from React Query
- On "Request" button click: insert a row into `privacy_requests` with the appropriate `request_type` and `legal_basis`
- Disable the button briefly after submission, show toast confirmation
- Replace the hardcoded "Request History" section with a live query that fetches the user's `privacy_requests` ordered by `created_at DESC`
- Display each request with type, date, and status badge (Pending / Completed)

### Technical Details
- Migration SQL adds table + RLS policies
- React Query handles caching and refetch after mutation
- No new files needed — changes confined to migration + `Settings.tsx`

