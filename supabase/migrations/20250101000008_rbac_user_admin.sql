-- Support for the manage-users edge function.

-- Rows that would be cascade-deleted with this profile. Removing an account that still owns
-- service requests, quotations, or messages would silently delete them, so the edge function
-- refuses and asks for a suspension instead.
CREATE OR REPLACE FUNCTION public.profile_linked_records(p_profile uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fk record;
  total integer := 0;
  n integer;
BEGIN
  FOR fk IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.profiles'::regclass
      AND c.confdeltype = 'c'
      AND array_length(c.conkey, 1) = 1
      AND c.conrelid <> 'public.notifications'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', fk.tbl, fk.col) INTO n USING p_profile;
    total := total + n;
  END LOOP;
  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.profile_linked_records(uuid) FROM PUBLIC;
DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.profile_linked_records(uuid) FROM anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.profile_linked_records(uuid) TO service_role;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
