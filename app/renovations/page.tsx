import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

async function createProject(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("renovation_projects").insert({
    property_id: formData.get("property_id"),
    name: formData.get("name"),
    budget_total: formData.get("budget_total") || null,
    start_date: formData.get("start_date") || null,
    target_end_date: formData.get("target_end_date") || null,
    status: "planning",
  });
  revalidatePath("/renovations");
}

export default async function RenovationsPage() {
  const supabase = createClient();
  const [{ data: projects }, { data: properties }, { data: lineItems }] = await Promise.all([
    supabase.from("renovation_projects").select("*, properties(address)").order("created_at", { ascending: false }),
    supabase.from("properties").select("id, address"),
    supabase.from("renovation_line_items").select("project_id, budgeted_amount, actual_amount"),
  ]);

  const actualsByProject = new Map<string, { budgeted: number; actual: number }>();
  (lineItems ?? []).forEach((li) => {
    const cur = actualsByProject.get(li.project_id) ?? { budgeted: 0, actual: 0 };
    cur.budgeted += Number(li.budgeted_amount ?? 0);
    cur.actual += Number(li.actual_amount ?? 0);
    actualsByProject.set(li.project_id, cur);
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Renovation projects</h1>
      <p className="mb-6 text-sm text-black/60">Budget vs. actual, by property. Add line items and tasks from a project once created.</p>

      <form action={createProject} className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-6">
        <select name="property_id" required className="col-span-2 rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="">Select property...</option>
          {(properties ?? []).map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}
        </select>
        <input name="name" placeholder="Project name (e.g. Full gut reno)" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="budget_total" type="number" placeholder="Total budget" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="start_date" type="date" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="target_end_date" type="date" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Add project</button>
      </form>

      <div className="table-shell">
        <table>
          <thead>
            <tr><th>Property</th><th>Project</th><th>Status</th><th>Budget</th><th>Actual (line items)</th></tr>
          </thead>
          <tbody>
            {(projects ?? []).map((p: any) => {
              const actuals = actualsByProject.get(p.id);
              return (
                <tr key={p.id}>
                  <td>{p.properties?.address ?? "—"}</td>
                  <td>{p.name}</td>
                  <td><span className="badge bg-black/5">{p.status}</span></td>
                  <td>{p.budget_total ? `$${Number(p.budget_total).toLocaleString()}` : "—"}</td>
                  <td>{actuals ? `$${actuals.actual.toLocaleString()} of $${actuals.budgeted.toLocaleString()}` : "—"}</td>
                </tr>
              );
            })}
            {(!projects || projects.length === 0) && (
              <tr><td colSpan={5} className="py-6 text-center text-black/40">No renovation projects yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
