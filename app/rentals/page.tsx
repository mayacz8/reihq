import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function createTenantAndLease(formData: FormData) {
  "use server";
  const supabase = createClient();

  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .insert({
      first_name: formData.get("first_name"),
      last_name: formData.get("last_name"),
      email: formData.get("email") || null,
      phone: formData.get("phone") || null,
    })
    .select()
    .single();

  if (!tErr && tenant) {
    await supabase.from("leases").insert({
      property_id: formData.get("property_id"),
      tenant_id: tenant.id,
      start_date: formData.get("start_date"),
      end_date: formData.get("end_date") || null,
      monthly_rent: formData.get("monthly_rent"),
      security_deposit: formData.get("security_deposit") || null,
      status: "active",
    });
  }
  revalidatePath("/rentals");
}

export default async function RentalsPage() {
  const supabase = createClient();
  const [{ data: leases }, { data: properties }, { data: rentPayments }] = await Promise.all([
    supabase
      .from("leases")
      .select("*, tenants(first_name, last_name, email, phone), properties(address)")
      .order("created_at", { ascending: false }),
    supabase.from("properties").select("id, address"),
    supabase
      .from("rent_payments")
      .select("*, leases(tenants(first_name,last_name), properties(address))")
      .order("due_date", { ascending: false })
      .limit(15),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Rentals</h1>
      <p className="mb-6 text-sm text-black/60">Tenants, leases, and the rent roll across your portfolio.</p>

      <form action={createTenantAndLease} className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-4">
        <select name="property_id" required className="rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="">Property...</option>
          {(properties ?? []).map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}
        </select>
        <input name="first_name" placeholder="Tenant first name" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="last_name" placeholder="Tenant last name" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="email" placeholder="Email" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="phone" placeholder="Phone" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="start_date" type="date" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="monthly_rent" type="number" placeholder="Monthly rent" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Add tenant + lease</button>
      </form>

      <h2 className="mb-2 text-lg font-medium">Active leases</h2>
      <div className="mb-8 table-shell">
        <table>
          <thead><tr><th>Property</th><th>Tenant</th><th>Status</th><th>Monthly rent</th><th>Contact</th></tr></thead>
          <tbody>
            {(leases ?? []).map((l: any) => (
              <tr key={l.id}>
                <td>{l.properties?.address ?? "—"}</td>
                <td>{l.tenants ? `${l.tenants.first_name} ${l.tenants.last_name}` : "—"}</td>
                <td><span className="badge bg-black/5">{l.status}</span></td>
                <td>${Number(l.monthly_rent).toLocaleString()}</td>
                <td>{l.tenants?.email ?? l.tenants?.phone ?? "—"}</td>
              </tr>
            ))}
            {(!leases || leases.length === 0) && <tr><td colSpan={5} className="py-6 text-center text-black/40">No leases yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg font-medium">Recent rent payments</h2>
      <div className="table-shell">
        <table>
          <thead><tr><th>Property</th><th>Tenant</th><th>Due date</th><th>Amount due</th><th>Paid</th><th>Status</th></tr></thead>
          <tbody>
            {(rentPayments ?? []).map((rp: any) => (
              <tr key={rp.id}>
                <td>{rp.leases?.properties?.address ?? "—"}</td>
                <td>{rp.leases?.tenants ? `${rp.leases.tenants.first_name} ${rp.leases.tenants.last_name}` : "—"}</td>
                <td>{rp.due_date}</td>
                <td>${Number(rp.amount_due).toLocaleString()}</td>
                <td>${Number(rp.amount_paid).toLocaleString()}</td>
                <td><span className="badge bg-black/5">{rp.status}</span></td>
              </tr>
            ))}
            {(!rentPayments || rentPayments.length === 0) && <tr><td colSpan={6} className="py-6 text-center text-black/40">No rent payments logged yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
