import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../lib/supabase';
import { statusLabel } from '../lib/format';
import { DataState } from '../components/DataState';
import { Badge, Button, Page, linkClass } from '../components/ui';

type Hit = { kind: string; id: string; title: string; subtitle: string };

const hrefFor = (hit: Hit) => {
  if (hit.kind === 'service_request') return `/service-requests/${hit.id}`;
  if (hit.kind === 'customer') return `/customers/${hit.id}`;
  if (hit.kind === 'vessel') return `/vessels/${hit.id}`;
  return '/reports';
};

export const Search: React.FC = () => {
  const [params] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const [rows, setRows] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const run = async (event?: React.FormEvent, value = term) => {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await db().rpc('search_catalog', { q: value });
    setLoading(false);
    setSearched(true);
    if (rpcError) setError(rpcError.message);
    else setRows((data ?? []) as Hit[]);
  };

  React.useEffect(() => {
    const initial = params.get('q');
    if (initial) {
      setTerm(initial);
      void run(undefined, initial);
    }
    // The header search lands here with a query string. Re-run only when that string changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <Page title="Search" description="Customers, vessels, and service requests.">
      <form onSubmit={run} className="flex max-w-xl gap-2">
        <label className="min-w-0 flex-1 text-sm">
          <span className="sr-only">Search</span>
          <input className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-950" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Name, code, or registration" />
        </label>
        <Button type="submit">Search</Button>
      </form>
      <DataState loading={loading} error={error} empty={searched && rows.length === 0} emptyLabel="No matches." emptyDescription="Try a customer name, vessel registration, or request code.">
        {!searched ? <p className="text-sm text-slate-500">Enter a term to search the catalogue.</p> : (
          <ul className="space-y-2">
            {rows.map((hit) => (
              <li key={`${hit.kind}-${hit.id}`} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={hrefFor(hit)} className={linkClass}>{hit.title}</Link>
                  <Badge>{statusLabel(hit.kind)}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">{hit.subtitle}</p>
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </Page>
  );
};
