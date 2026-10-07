import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { routeForNotification, routeForSearchHit, technicianRequestFallback } from './routes.ts';

describe('routeForNotification', () => {
  it('opens the service request when a customer notification includes one', () => {
    assert.equal(
      routeForNotification({ service_request_id: 'req-1', invoice_id: 'inv-1' }, 'customer'),
      '/(customer)/request/req-1',
    );
  });

  it('opens the invoice when that is the only customer target', () => {
    assert.equal(routeForNotification({ invoice_id: 'inv-1' }, 'customer'), '/(customer)/invoice/inv-1');
  });

  it('opens the assigned job for a technician', () => {
    assert.equal(routeForNotification({ work_order_id: 'job-1' }, 'technician'), '/(technician)/job/job-1');
  });

  it('opens the same job on the supervisor board', () => {
    assert.equal(routeForNotification({ work_order_id: 'job-1' }, 'supervisor'), '/(supervisor)/team-jobs/job-1');
  });

  it('stays put when the payload has no record', () => {
    assert.equal(routeForNotification({}, 'customer'), null);
    assert.equal(routeForNotification(null, 'technician'), null);
    assert.equal(routeForNotification({ invoice_id: 12 }, 'customer'), null);
  });

  it('does not send a technician to the jobs list when only a request id is present', () => {
    assert.equal(routeForNotification({ service_request_id: 'req-1' }, 'technician'), null);
    assert.equal(technicianRequestFallback({ service_request_id: 'req-1' }, 'technician'), 'req-1');
    assert.equal(technicianRequestFallback({ work_order_id: 'job-1', service_request_id: 'req-1' }, 'technician'), null);
    assert.equal(technicianRequestFallback({ service_request_id: 'req-1' }, 'customer'), null);
  });
});

describe('routeForSearchHit', () => {
  it('links a customer to their own request or vessel', () => {
    assert.equal(routeForSearchHit('service_request', 'req-1'), '/(customer)/request/req-1');
    assert.equal(routeForSearchHit('vessel', 'ves-1'), '/(customer)/vessel/ves-1');
  });

  it('does not invent a screen for catalog rows the customer cannot open', () => {
    assert.equal(routeForSearchHit('inventory', 'item-1'), null);
    assert.equal(routeForSearchHit('customer', 'cus-1'), null);
  });
});
