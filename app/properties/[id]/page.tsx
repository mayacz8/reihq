import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const propertyId = params.id;

  async function addFurnishing(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("furnishings").insert({
      property_id: propertyId,
      item_name: formData.get("item_name"),
      vendor: formData.get("vendor") || null,
      category: formData.get("category") || "package",
      cost: formData.get("cost"),
      purchase_date: formData.get("purchase_date") || undefined,
      warranty_expiry: formData.get("warranty_expiry") || null,
      condition: formData.get("condition") || "new",
    });
    revalidatePath(`/properties/${propertyId}`);
  }

  const [{ data: property }, { data: renoProjects }, { data: leases }, { data: transactions }, { data: furnishings }] =
    await Promise.all([
      supabase.from("properties").select("*").eq("id", propertyId).single(),
      supabase.from("renovation_projects").select("*").eq("property_id", propertyId),
      supabase.from("leases").select("*, tenants(first_name, last_name)").eq("property_id", propertyId),
      supabase.from("transactions").select("*").eq("property_id", propertyId).order("date", { ascending: false }).limit(10),
      supabase.from("furnishings").select("*").eq("property_id", propertyId).order("purchase_date", { ascending: false }),
    ]);

  if (!property) notFound();

  const income = (transactions ?? []).filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = (transactions ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const furnishingTotal = (furnishings ?? []).reduce((s, f) => s + Number(f.cost ?? 0), 0);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">{property.address}</h1>
      <p className="mb-6 text-sm text-black/60">{property.city}, {property.state} {property.zip} &middot; {property.status}</p>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
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
        <div className="stat-card">
          <div className="text-xs text-black/50">Furnishing investment</div>
          <div className="mt-1 text-xl font-semibold">${furnishingTotal.toLocaleString()}</div>
        </div>
      </div>

      <h2 className="mb-2 text-lg font-medium">Renovation projects</h2>
      <div className="mb-8 table-shell">
        <table>
          <thead><tr><th>Name</th><th>Status</th><th>Budget</th></tr></thead>
          <tbody>
            {(renoProjects ?? []).map((r) => (
              <tr key={r.id}>
                <td><Link href={`/renovations/${r.id}`} className="text-accent underline">{r.name}</Link></td>
                <td>{r.status}</td>
                <td>{r.budget_total ? `$${Number(r.budget_total).toLocaleString()}` : "—"}</td>
              </tr>
            ))}
            {(!renoProjects || renoProjects.length === 0) && <tr><td colSpan={3} className="py-4 text-center text-black/40">None yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg font-medium">Leases</h2>
      <div className="mb-8 table-shell">
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

      <h2 className="mb-2 text-lg font-medium">Furnishings (furnished rental buyout)</h2>
      <p className="mb-3 text-sm text-black/60">Furniture packages, appliances, and decor bought to rent this unit furnished.</p>
      <form action={addFurnishing} className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-6">
        <input name="item_name" placeholder="Item / package name" required className="col-span-2 rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <select name="category" className="rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="package">Full package</option>
          <option value="furniture">Furniture</option>
          <option value="appliance">Appliance</option>
          <option value="decor">Decor</option>
          <option value="electronics">Electronics</option>
          <option value="other">Other</option>
        </select>
        <input name="vendor" placeholder="Vendor" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="cost" type="number" placeholder="Cost $" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="purchase_date" type="date" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="warranty_expiry" type="date" placeholder="Warranty expiry" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <select name="condition" className="rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="new">New</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="needs_replacement">Needs replacement</option>
        </select>
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Add furnishing</button>
      </form>
      <div className="table-shell">
        <table>
          <thead><tr><th>Item</th><th>Category</th><th>Vendor</th><th>Cost</th><th>Purchased</th><th>Warranty</th><th>Condition</th></tr></thead>
          <tbody>
            {(furnishings ?? []).map((f) => (
              <tr key={f.id}>
                <td>{f.item_name}</td>
                <td><span className="badge bg-black/5">{f.category}</span></td>
                <td>{f.vendor ?? "—"}</td>
                <td>${Number(f.cost).toLocaleString()}</td>
                <td>{f.purchase_date}</td>
                <td>{f.warranty_expiry ?? "—"}</td>
                <td>{f.condition}</td>
              </tr>
            ))}
            {(!furnishings || furnishings.length === 0) && <tr><td colSpan={7} className="py-4 text-center text-black/40">Not furnished yet, or no costs logged.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
