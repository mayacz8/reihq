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
    contingency_amount: formData.get("contingency_amount") || 0,
    start_date: formData.get("start_date") || null,
    target_end_date: formData.get("target_end_date") || null,
    status: "planning",
  });
  revalidatePath("/renovations");
}

function money(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export default async function RenovationsPage() {
  const supabase = createClient();
  const [{ data: projects }, { data: properties }, { data: lineItems }, { data: changeOrders }, { data: tasks }] = await Promise.all([
    supabase.from("renovation_projects").select("*, properties(address)").order("created_at", { ascending: false }),
    supabase.from("properties").select("id, address"),
    supabase.from("renovation_line_items").select("project_id, category, budgeted_amount, actual_amount"),
    supabase.from("change_orders").select("project_id, cost_delta, status"),
    supabase
      .from("renovation_tasks")
      .select("id, title, due_date, start_date, status, project_id, contractors(company_name), renovation_projects(name, properties(address))")
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(15),
  ]);

  const actualsByProject = new Map<string, { budgeted: number; actual: number }>();
  (lineItems ?? []).forEach((li) => {
    const cur = actualsByProject.get(li.project_id) ?? { budgeted: 0, actual: 0 };
    cur.budgeted += Number(li.budgeted_amount ?? 0);
    cur.actual += Number(li.actual_amount ?? 0);
    actualsByProject.set(li.project_id, cur);
  });

  const approvedCOsByProject = new Map<string, number>();
  (changeOrders ?? []).forEach((co) => {
    if (co.status !== "approved") return;
    approvedCOsByProject.set(co.project_id, (approvedCOsByProject.get(co.project_id) ?? 0) + Number(co.cost_delta));
  });

  const byCategory = new Map<string, { budgeted: number; actual: number }>();
  (lineItems ?? []).forEach((li) => {
    const cur = byCategory.get(li.category) ?? { budgeted: 0, actual: 0 };
    cur.budgeted += Number(li.budgeted_amount ?? 0);
    cur.actual += Number(li.actual_amount ?? 0);
    byCategory.set(li.category, cur);
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Renovation projects</h1>
      <p className="mb-6 text-sm text-black/60">Budget vs. actual, by property. Click a project for bids, change orders, tasks, permits, finishes, and documents.</p>

      <form action={createProject} className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-6">
        <select name="property_id" required className="col-span-2 rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="">Select property...</option>
          {(properties ?? []).map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}
        </select>
        <input name="name" placeholder="Project name (e.g. Full gut reno)" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="budget_total" type="number" placeholder="Total budget" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="contingency_amount" type="number" placeholder="Contingency $" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="start_date" type="date" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="target_end_date" type="date" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Add project</button>
      </form>

      <div className="mb-8 table-shell">
        <table>
          <thead>
            <tr><th>Property</th><th>Project</th><th>Status</th><th>Budget (incl. approved COs)</th><th>Actual</th></tr>
          </thead>
          <tbody>
            {(projects ?? []).map((p: any) => {
              const actuals = actualsByProject.get(p.id) ?? { budgeted: 0, actual: 0 };
              const totalBudget = Number(p.budget_total ?? 0) + (approvedCOsByProject.get(p.id) ?? 0);
              const overBudget = actuals.actual > totalBudget && totalBudget > 0;
              return (
                <tr key={p.id}>
                  <td>{p.properties?.address ?? "—"}</td>
                  <td><Link href={`/renovations/${p.id}`} className="text-accent underline">{p.name}</Link></td>
                  <td><span className="badge bg-black/5">{p.status}</span></td>
                  <td>{money(totalBudget)}</td>
                  <td className={overBudget ? "font-medium text-red-700" : ""}>
                    {money(actuals.actual)}
                    {overBudget && <span className="badge ml-2 bg-red-100 text-red-800">Over budget</span>}
                  </td>
                </tr>
              );
            })}
            {(!projects || projects.length === 0) && (
              <tr><td colSpan={5} className="py-6 text-center text-black/40">No renovation projects yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg font-medium">Spend by category (all properties)</h2>
      <div className="mb-8 table-shell">
        <table>
          <thead><tr><th>Category</th><th>Budgeted</th><th>Actual</th></tr></thead>
          <tbody>
            {Array.from(byCategory.entries()).map(([category, v]) => (
              <tr key={category}>
                <td>{category}</td>
                <td>{money(v.budgeted)}</td>
                <td className={v.actual > v.budgeted && v.budgeted > 0 ? "text-red-700" : ""}>{money(v.actual)}</td>
              </tr>
            ))}
            {byCategory.size === 0 && <tr><td colSpan={3} className="py-6 text-center text-black/40">No line items logged yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg font-medium">Upcoming schedule</h2>
      <div className="table-shell">
        <table>
          <thead><tr><th>Task</th><th>Property</th><th>Contractor</th><th>Start</th><th>Due</th></tr></thead>
          <tbody>
            {(tasks ?? []).map((t: any) => (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td>{t.renovation_projects?.properties?.address ?? "—"}</td>
                <td>{t.contractors?.company_name ?? "—"}</td>
                <td>{t.start_date ?? "—"}</td>
                <td>{t.due_date ?? "—"}</td>
              </tr>
            ))}
            {(!tasks || tasks.length === 0) && <tr><td colSpan={5} className="py-6 text-center text-black/40">Nothing scheduled.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
