import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function createTransaction(formData: FormData) {
  "use server";
  const supabase = createClient();
  await supabase.from("transactions").insert({
    property_id: formData.get("property_id"),
    type: formData.get("type"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    description: formData.get("description") || null,
  });
  revalidatePath("/financials");
}

export default async function FinancialsPage() {
  const supabase = createClient();
  const [{ data: properties }, { data: transactions }] = await Promise.all([
    supabase.from("properties").select("id, address"),
    supabase
      .from("transactions")
      .select("*, properties(address)")
      .order("date", { ascending: false })
      .limit(50),
  ]);

  const byProperty = new Map<string, { income: number; expense: number }>();
  (transactions ?? []).forEach((t: any) => {
    const key = t.properties?.address ?? "Unassigned";
    const cur = byProperty.get(key) ?? { income: 0, expense: 0 };
    if (t.type === "income") cur.income += Number(t.amount);
    else cur.expense += Number(t.amount);
    byProperty.set(key, cur);
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Financials</h1>
      <p className="mb-6 text-sm text-black/60">Income and expenses, logged per property. Roll up into a per-property P&amp;L below.</p>

      <form action={createTransaction} className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-black/10 bg-white p-5 md:grid-cols-6">
        <select name="property_id" required className="rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="">Property...</option>
          {(properties ?? []).map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}
        </select>
        <select name="type" required className="rounded-lg border border-black/15 px-3 py-2 text-sm">
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <input name="category" placeholder="Category (rent, mortgage, repairs...)" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="amount" type="number" placeholder="Amount" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="date" type="date" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <input name="description" placeholder="Description (optional)" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
        <button type="submit" className="col-span-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white md:col-span-1">Add transaction</button>
      </form>

      <h2 className="mb-2 text-lg font-medium">P&amp;L by property</h2>
      <div className="mb-8 table-shell">
        <table>
          <thead><tr><th>Property</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead>
          <tbody>
            {Array.from(byProperty.entries()).map(([address, v]) => (
              <tr key={address}>
                <td>{address}</td>
                <td className="text-emerald-700">${v.income.toLocaleString()}</td>
                <td className="text-red-700">${v.expense.toLocaleString()}</td>
                <td>${(v.income - v.expense).toLocaleString()}</td>
              </tr>
            ))}
            {byProperty.size === 0 && <tr><td colSpan={4} className="py-6 text-center text-black/40">No transactions yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg font-medium">Recent transactions</h2>
      <div className="table-shell">
        <table>
          <thead><tr><th>Date</th><th>Property</th><th>Type</th><th>Category</th><th>Amount</th></tr></thead>
          <tbody>
            {(transactions ?? []).map((t: any) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>{t.properties?.address ?? "—"}</td>
                <td><span className="badge bg-black/5">{t.type}</span></td>
                <td>{t.category}</td>
                <td className={t.type === "income" ? "text-emerald-700" : "text-red-700"}>
                  {t.type === "income" ? "+" : "-"}${Number(t.amount).toLocaleString()}
                </td>
              </tr>
            ))}
            {(!transactions || transactions.length === 0) && <tr><td colSpan={5} className="py-6 text-center text-black/40">No transactions logged yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
