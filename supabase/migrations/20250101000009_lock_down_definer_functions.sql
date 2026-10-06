-- SECURITY DEFINER functions run with owner rights, so clients may only call the ones they need.
-- notify_user and dispatch_push in particular would let anyone message any account.
-- Trigger functions keep working because they execute as their owner.
DO $$
DECLARE
  fn record;
  client_callable text[] := ARRAY[
    'current_role', 'has_permission', 'has_any_permission', 'my_permissions',
    'require_permission', 'issue_invoice_from_quotation', 'search_catalog'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.sig);
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', fn.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
      IF fn.proname = ANY (client_callable) THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
      END IF;
      IF fn.proname IN ('current_role', 'has_permission', 'has_any_permission') THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', fn.sig);
      END IF;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;
