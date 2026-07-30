import { createClient } from "@/lib/supabase/server";

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function DashboardPage() {
  const supabase = createClient();

  const [
    { data: properties },
    { data: activeDeals },
    { data: renoProjects },
    { data: leases },
    { data: transactions },
  ] = await Promise.all([
    supabase.from("properties").select("id, status, current_value_estimate"),
    supabase.from("deals").select("id, stage").not("stage", "in", "(closed_won,closed_lost)"),
    supabase.from("renovation_projects").select("id, status, budget_total"),
    supabase.from("leases").select("id, status, monthly_rent"),
    supabase.from("transactions").select("type, amount, date"),
  ]);

  const totalProperties = properties?.length ?? 0;
  const portfolioValue = (properties ?? []).reduce((sum, p) => sum + (p.current_value_estimate ?? 0), 0);
  const activeRenoCount = (renoProjects ?? []).filter((p) => p.status === "in_progress").length;
  const activeLeases = (leases ?? []).filter((l) => l.status === "active");
  const monthlyRentRoll = activeLeases.reduce((sum, l) => sum + (l.monthly_rent ?? 0), 0);
  const occupiedUnits = activeLeases.length;
  const vacantUnits = Math.max(totalProperties - occupiedUnits, 0);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTx = (transactions ?? []).filter((t) => t.date?.startsWith(thisMonth));
  const monthIncome = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const monthExpense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Portfolio dashboard</h1>
      <p className="mb-8 text-sm text-black/60">A snapshot of everything you own, are renovating, and are renting out.</p>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="stat-card">
          <div className="text-xs text-black/50">Properties</div>
          <div className="mt-1 text-2xl font-semibold">{totalProperties}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">Est. portfolio value</div>
          <div className="mt-1 text-2xl font-semibold">{money(portfolioValue)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">Active renovations</div>
          <div className="mt-1 text-2xl font-semibold">{activeRenoCount}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">Open deals in pipeline</div>
          <div className="mt-1 text-2xl font-semibold">{activeDeals?.length ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">Occupied / vacant units</div>
          <div className="mt-1 text-2xl font-semibold">{occupiedUnits} / {vacantUnits}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">Monthly rent roll</div>
          <div className="mt-1 text-2xl font-semibold">{money(monthlyRentRoll)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">This month's income</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700">{money(monthIncome)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-black/50">This month's expenses</div>
          <div className="mt-1 text-2xl font-semibold text-red-700">{money(monthExpense)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-5 text-sm text-black/60">
        Use the left nav to work the deal pipeline, track renovation budgets against actuals,
        manage tenants and rent collection, and log income/expenses per property. Every module
        writes to the same Supabase database, so this dashboard updates automatically.
      </div>
    </div>
  );
}
