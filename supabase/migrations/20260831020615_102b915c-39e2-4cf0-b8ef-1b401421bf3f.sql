CREATE TABLE public.billing_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  plan_external_id text NOT NULL,
  price_external_id text NOT NULL,
  plan_name text NOT NULL,
  paddle_product_id text NOT NULL,
  paddle_price_id text NOT NULL,
  billing_interval text NOT NULL CHECK (billing_interval IN ('month','year')),
  unit_amount_cents integer NOT NULL,
  currency_code text NOT NULL DEFAULT 'USD',
  trial_days integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment, price_external_id)
);

GRANT SELECT ON public.billing_catalog TO anon;
GRANT SELECT ON public.billing_catalog TO authenticated;
GRANT ALL ON public.billing_catalog TO service_role;

ALTER TABLE public.billing_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalog is publicly readable"
  ON public.billing_catalog FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role manages catalog"
  ON public.billing_catalog FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_billing_catalog_updated_at
  BEFORE UPDATE ON public.billing_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();