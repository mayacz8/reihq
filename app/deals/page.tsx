import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const STAGE_LABEL: Record<string, string> = {
  sourcing: "Sourcing",
  analyzing: "Analyzing",
  offer_submitted: "Offer submitted",
  under_contract: "Under contract",
  closed_won: "Closed - won",
  closed_lost: "Closed - lost",
};

async function createDeal(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("deals").insert({
    address: formData.get("address"),
    city: formData.get("city"),
    state: formData.get("state"),
    source: formData.get("source"),
    asking_price: formData.get("asking_price") || null,
    estimated_reno_cost: formData.get("estimated_reno_cost") || null,
    estimated_monthly_rent: formData.get("estimated_monthly_rent") || null,
    stage: "sourcing",
  });
  revalidatePath("/deals");
}

export default async function DealsPage() {
  const supabase = createClient();
  const { data: deals } = await supabase
    .from("deals")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Acquisition pipeline</h1>
      <p className="mb-6 text-sm text-black/60">Track prospective deals from first look to close.</p>

      <form action={createDeal} className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-6">
        <input name="address" placeholder="Address" required className="col-span-2 rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="city" placeholder="City" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="state" placeholder="State" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="source" placeholder="Source (MLS, wholesaler...)" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="asking_price" type="number" placeholder="Asking price" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="estimated_reno_cost" type="number" placeholder="Est. reno cost" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="estimated_monthly_rent" type="number" placeholder="Est. monthly rent" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Add deal</button>
      </form>

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Address</th>
              <th>Stage</th>
              <th>Asking</th>
              <th>Est. reno</th>
              <th>Est. rent</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {(deals ?? []).map((d) => (
              <tr key={d.id}>
                <td>{d.address}{d.city ? `, ${d.city}` : ""}</td>
                <td><span className="badge bg-black/5">{STAGE_LABEL[d.stage] ?? d.stage}</span></td>
                <td>{d.asking_price ? `$${Number(d.asking_price).toLocaleString()}` : "—"}</td>
                <td>{d.estimated_reno_cost ? `$${Number(d.estimated_reno_cost).toLocaleString()}` : "—"}</td>
                <td>{d.estimated_monthly_rent ? `$${Number(d.estimated_monthly_rent).toLocaleString()}` : "—"}</td>
                <td>{d.source ?? "—"}</td>
              </tr>
            ))}
            {(!deals || deals.length === 0) && (
              <tr><td colSpan={6} className="py-6 text-center text-black/40">No deals yet. Add your first one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
