-- Orange Lab catalogue (tests + packages)
-- Apply this migration before importing orange_lab_catalog_import.csv.
-- partner_net_rate remains in this table but is not selectable by browser roles.

CREATE TABLE IF NOT EXISTS public.orange_lab_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_item_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('test', 'package')),
  name text NOT NULL,
  category_code text,
  mrp numeric(10, 2),
  partner_net_rate numeric(10, 2),
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orange_lab_catalog_provider_item_unique
    UNIQUE (kind, provider_item_id)
);

-- Revoke table-level SELECT, then grant only customer-safe columns.
-- Do not add a table-level SELECT grant for anon/authenticated later.
REVOKE SELECT ON TABLE public.orange_lab_catalog FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id, provider_item_id, kind, name, category_code, mrp,
  is_featured, is_active, sort_order, created_at, updated_at
) ON TABLE public.orange_lab_catalog TO authenticated;

-- Service-role Edge Functions retain full access.
GRANT ALL PRIVILEGES ON TABLE public.orange_lab_catalog TO service_role;

ALTER TABLE public.orange_lab_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active Orange Lab catalogue"
  ON public.orange_lab_catalog;

CREATE POLICY "Authenticated users can view active Orange Lab catalogue"
  ON public.orange_lab_catalog
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_orange_lab_catalog_featured_order
  ON public.orange_lab_catalog (is_featured DESC, sort_order ASC, name ASC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_orange_lab_catalog_kind_active_order
  ON public.orange_lab_catalog (kind, sort_order ASC, name ASC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_orange_lab_catalog_name
  ON public.orange_lab_catalog (name);

COMMENT ON TABLE public.orange_lab_catalog IS
  'Orange Health catalogue of individual tests and packages. Browser users cannot select partner_net_rate.';
COMMENT ON COLUMN public.orange_lab_catalog.partner_net_rate IS
  'Confidential partner commercial rate; do not expose through browser queries or customer UI.';