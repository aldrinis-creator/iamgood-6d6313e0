
-- Jan Aushadhi Products table
CREATE TABLE public.jan_aushadhi_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_code text,
  generic_name text NOT NULL,
  unit_size text,
  mrp numeric NOT NULL DEFAULT 0,
  category text,
  salt_composition text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jan_aushadhi_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read jan_aushadhi_products"
  ON public.jan_aushadhi_products FOR SELECT TO authenticated USING (true);

-- Jan Aushadhi Stores table
CREATE TABLE public.jan_aushadhi_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  state text,
  district text,
  address text,
  pincode text,
  phone text,
  lat double precision,
  lon double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jan_aushadhi_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read jan_aushadhi_stores"
  ON public.jan_aushadhi_stores FOR SELECT TO authenticated USING (true);

-- Index for product search
CREATE INDEX idx_jan_aushadhi_products_generic_name ON public.jan_aushadhi_products USING gin (to_tsvector('english', generic_name));
CREATE INDEX idx_jan_aushadhi_products_salt ON public.jan_aushadhi_products USING gin (to_tsvector('english', salt_composition));

-- Index for store proximity search
CREATE INDEX idx_jan_aushadhi_stores_location ON public.jan_aushadhi_stores (lat, lon);
CREATE INDEX idx_jan_aushadhi_stores_pincode ON public.jan_aushadhi_stores (pincode);
