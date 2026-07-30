import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: property }, { data: renoProjects }, { data: leases }, { data: transactions }] =
    await Promise.all([
      supabase.from("properties").select("*").eq("id", params.id).single(),
      supabase.from("renovation_projects").select("*").eq("property_id", params.id),
      supabase.from("leases").select("*, tenants(first_name, last_name)").eq("property_id", params.id),
      supabase.from("transactions").select("*").eq("property_id", params.id).order("date", { ascending: false }).limit(10),
    ]);

  if (!property) notFound();

  const income = (transactions ?? []).filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = (transactions ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">{property.address}</h1>
      <p className="mb-6 text-sm text-black/60">{property.city}, {property.state} {property.zip} &middot; {property.status}</p>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="text-xs text-black/50">Purchase price</div>
          <div className="mt-1 text-xl font-semibold">{property.purchase_price ? `$${Number(property.purchase_price).toLocaleString()}` : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">Recent income (last 10 tx)</div>
          <div className="mt-1 text-xl font-semibold text-emerald-700">${income.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">Recent expenses (last 10 tx)</div>
          <div className="mt-1 text-xl font-semibold text-red-700">${expense.toLocaleString()}</div>
        </div>
      </div>

      <h2 className="mb-2 text-lg font-medium">Renovation projects</h2>
      <div className="mb-8 table-shell">
        <table>
          <thead><tr><th>Name</th><th>Status</th><th>Budget</th></tr></thead>
          <tbody>
            {(renoProjects ?? []).map((r) => (
              <tr key={r.id}><td>{r.name}</td><td>{r.status}</td><td>{r.budget_total ? `$${Number(r.budget_total).toLocaleString()}` : "—"}</td></tr>
            ))}
            {(!renoProjects || renoProjects.length === 0) && <tr><td colSpan={3} className="py-4 text-center text-black/40">None yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg font-medium">Leases</h2>
      <div className="table-shell">
        <table>
          <thead><tr><th>Tenant</th><th>Status</th><th>Monthly rent</th></tr></thead>
          <tbody>
            {(leases ?? []).map((l: any) => (
              <tr key={l.id}>
                <td>{l.tenants ? `${l.tenants.first_name} ${l.tenants.last_name}` : "—"}</td>
                <td>{l.status}</td>
                <td>${Number(l.monthly_rent).toLocaleString()}</td>
              </tr>
            ))}
            {(!leases || leases.length === 0) && <tr><td colSpan={3} className="py-4 text-center text-black/40">No leases yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
