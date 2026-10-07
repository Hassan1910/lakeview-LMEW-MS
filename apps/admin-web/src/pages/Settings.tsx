import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Card, Page } from '../components/ui';

export const Settings: React.FC = () => {
  const { profile, role, can, canAny } = useAuth();
  const links = [
    { to: '/company', label: 'Edit company profile', show: can('company.edit') },
    { to: '/users', label: 'Manage users', show: canAny(['users.view', 'users.manage']) },
    { to: '/roles', label: 'Roles & permissions', show: canAny(['roles.view', 'roles.manage']) },
    { to: '/audit', label: 'Open audit log', show: can('audit.view') },
  ].filter((link) => link.show);
  return (
    <Page title="Settings" description="Company profile, people, and the audit trail.">
      <Card>
        <p>Signed in as {profile?.full_name} ({role?.name ?? profile?.role}).</p>
        <p className="text-sm text-slate-500">Online checkout uses Paystack. Issued invoices are due 14 days after they are created. Cash, bank, and M-Pesa receipts are recorded under Payments.</p>
        <ul className="mt-3 space-y-1">
          {links.map((link) => <li key={link.to}><Link className="text-[#0B4F6C] hover:underline dark:text-sky-300" to={link.to}>{link.label}</Link></li>)}
        </ul>
      </Card>
    </Page>
  );
};
