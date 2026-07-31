import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GanttChart, { GanttTaskInput } from "@/components/GanttChart";

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default async function RenovationDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const projectId = params.id;

  async function addLineItem(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("renovation_line_items").insert({
      project_id: projectId,
      category: formData.get("category"),
      description: formData.get("description") || null,
      budgeted_amount: formData.get("budgeted_amount") || 0,
      actual_amount: formData.get("actual_amount") || 0,
      contractor_id: formData.get("contractor_id") || null,
    });
    revalidatePath(`/renovations/${projectId}`);
  }

  async function addBid(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("renovation_bids").insert({
      line_item_id: formData.get("line_item_id"),
      contractor_id: formData.get("contractor_id"),
      amount: formData.get("amount"),
      notes: formData.get("notes") || null,
    });
    revalidatePath(`/renovations/${projectId}`);
  }

  async function acceptBid(formData: FormData) {
    "use server";
    const supabase = createClient();
    const bidId = formData.get("bid_id") as string;
    const lineItemId = formData.get("line_item_id") as string;
    const contractorId = formData.get("contractor_id") as string;
    const amount = formData.get("amount") as string;
    await supabase.from("renovation_bids").update({ status: "accepted" }).eq("id", bidId);
    await supabase
      .from("renovation_bids")
      .update({ status: "rejected" })
      .eq("line_item_id", lineItemId)
      .neq("id", bidId);
    await supabase
      .from("renovation_line_items")
      .update({ contractor_id: contractorId, budgeted_amount: amount })
      .eq("id", lineItemId);
    revalidatePath(`/renovations/${projectId}`);
  }

  async function addChangeOrder(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("change_orders").insert({
      project_id: projectId,
      line_item_id: formData.get("line_item_id") || null,
      description: formData.get("description"),
      cost_delta: formData.get("cost_delta"),
      notes: formData.get("notes") || null,
    });
    revalidatePath(`/renovations/${projectId}`);
  }

  async function approveChangeOrder(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase
      .from("change_orders")
      .update({ status: "approved", approved_date: new Date().toISOString().slice(0, 10) })
      .eq("id", formData.get("change_order_id"));
    revalidatePath(`/renovations/${projectId}`);
  }

  async function addTask(formData: FormData) {
    "use server";
    const supabase = createClient();
    const dependsOn = (formData.getAll("depends_on") as string[]).filter(Boolean);
    const { data: newTask } = await supabase
      .from("renovation_tasks")
      .insert({
        project_id: projectId,
        title: formData.get("title"),
        category: formData.get("category") || "General",
        assigned_contractor_id: formData.get("assigned_contractor_id") || null,
        start_date: formData.get("start_date") || null,
        due_date: formData.get("due_date") || null,
        notes: formData.get("notes") || null,
      })
      .select("id")
      .single();
    if (newTask && dependsOn.length > 0) {
      await supabase.from("task_dependencies").insert(
        dependsOn.map((depId) => ({ task_id: newTask.id, depends_on_task_id: depId }))
      );
    }
    revalidatePath(`/renovations/${projectId}`);
  }

  async function updateTaskStatus(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase
      .from("renovation_tasks")
      .update({ status: formData.get("status") })
      .eq("id", formData.get("task_id"));
    revalidatePath(`/renovations/${projectId}`);
  }

  async function addPermit(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("permits").insert({
      project_id: projectId,
      permit_type: formData.get("permit_type"),
      permit_number: formData.get("permit_number") || null,
      applied_date: formData.get("applied_date") || null,
      inspection_date: formData.get("inspection_date") || null,
      notes: formData.get("notes") || null,
    });
    revalidatePath(`/renovations/${projectId}`);
  }

  async function addFinishSelection(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("finish_selections").insert({
      project_id: projectId,
      room: formData.get("room") || null,
      category: formData.get("category"),
      item_name: formData.get("item_name"),
      brand: formData.get("brand") || null,
      color_finish: formData.get("color_finish") || null,
      vendor: formData.get("vendor") || null,
      cost: formData.get("cost") || null,
      spec_url: formData.get("spec_url") || null,
    });
    revalidatePath(`/renovations/${projectId}`);
  }

  async function uploadDocument(formData: FormData) {
    "use server";
    const supabase = createClient();
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return;
    const docType = formData.get("doc_type") as string;
    const path = `${projectId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("renovation-docs").upload(path, file);
    if (uploadError) return;
    const { data: publicUrl } = supabase.storage.from("renovation-docs").getPublicUrl(path);
    await supabase.from("renovation_documents").insert({
      project_id: projectId,
      doc_type: docType,
      file_url: publicUrl.publicUrl,
      file_name: file.name,
      caption: formData.get("caption") || null,
    });
    revalidatePath(`/renovations/${projectId}`);
  }

  const [
    { data: project },
    { data: lineItems },
    { data: bids },
    { data: changeOrders },
    { data: tasks },
    { data: permits },
    { data: finishes },
    { data: documents },
    { data: contractors },
  ] = await Promise.all([
    supabase.from("renovation_projects").select("*, properties(id, address)").eq("id", projectId).single(),
    supabase.from("renovation_line_items").select("*, contractors(company_name)").eq("project_id", projectId).order("created_at"),
    supabase
      .from("renovation_bids")
      .select("*, contractors(company_name), renovation_line_items!inner(project_id, category)")
      .eq("renovation_line_items.project_id", projectId),
    supabase.from("change_orders").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("renovation_tasks").select("*, contractors(company_name)").eq("project_id", projectId).order("due_date"),
    supabase.from("permits").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("finish_selections").select("*").eq("project_id", projectId).order("room"),
    supabase.from("renovation_documents").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("contractors").select("id, company_name, trade, rating, is_preferred").order("company_name"),
  ]);

  if (!project) notFound();

  const taskIds = (tasks ?? []).map((t: any) => t.id);
  const { data: taskDependencies } =
    taskIds.length > 0
      ? await supabase.from("task_dependencies").select("*").in("task_id", taskIds)
      : { data: [] as any[] };

  const depsByTask = new Map<string, string[]>();
  (taskDependencies ?? []).forEach((d: any) => {
    const arr = depsByTask.get(d.task_id) ?? [];
    arr.push(d.depends_on_task_id);
    depsByTask.set(d.task_id, arr);
  });

  const taskById = new Map((tasks ?? []).map((t: any) => [t.id, t]));
  const schedulableIds = new Set(
    (tasks ?? []).filter((t: any) => t.start_date && t.due_date).map((t: any) => t.id)
  );
  const statusToProgress: Record<string, number> = { todo: 0, in_progress: 50, done: 100 };

  const ganttTasks: GanttTaskInput[] = (tasks ?? [])
    .filter((t: any) => schedulableIds.has(t.id))
    .map((t: any) => ({
      id: t.id,
      name: t.title,
      start: t.start_date,
      end: t.due_date,
      progress: statusToProgress[t.status] ?? 0,
      dependencies: (depsByTask.get(t.id) ?? []).filter((depId) => schedulableIds.has(depId)).join(","),
      category: t.category || "General",
    }));

  const scheduleViolations: { taskTitle: string; dependsOnTitle: string; taskStart: string; depDue: string }[] = [];
  (tasks ?? []).forEach((t: any) => {
    if (!t.start_date) return;
    (depsByTask.get(t.id) ?? []).forEach((depId: string) => {
      const dep = taskById.get(depId);
      if (dep?.due_date && t.start_date < dep.due_date) {
        scheduleViolations.push({
          taskTitle: t.title,
          dependsOnTitle: dep.title,
          taskStart: t.start_date,
          depDue: dep.due_date,
        });
      }
    });
  });

  const originalBudget = Number(project.budget_total ?? 0);
  const contingency = Number(project.contingency_amount ?? 0);
  const approvedChangeOrders = (changeOrders ?? [])
    .filter((c) => c.status === "approved")
    .reduce((s, c) => s + Number(c.cost_delta), 0);
  const totalBudget = originalBudget + approvedChangeOrders;
  const actualSpent = (lineItems ?? []).reduce((s, li) => s + Number(li.actual_amount ?? 0), 0);
  const remaining = totalBudget - actualSpent;
  const overBudget = actualSpent > totalBudget;
  const contingencyUsed = Math.min(Math.max(actualSpent - totalBudget, 0), contingency);

  const bidsByLineItem = new Map<string, any[]>();
  (bids ?? []).forEach((b: any) => {
    const arr = bidsByLineItem.get(b.line_item_id) ?? [];
    arr.push(b);
    bidsByLineItem.set(b.line_item_id, arr);
  });

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-black/50">
        <Link href="/renovations" className="underline">Renovations</Link>
        <span>/</span>
        <Link href={`/properties/${project.properties?.id}`} className="underline">{project.properties?.address}</Link>
      </div>
      <h1 className="mb-1 text-2xl font-semibold">{project.name}</h1>
      <p className="mb-6 text-sm text-black/60">
        <span className="badge bg-black/5">{project.status}</span>
        {project.start_date && ` · started ${project.start_date}`}
        {project.target_end_date && ` · target ${project.target_end_date}`}
      </p>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="stat-card">
          <div className="text-xs text-black/50">Original budget</div>
          <div className="mt-1 text-lg font-semibold">{money(originalBudget)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">Contingency</div>
          <div className="mt-1 text-lg font-semibold">{money(contingency)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">Approved change orders</div>
          <div className="mt-1 text-lg font-semibold">{money(approvedChangeOrders)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">Total budget</div>
          <div className="mt-1 text-lg font-semibold">{money(totalBudget)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">Actual spent</div>
          <div className={`mt-1 text-lg font-semibold ${overBudget ? "text-red-700" : ""}`}>{money(actualSpent)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">{overBudget ? "Over budget by" : "Remaining"}</div>
          <div className={`mt-1 text-lg font-semibold ${overBudget ? "text-red-700" : "text-emerald-700"}`}>
            {money(Math.abs(remaining))}
          </div>
        </div>
      </div>

      {overBudget && (
        <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          This project is over its total budget (original + approved change orders).
          {contingency > 0 && ` Contingency used: ${money(contingencyUsed)} of ${money(contingency)}.`}
        </div>
      )}

      {/* LINE ITEMS */}
      <h2 className="mb-2 text-lg font-medium">Budget line items</h2>
      <form action={addLineItem} className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-6">
        <input name="category" placeholder="Category (e.g. Kitchen)" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="description" placeholder="Description" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="budgeted_amount" type="number" placeholder="Budgeted $" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="actual_amount" type="number" placeholder="Actual $" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <select name="contractor_id" className="rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="">Contractor...</option>
          {(contractors ?? []).map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Add line item</button>
      </form>

      <div className="mb-8 table-shell">
        <table>
          <thead><tr><th>Category</th><th>Description</th><th>Contractor</th><th>Budgeted</th><th>Actual</th><th>Status</th></tr></thead>
          <tbody>
            {(lineItems ?? []).map((li: any) => {
              const itemOver = Number(li.actual_amount) > Number(li.budgeted_amount) && Number(li.budgeted_amount) > 0;
              const itemBids = bidsByLineItem.get(li.id) ?? [];
              return (
                <>
                  <tr key={li.id}>
                    <td>{li.category}</td>
                    <td>{li.description ?? "—"}</td>
                    <td>{li.contractors?.company_name ?? "—"}</td>
                    <td>{money(li.budgeted_amount)}</td>
                    <td className={itemOver ? "font-medium text-red-700" : ""}>{money(li.actual_amount)}</td>
                    <td><span className="badge bg-black/5">{li.status}</span></td>
                  </tr>
                  {itemBids.length > 0 && (
                    <tr key={li.id + "-bids"}>
                      <td colSpan={6} className="bg-black/[0.02] px-4 py-2">
                        <div className="mb-1 text-xs font-medium text-black/50">Bids for {li.category}</div>
                        <div className="flex flex-wrap gap-2">
                          {itemBids.map((b: any) => (
                            <div key={b.id} className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs">
                              <span>{b.contractors?.company_name}: {money(b.amount)}</span>
                              <span className="badge bg-black/5">{b.status}</span>
                              {b.status === "pending" && (
                                <form action={acceptBid}>
                                  <input type="hidden" name="bid_id" value={b.id} />
                                  <input type="hidden" name="line_item_id" value={li.id} />
                                  <input type="hidden" name="contractor_id" value={b.contractor_id} />
                                  <input type="hidden" name="amount" value={b.amount} />
                                  <button type="submit" className="text-accent underline">Accept</button>
                                </form>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {(!lineItems || lineItems.length === 0) && <tr><td colSpan={6} className="py-6 text-center text-black/40">No line items yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 text-sm font-medium text-black/70">Add a bid to a line item</h3>
      <form action={addBid} className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-5">
        <select name="line_item_id" required className="rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="">Line item...</option>
          {(lineItems ?? []).map((li: any) => <option key={li.id} value={li.id}>{li.category}</option>)}
        </select>
        <select name="contractor_id" required className="rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="">Contractor...</option>
          {(contractors ?? []).map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
        <input name="amount" type="number" placeholder="Bid amount $" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="notes" placeholder="Notes" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Add bid</button>
      </form>

      {/* CHANGE ORDERS */}
      <h2 className="mb-2 text-lg font-medium">Change orders</h2>
      <form action={addChangeOrder} className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-5">
        <input name="description" placeholder="Description" required className="col-span-2 rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <select name="line_item_id" className="rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="">Line item (optional)...</option>
          {(lineItems ?? []).map((li: any) => <option key={li.id} value={li.id}>{li.category}</option>)}
        </select>
        <input name="cost_delta" type="number" placeholder="Cost change $ (+/-)" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Add change order</button>
      </form>
      <div className="mb-8 table-shell">
        <table>
          <thead><tr><th>Description</th><th>Cost change</th><th>Status</th><th>Requested</th><th></th></tr></thead>
          <tbody>
            {(changeOrders ?? []).map((co: any) => (
              <tr key={co.id}>
                <td>{co.description}</td>
                <td>{money(co.cost_delta)}</td>
                <td><span className="badge bg-black/5">{co.status}</span></td>
                <td>{co.requested_date}</td>
                <td>
                  {co.status === "proposed" && (
                    <form action={approveChangeOrder}>
                      <input type="hidden" name="change_order_id" value={co.id} />
                      <button type="submit" className="text-accent underline">Approve</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {(!changeOrders || changeOrders.length === 0) && <tr><td colSpan={5} className="py-6 text-center text-black/40">No change orders yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* TASKS */}
      <h2 className="mb-2 text-lg font-medium">Punch list / tasks</h2>
      <form action={addTask} className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-6">
        <input name="title" placeholder="Task" required className="col-span-2 rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="category" placeholder="Category (e.g. Kitchen)" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <select name="assigned_contractor_id" className="rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="">Contractor...</option>
          {(contractors ?? []).map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
        <input name="start_date" type="date" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="due_date" type="date" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <select name="depends_on" multiple className="col-span-2 rounded-lg border border-black/15 px-3 py-2 text-sm md:col-span-2" size={Math.min(4, Math.max(2, (tasks ?? []).length))}>
          {(tasks ?? []).map((t: any) => <option key={t.id} value={t.id}>Depends on: {t.title}</option>)}
        </select>
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Add task</button>
      </form>
      <div className="mb-8 table-shell">
        <table>
          <thead><tr><th>Task</th><th>Category</th><th>Contractor</th><th>Start</th><th>Due</th><th>Depends on</th><th>Status</th></tr></thead>
          <tbody>
            {(tasks ?? []).map((t: any) => {
              const deps = (depsByTask.get(t.id) ?? []).map((depId) => taskById.get(depId)?.title).filter(Boolean);
              return (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td><span className="badge bg-black/5">{t.category || "General"}</span></td>
                  <td>{t.contractors?.company_name ?? "—"}</td>
                  <td>{t.start_date ?? "—"}</td>
                  <td>{t.due_date ?? "—"}</td>
                  <td className="text-xs text-black/50">{deps.length > 0 ? deps.join(", ") : "—"}</td>
                  <td>
                    <form action={updateTaskStatus} className="flex items-center gap-2">
                      <input type="hidden" name="task_id" value={t.id} />
                      <select name="status" defaultValue={t.status} className="rounded-lg border border-black/15 px-2 py-1 text-xs">
                        <option value="todo">To do</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                      <button type="submit" className="text-xs text-accent underline">Update</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {(!tasks || tasks.length === 0) && <tr><td colSpan={7} className="py-6 text-center text-black/40">No tasks yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* SCHEDULE / GANTT */}
      <h2 className="mb-2 text-lg font-medium">Project schedule</h2>
      {scheduleViolations.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="mb-1 font-medium">Scheduling conflicts detected</div>
          <ul className="list-inside list-disc space-y-0.5">
            {scheduleViolations.map((v, i) => (
              <li key={i}>
                "{v.taskTitle}" starts {v.taskStart}, before its dependency "{v.dependsOnTitle}" finishes ({v.depDue}).
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mb-8">
        <GanttChart projectId={projectId} tasks={ganttTasks} />
      </div>

      {/* PERMITS */}
      <h2 className="mb-2 text-lg font-medium">Permits &amp; inspections</h2>
      <form action={addPermit} className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-5">
        <input name="permit_type" placeholder="Permit type (e.g. Electrical)" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="permit_number" placeholder="Permit #" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="applied_date" type="date" placeholder="Applied" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="inspection_date" type="date" placeholder="Inspection date" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Add permit</button>
      </form>
      <div className="mb-8 table-shell">
        <table>
          <thead><tr><th>Type</th><th>Permit #</th><th>Status</th><th>Applied</th><th>Inspection</th><th>Result</th></tr></thead>
          <tbody>
            {(permits ?? []).map((p: any) => (
              <tr key={p.id}>
                <td>{p.permit_type}</td>
                <td>{p.permit_number ?? "—"}</td>
                <td><span className="badge bg-black/5">{p.status}</span></td>
                <td>{p.applied_date ?? "—"}</td>
                <td>{p.inspection_date ?? "—"}</td>
                <td>{p.inspection_result ?? "—"}</td>
              </tr>
            ))}
            {(!permits || permits.length === 0) && <tr><td colSpan={6} className="py-6 text-center text-black/40">No permits logged yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* DESIGN & FINISHES */}
      <h2 className="mb-2 text-lg font-medium">Design &amp; finishes</h2>
      <form action={addFinishSelection} className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-6">
        <input name="room" placeholder="Room (e.g. Kitchen)" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="category" placeholder="Category (e.g. Flooring)" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="item_name" placeholder="Item / selection" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="brand" placeholder="Brand" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="color_finish" placeholder="Color / finish" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="vendor" placeholder="Vendor" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="cost" type="number" placeholder="Cost $" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="spec_url" placeholder="Link to product page" className="col-span-2 rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Add selection</button>
      </form>
      <div className="mb-8 table-shell">
        <table>
          <thead><tr><th>Room</th><th>Category</th><th>Item</th><th>Brand / finish</th><th>Vendor</th><th>Cost</th><th>Status</th></tr></thead>
          <tbody>
            {(finishes ?? []).map((f: any) => (
              <tr key={f.id}>
                <td>{f.room ?? "—"}</td>
                <td>{f.category}</td>
                <td>{f.spec_url ? <a href={f.spec_url} target="_blank" className="text-accent underline">{f.item_name}</a> : f.item_name}</td>
                <td>{[f.brand, f.color_finish].filter(Boolean).join(" · ") || "—"}</td>
                <td>{f.vendor ?? "—"}</td>
                <td>{f.cost ? money(f.cost) : "—"}</td>
                <td><span className="badge bg-black/5">{f.status}</span></td>
              </tr>
            ))}
            {(!finishes || finishes.length === 0) && <tr><td colSpan={7} className="py-6 text-center text-black/40">No selections logged yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* DOCUMENTS */}
      <h2 className="mb-2 text-lg font-medium">Photos, invoices &amp; documents</h2>
      <form action={uploadDocument} className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-4">
        <select name="doc_type" className="rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="photo">Photo</option>
          <option value="invoice">Invoice</option>
          <option value="permit">Permit doc</option>
          <option value="inspection">Inspection report</option>
          <option value="other">Other</option>
        </select>
        <input name="caption" placeholder="Caption (optional)" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="file" type="file" required className="col-span-2 rounded-lg border border-black/15 px-3 py-2 text-sm md:col-span-1" />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Upload</button>
      </form>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(documents ?? []).map((d: any) => (
          <a key={d.id} href={d.file_url} target="_blank" className="block rounded-xl border border-black/10 bg-white p-3 text-xs hover:border-black/30">
            <div className="mb-1 badge bg-black/5">{d.doc_type}</div>
            <div className="truncate font-medium">{d.file_name}</div>
            {d.caption && <div className="text-black/50">{d.caption}</div>}
          </a>
        ))}
        {(!documents || documents.length === 0) && <div className="col-span-4 py-6 text-center text-sm text-black/40">No documents uploaded yet.</div>}
      </div>
    </div>
  );
}
