import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { formatMoney, formatWhen, statusLabel } from '../lib/format';
import { DataState } from '../components/DataState';
import { Button, Card, Notice, Page, StatusBadge, Table, linkClass, tdClass } from '../components/ui';

export const InvoiceDetail: React.FC = () => {
  const { id } = useParams();
  const { can } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const query = useQuery({
    queryKey: ['invoice', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const invoice = await db().from('invoices').select('id, code, status, currency, subtotal, tax_amount, discount, total, amount_paid, balance, issued_at, due_at, customer_id, customer:customers(company_name, profile:profiles!profile_id(full_name))').eq('id', id).single();
      if (invoice.error) throw invoice.error;
      const [items, payments] = await Promise.all([
        db().from('invoice_items').select('id, description, quantity, unit_price, line_total').eq('invoice_id', id),
        db().from('payments').select('id, amount, method, status, reference, created_at').eq('invoice_id', id).order('created_at', { ascending: false }),
      ]);
      if (items.error) throw items.error;
      if (payments.error) throw payments.error;
      return { invoice: invoice.data, items: items.data ?? [], payments: payments.data ?? [] };
    },
  });

  const print = async () => {
    if (!id) return;
    setPrinting(true);
    setError(null);
    setMessage(null);
    const { data, error: invokeError } = await db().functions.invoke('generate-pdf', { body: { type: 'invoice', id } });
    setPrinting(false);
    if (invokeError || data?.error) return setError(invokeError?.message ?? data.error);
    setMessage('PDF ready.');
    window.open(data.signed_url, '_blank');
  };

  const row = query.data?.invoice;
  const customer = row ? (Array.isArray(row.customer) ? row.customer[0] : row.customer) : null;
  const profile = customer ? (Array.isArray(customer.profile) ? customer.profile[0] : customer.profile) : null;
  const currency = row?.currency ?? 'KES';

  return (
    <DataState loading={query.isLoading} error={query.error instanceof Error ? query.error.message : null} empty={!row} emptyLabel="Invoice not found.">
      {row ? (
        <Page
          title={row.code ?? 'Invoice'}
          description={[customer?.company_name ?? profile?.full_name, row.due_at ? `Due ${formatWhen(row.due_at)}` : null].filter(Boolean).join(' · ')}
          actions={(
            <>
              {can('invoices.print') ? <Button variant="secondary" disabled={printing} onClick={print}>{printing ? 'Preparing…' : 'Print PDF'}</Button> : null}
              <Link className={`text-sm ${linkClass}`} to="/invoices">All invoices</Link>
            </>
          )}
        >
          <Notice tone="error">{error}</Notice>
          <Notice tone="success">{message}</Notice>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={row.status} />
            <span className="text-sm">Total {formatMoney(row.total, currency)}</span>
            <span className="text-sm">Paid {formatMoney(row.amount_paid, currency)}</span>
            <span className="text-sm font-medium">Balance {formatMoney(row.balance, currency)}</span>
          </div>
          <Card title="Lines">
            <p className="mb-3 text-sm text-slate-500">These lines were copied when the invoice was issued. Later quotation edits do not change them.</p>
            {(query.data?.items.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No lines were stored for this invoice.</p> : (
              <Table head={['Description', 'Qty', 'Price', 'Line']}>
                {query.data?.items.map((item) => (
                  <tr key={item.id}>
                    <td className={tdClass}>{item.description}</td>
                    <td className={tdClass}>{item.quantity}</td>
                    <td className={tdClass}>{formatMoney(item.unit_price, currency)}</td>
                    <td className={tdClass}>{formatMoney(item.line_total, currency)}</td>
                  </tr>
                ))}
              </Table>
            )}
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Subtotal {formatMoney(row.subtotal, currency)} · Tax {formatMoney(row.tax_amount, currency)} · Discount {formatMoney(row.discount, currency)}</p>
          </Card>
          <Card title="Payments">
            {(query.data?.payments.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No payments yet.</p> : (
              <ul className="space-y-2 text-sm">
                {query.data?.payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{statusLabel(payment.method)} · {formatMoney(payment.amount, currency)}{payment.reference ? ` · ${payment.reference}` : ''}</span>
                    <StatusBadge status={payment.status} />
                  </li>
                ))}
              </ul>
            )}
            {row.customer_id ? <p className="mt-3 text-sm"><Link className={linkClass} to={`/customers/${row.customer_id}`}>Open customer</Link></p> : null}
          </Card>
        </Page>
      ) : null}
    </DataState>
  );
};
