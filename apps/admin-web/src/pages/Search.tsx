import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../lib/supabase';
import { DataState } from '../components/DataState';

type Hit = { kind: string; id: string; title: string; subtitle: string };

const hrefFor = (hit: Hit) => {
  if (hit.kind === 'service_request') return `/service-requests/${hit.id}`;
  if (hit.kind === 'customer') return '/customers';
  if (hit.kind === 'vessel') return '/vessels';
  return '/reports';
};

export const Search: React.FC = () => {
  const [params] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const [rows, setRows] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const run = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await db().rpc('search_catalog', { q: term });
    setLoading(false);
    setSearched(true);
    if (rpcError) setError(rpcError.message);
    else setRows((data ?? []) as Hit[]);
  };

  React.useEffect(() => {
    const initial = params.get('q');
    if (initial) {
      setTerm(initial);
      void (async () => {
        setLoading(true);
        const { data, error: rpcError } = await db().rpc('search_catalog', { q: initial });
        setLoading(false);
        setSearched(true);
        if (rpcError) setError(rpcError.message);
        else setRows((data ?? []) as Hit[]);
      })();
    }
  }, [params]);

  return (
    <div>
      <form onSubmit={run} className="mb-4 flex gap-2">
        <input className="rounded border px-2 py-1" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search" />
        <button className="rounded bg-[#0B4F6C] px-3 py-1 text-white">Search</button>
      </form>
      <DataState loading={loading} error={error} empty={searched && rows.length === 0} emptyLabel="No matches.">
        <ul className="space-y-2">
          {rows.map((hit) => (
            <li key={`${hit.kind}-${hit.id}`} className="rounded bg-white p-3 dark:bg-slate-900">
              <Link to={hrefFor(hit)} className="font-medium text-[#0B4F6C]">{hit.title}</Link>
              <p className="text-sm text-slate-500">{hit.kind} · {hit.subtitle}</p>
            </li>
          ))}
        </ul>
      </DataState>
    </div>
  );
};
