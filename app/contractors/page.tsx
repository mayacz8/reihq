import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function createContractor(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("contractors").insert({
    company_name: formData.get("company_name"),
    contact_name: formData.get("contact_name") || null,
    phone: formData.get("phone") || null,
    email: formData.get("email") || null,
    trade: formData.get("trade") || null,
    license_number: formData.get("license_number") || null,
    insurance_verified: formData.get("insurance_verified") === "on",
    insurance_expiry: formData.get("insurance_expiry") || null,
    rating: formData.get("rating") || null,
    is_preferred: formData.get("is_preferred") === "on",
    reliability_notes: formData.get("reliability_notes") || null,
  });
  revalidatePath("/contractors");
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-black/30">—</span>;
  return <span>{"★".repeat(rating)}{"☆".repeat(5 - rating)}</span>;
}

export default async function ContractorsPage() {
  const supabase = createClient();
  const { data: contractors } = await supabase
    .from("contractors")
    .select("*")
    .order("is_preferred", { ascending: false })
    .order("company_name");

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Contractors</h1>
      <p className="mb-6 text-sm text-black/60">Your trade directory — contact info, license/insurance status, and reliability notes.</p>

      <form action={createContractor} className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-4">
        <input name="company_name" placeholder="Company name" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="contact_name" placeholder="Contact name" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="trade" placeholder="Trade (e.g. Electrical)" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="phone" placeholder="Phone" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="email" placeholder="Email" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="license_number" placeholder="License #" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="insurance_expiry" type="date" placeholder="Insurance expiry" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <select name="rating" className="rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="">Rating...</option>
          <option value="5">★★★★★</option>
          <option value="4">★★★★</option>
          <option value="3">★★★</option>
          <option value="2">★★</option>
          <option value="1">★</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-black/70">
          <input type="checkbox" name="insurance_verified" /> Insurance verified
        </label>
        <label className="flex items-center gap-2 text-sm text-black/70">
          <input type="checkbox" name="is_preferred" /> Preferred contractor
        </label>
        <input name="reliability_notes" placeholder="Notes (reliability, quality...)" className="col-span-2 rounded-lg border border-black/15 px-3 py-2 text-sm md:col-span-2" />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Add contractor</button>
      </form>

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Trade</th>
              <th>Contact</th>
              <th>License</th>
              <th>Insurance</th>
              <th>Rating</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {(contractors ?? []).map((c) => {
              const insuranceExpired = c.insurance_expiry && c.insurance_expiry < today;
              return (
                <tr key={c.id}>
                  <td>
                    {c.company_name}
                    {c.is_preferred && <span className="badge ml-2 bg-black/5">Preferred</span>}
                  </td>
                  <td>{c.trade ?? "—"}</td>
                  <td>{c.phone || c.email ? [c.phone, c.email].filter(Boolean).join(" · ") : "—"}</td>
                  <td>{c.license_number ?? "—"}</td>
                  <td>
                    {c.insurance_verified ? (
                      <span className={insuranceExpired ? "text-red-700" : "text-emerald-700"}>
                        {insuranceExpired ? "Expired" : "Verified"}
                        {c.insurance_expiry ? ` (${c.insurance_expiry})` : ""}
                      </span>
                    ) : (
                      <span className="text-black/40">Not verified</span>
                    )}
                  </td>
                  <td><Stars rating={c.rating} /></td>
                  <td className="max-w-xs truncate">{c.reliability_notes ?? "—"}</td>
                </tr>
              );
            })}
            {(!contractors || contractors.length === 0) && (
              <tr><td colSpan={7} className="py-6 text-center text-black/40">No contractors yet. Add your first one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
