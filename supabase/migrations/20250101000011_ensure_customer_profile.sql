-- Self-service signup only writes a profile (handle_new_user). The mobile app
-- previously inserted into customers from the client, which fails when email
-- confirmation means there is no session yet, and the error was ignored.
-- Customers call this after they are authenticated.

CREATE OR REPLACE FUNCTION public.ensure_my_customer()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF public.current_role() IS DISTINCT FROM 'customer' THEN
    RAISE EXCEPTION 'Only customer accounts have a customer record' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO cid FROM public.customers WHERE profile_id = auth.uid();
  IF cid IS NOT NULL THEN
    RETURN cid;
  END IF;

  INSERT INTO public.customers (profile_id, created_by)
  VALUES (auth.uid(), auth.uid())
  ON CONFLICT (profile_id) DO NOTHING
  RETURNING id INTO cid;

  IF cid IS NULL THEN
    SELECT id INTO cid FROM public.customers WHERE profile_id = auth.uid();
  END IF;
  RETURN cid;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_customer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_customer() TO authenticated;
