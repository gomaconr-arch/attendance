import React, { useMemo, useState } from "react";
import { Organization, User } from "../shared/types";
import { formatDateTimeAmPm } from "../shared/format";

interface NewOrgPayload {
  company_name: string;
  owner_name: string;
  owner_email: string;
  owner_password: string;
}

interface Props {
  organizations: Organization[];
  users: User[];
  onCreateOrganization: (payload: NewOrgPayload) => void;
  onToggleSubscription: (orgId: string) => void;
  onLogout: () => void;
}

export default function SuperAdminPortal({
  organizations,
  users,
  onCreateOrganization,
  onToggleSubscription,
  onLogout
}: Props) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<NewOrgPayload>({
    company_name: "",
    owner_name: "",
    owner_email: "",
    owner_password: ""
  });

  const filteredOrganizations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return organizations;
    }

    return organizations.filter((org) => {
      return org.company_name.toLowerCase().includes(q) || org.org_id.toLowerCase().includes(q);
    });
  }, [organizations, query]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white">Super Admin Portal</h1>
            <p className="text-sm text-slate-400">Manual billing validation and tenant control center</p>
          </div>
          <button
            onClick={onLogout}
            className="rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-white">Tenant Onboarding</h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              onCreateOrganization(form);
              setForm({ company_name: "", owner_name: "", owner_email: "", owner_password: "" });
            }}
          >
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="Company Name"
              value={form.company_name}
              onChange={(event) => setForm((prev) => ({ ...prev, company_name: event.target.value }))}
              required
            />
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="Primary Employer Name"
              value={form.owner_name}
              onChange={(event) => setForm((prev) => ({ ...prev, owner_name: event.target.value }))}
              required
            />
            <input
              type="email"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="Primary Employer Email"
              value={form.owner_email}
              onChange={(event) => setForm((prev) => ({ ...prev, owner_email: event.target.value }))}
              required
            />
            <input
              type="password"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="Temporary Password"
              value={form.owner_password}
              onChange={(event) => setForm((prev) => ({ ...prev, owner_password: event.target.value }))}
              required
            />
            <button
              type="submit"
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Create Organization
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">Subscription Matrix</h2>
            <input
              className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="Search org name or org id"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">Org ID</th>
                  <th className="py-2">Company</th>
                  <th className="py-2">Created</th>
                  <th className="py-2">Staff Count</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrganizations.map((org) => {
                  const staffCount = users.filter((u) => u.org_id === org.org_id && u.role === "Employee").length;
                  return (
                    <tr key={org.org_id} className="border-b border-slate-800">
                      <td className="py-3 font-mono text-xs text-indigo-400">{org.org_id}</td>
                      <td className="py-3 font-medium text-slate-100">{org.company_name}</td>
                      <td className="py-3 text-slate-400">{formatDateTimeAmPm(org.created_at)}</td>
                      <td className="py-3 text-slate-400">{staffCount}</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            org.subscription_status === "enabled"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                          }`}
                        >
                          {org.subscription_status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => onToggleSubscription(org.org_id)}
                          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                        >
                          {org.subscription_status === "enabled" ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
