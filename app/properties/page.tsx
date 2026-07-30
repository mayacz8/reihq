import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  prospect: "Prospect",
  under_contract: "Under contract",
  owned_renovating: "Renovating",
  owned_rented: "Rented",
  owned_vacant: "Vacant",
  sold: "Sold",
};

async function createProperty(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("properties").insert({
    address: formData.get("address"),
    city: formData.get("city"),
    state: formData.get("state"),
    zip: formData.get("zip"),
    purchase_price: formData.get("purchase_price") || null,
    current_value_estimate: formData.get("current_value_estimate") || null,
    status: "prospect",
  });
  revalidatePath("/properties");
}

export default async function PropertiesPage() {
  const supabase = createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Properties</h1>
      <p className="mb-6 text-sm text-black/60">Every property you own or are acquiring, in one place.</p>

      <form action={createProperty} className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-6">
        <input name="address" placeholder="Address" required className="col-span-2 rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="city" placeholder="City" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="state" placeholder="State" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="zip" placeholder="ZIP" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="purchase_price" type="number" placeholder="Purchase price" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="current_value_estimate" type="number" placeholder="Current value est." className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Add property</button>
      </form>

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Address</th>
              <th>Status</th>
              <th>Purchase price</th>
              <th>Current value est.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(properties ?? []).map((p) => (
              <tr key={p.id}>
                <td>{p.address}{p.city ? `, ${p.city}` : ""}</td>
                <td><span className="badge bg-black/5">{STATUS_LABEL[p.status] ?? p.status}</span></td>
                <td>{p.purchase_price ? `$${Number(p.purchase_price).toLocaleString()}` : "—"}</td>
                <td>{p.current_value_estimate ? `$${Number(p.current_value_estimate).toLocaleString()}` : "—"}</td>
                <td><Link href={`/properties/${p.id}`} className="text-accent underline">View</Link></td>
              </tr>
            ))}
            {(!properties || properties.length === 0) && (
              <tr><td colSpan={5} className="py-6 text-center text-black/40">No properties yet. Add one above, or convert a won deal.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
