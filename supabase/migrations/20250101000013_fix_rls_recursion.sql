-- The assigned-job policies selected service_requests and customers directly.
-- Each table's other policies select the other table, so Postgres reported
-- infinite recursion and blocked sign-in and dashboard_metrics.

CREATE OR REPLACE FUNCTION public.assigned_job_customer_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sr.customer_id
  FROM public.service_requests sr
  JOIN public.work_orders wo ON wo.service_request_id = sr.id
  WHERE wo.assigned_to = (SELECT auth.uid())
     OR wo.supervisor_id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.assigned_job_profile_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.profile_id
  FROM public.customers c
  JOIN public.service_requests sr ON sr.customer_id = c.id
  JOIN public.work_orders wo ON wo.service_request_id = sr.id
  WHERE c.profile_id IS NOT NULL
    AND (
      wo.assigned_to = (SELECT auth.uid())
      OR wo.supervisor_id = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.assigned_job_customer_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assigned_job_profile_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assigned_job_customer_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assigned_job_profile_ids() TO authenticated;

DROP POLICY IF EXISTS customers_assigned_job ON public.customers;
CREATE POLICY customers_assigned_job ON public.customers FOR SELECT USING (
  id IN (SELECT public.assigned_job_customer_ids())
);

DROP POLICY IF EXISTS profiles_job_contact ON public.profiles;
CREATE POLICY profiles_job_contact ON public.profiles FOR SELECT USING (
  id IN (SELECT public.assigned_job_profile_ids())
);
