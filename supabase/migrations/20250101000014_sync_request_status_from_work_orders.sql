-- A technician finishes a work order, not the service request. The admin
-- list reads service_requests.status, so a finished job used to leave that
-- column where staff last set it.
-- When every job on a request is done, move the request to testing from
-- whatever active step it is still on. Reopening a job sends a request
-- that is still in testing back to repair. Completed and cancelled
-- requests stay where staff left them.

CREATE OR REPLACE FUNCTION public.sync_request_status_from_work_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  open_jobs integer;
  finished_jobs integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT
    count(*) FILTER (WHERE status NOT IN ('completed', 'cancelled')),
    count(*) FILTER (WHERE status = 'completed')
  INTO open_jobs, finished_jobs
  FROM public.work_orders
  WHERE service_request_id = NEW.service_request_id;

  IF open_jobs = 0 AND finished_jobs > 0 THEN
    UPDATE public.service_requests
    SET status = 'testing'
    WHERE id = NEW.service_request_id
      AND status IN (
        'request_received',
        'inspection_in_progress',
        'quotation_pending',
        'quotation_sent',
        'awaiting_approval',
        'awaiting_spare_parts',
        'under_repair'
      );
  ELSIF open_jobs > 0 THEN
    UPDATE public.service_requests
    SET status = 'under_repair'
    WHERE id = NEW.service_request_id
      AND status = 'testing';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_request_status_from_work_orders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_request_status_from_work_orders() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_request_status_from_work_orders() TO service_role;

DROP TRIGGER IF EXISTS trigger_sync_request_status_from_work_orders ON public.work_orders;
CREATE TRIGGER trigger_sync_request_status_from_work_orders
AFTER INSERT OR UPDATE OF status ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_request_status_from_work_orders();

-- Requests finished before this trigger existed stay on the old status.
-- The status guard allows under_repair -> testing, and it skips checks
-- while another trigger is already running. This backfill is a direct
-- update, so the guard is paused for that statement only.
ALTER TABLE public.service_requests DISABLE TRIGGER trigger_guard_service_request_status;

UPDATE public.service_requests sr
SET status = 'testing'
WHERE sr.status IN (
  'request_received',
  'inspection_in_progress',
  'quotation_pending',
  'quotation_sent',
  'awaiting_approval',
  'awaiting_spare_parts',
  'under_repair'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.work_orders wo
  WHERE wo.service_request_id = sr.id
    AND wo.status NOT IN ('completed', 'cancelled')
)
AND EXISTS (
  SELECT 1
  FROM public.work_orders wo
  WHERE wo.service_request_id = sr.id
    AND wo.status = 'completed'
);

ALTER TABLE public.service_requests ENABLE TRIGGER trigger_guard_service_request_status;
