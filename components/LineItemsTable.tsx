"use client";

import { useMemo, useState } from "react";

interface LineItem {
  id: string;
  expense_date: string | null;
  category: string;
  vendor: string | null;
  description: string | null;
  budgeted_amount: number;
  actual_amount: number;
  payment_method: string | null;
  paid_by: string | null;
  notes: string | null;
  contractor_id: string | null;
  status: string;
}

interface Contractor {
  id: string;
  company_name: string;
}

interface Bid {
  id: string;
  line_item_id: string;
  contractor_id: string;
  amount: number;
  status: string;
  contractors?: { company_name: string };
}

interface LineItemDocument {
  id: string;
  line_item_id: string | null;
  doc_type: string;
  file_url: string;
  file_name: string | null;
  caption: string | null;
}

// Same palette used on the schedule Gantt chart, so a category reads as the
// same color everywhere in the app.
const CATEGORY_PALETTE = [
  "#2f6b4f", // accent green
  "#b5651d", // clay
  "#3a5a9b", // blue
  "#8a3ab2", // purple
  "#b23a5a", // rose
  "#4a7a8a", // teal
  "#8a7a3a", // olive
  "#7a3a3a", // brick
];

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

type Filters = {
  dateFrom: string;
  dateTo: string;
  vendor: string;
  description: string;
  budgetMin: string;
  budgetMax: string;
  amountMin: string;
  amountMax: string;
  paymentMethod: string;
  paidBy: string;
  notes: string;
};

const EMPTY_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  vendor: "",
  description: "",
  budgetMin: "",
  budgetMax: "",
  amountMin: "",
  amountMax: "",
  paymentMethod: "",
  paidBy: "",
  notes: "",
};

export default function LineItemsTable({
  lineItems,
  contractors,
  bids,
  documents,
  updateLineItemDetails,
  acceptBid,
  uploadLineItemInvoice,
  deleteLineItemDocument,
}: {
  lineItems: LineItem[];
  contractors: Contractor[];
  bids: Bid[];
  documents: LineItemDocument[];
  updateLineItemDetails: (formData: FormData) => void;
  acceptBid: (formData: FormData) => void;
  uploadLineItemInvoice: (formData: FormData) => void;
  deleteLineItemDocument: (formData: FormData) => void;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  // Categories explicitly unchecked by the user — empty set means "show all".
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  const categories = useMemo(
    () => Array.from(new Set(lineItems.map((li) => li.category))).sort(),
    [lineItems]
  );
  const colorByCategory = useMemo(
    () => new Map(categories.map((c, i) => [c, CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]])),
    [categories]
  );
  const paymentMethods = useMemo(
    () => Array.from(new Set(lineItems.map((li) => li.payment_method).filter(Boolean))).sort() as string[],
    [lineItems]
  );
  const paidByOptions = useMemo(
    () => Array.from(new Set(lineItems.map((li) => li.paid_by).filter(Boolean))).sort() as string[],
    [lineItems]
  );

  const bidsByLineItem = useMemo(() => {
    const m = new Map<string, Bid[]>();
    bids.forEach((b) => {
      const arr = m.get(b.line_item_id) ?? [];
      arr.push(b);
      m.set(b.line_item_id, arr);
    });
    return m;
  }, [bids]);

  const documentsByLineItem = useMemo(() => {
    const m = new Map<string, LineItemDocument[]>();
    documents.forEach((d) => {
      if (!d.line_item_id) return;
      const arr = m.get(d.line_item_id) ?? [];
      arr.push(d);
      m.set(d.line_item_id, arr);
    });
    return m;
  }, [documents]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function toggleCategory(cat: string) {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const filtered = useMemo(() => {
    return lineItems.filter((li) => {
      if (hiddenCategories.has(li.category)) return false;
      if (filters.dateFrom && (!li.expense_date || li.expense_date < filters.dateFrom)) return false;
      if (filters.dateTo && (!li.expense_date || li.expense_date > filters.dateTo)) return false;
      if (filters.vendor && !(li.vendor ?? "").toLowerCase().includes(filters.vendor.toLowerCase())) return false;
      if (
        filters.description &&
        !(li.description ?? "").toLowerCase().includes(filters.description.toLowerCase())
      )
        return false;
      if (filters.budgetMin && Number(li.budgeted_amount ?? 0) < Number(filters.budgetMin)) return false;
      if (filters.budgetMax && Number(li.budgeted_amount ?? 0) > Number(filters.budgetMax)) return false;
      if (filters.amountMin && Number(li.actual_amount ?? 0) < Number(filters.amountMin)) return false;
      if (filters.amountMax && Number(li.actual_amount ?? 0) > Number(filters.amountMax)) return false;
      if (filters.paymentMethod && li.payment_method !== filters.paymentMethod) return false;
      if (filters.paidBy && li.paid_by !== filters.paidBy) return false;
      if (filters.notes && !(li.notes ?? "").toLowerCase().includes(filters.notes.toLowerCase())) return false;
      return true;
    });
  }, [lineItems, filters, hiddenCategories]);

  const filteredTotal = filtered.reduce((s, li) => s + Number(li.actual_amount ?? 0), 0);
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) || hiddenCategories.size > 0;

  const inputCls = "w-full rounded-md border border-black/10 bg-black/[0.02] px-2 py-1 text-xs";

  return (
    <div>
      {categories.length > 0 && (
        <div className="mb-3 rounded-xl border border-black/10 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-black/50">Show categories:</span>
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={() => setHiddenCategories(new Set())} className="text-accent underline">
                Show all
              </button>
              <button
                type="button"
                onClick={() => setHiddenCategories(new Set(categories))}
                className="text-accent underline"
              >
                Hide all
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {categories.map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={!hiddenCategories.has(c)}
                  onChange={() => toggleCategory(c)}
                  className="h-3.5 w-3.5 accent-black/70"
                />
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorByCategory.get(c) }} />
                <span className={hiddenCategories.has(c) ? "text-black/40" : "text-black/70"}>{c}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs text-black/50">
          Showing {filtered.length} of {lineItems.length} {filtersActive ? "(filtered)" : ""}
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setHiddenCategories(new Set());
            }}
            className="text-xs text-accent underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mb-8 table-shell">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Vendor</th>
              <th>Description</th>
              <th>Budgeted</th>
              <th>Amount</th>
              <th>Payment method</th>
              <th>Paid by</th>
              <th>Notes</th>
              <th></th>
            </tr>
            <tr>
              <th className="p-1">
                <div className="flex flex-col gap-0.5">
                  <input type="date" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} className={inputCls} />
                  <input type="date" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} className={inputCls} />
                </div>
              </th>
              <th className="p-1 text-center text-[10px] text-black/30">see above</th>
              <th className="p-1">
                <input placeholder="Search…" value={filters.vendor} onChange={(e) => setFilter("vendor", e.target.value)} className={inputCls} />
              </th>
              <th className="p-1">
                <input placeholder="Search…" value={filters.description} onChange={(e) => setFilter("description", e.target.value)} className={inputCls} />
              </th>
              <th className="p-1">
                <div className="flex gap-0.5">
                  <input type="number" placeholder="Min" value={filters.budgetMin} onChange={(e) => setFilter("budgetMin", e.target.value)} className={inputCls} />
                  <input type="number" placeholder="Max" value={filters.budgetMax} onChange={(e) => setFilter("budgetMax", e.target.value)} className={inputCls} />
                </div>
              </th>
              <th className="p-1">
                <div className="flex gap-0.5">
                  <input type="number" placeholder="Min" value={filters.amountMin} onChange={(e) => setFilter("amountMin", e.target.value)} className={inputCls} />
                  <input type="number" placeholder="Max" value={filters.amountMax} onChange={(e) => setFilter("amountMax", e.target.value)} className={inputCls} />
                </div>
              </th>
              <th className="p-1">
                <select value={filters.paymentMethod} onChange={(e) => setFilter("paymentMethod", e.target.value)} className={inputCls}>
                  <option value="">All</option>
                  {paymentMethods.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </th>
              <th className="p-1">
                <select value={filters.paidBy} onChange={(e) => setFilter("paidBy", e.target.value)} className={inputCls}>
                  <option value="">All</option>
                  {paidByOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </th>
              <th className="p-1">
                <input placeholder="Search…" value={filters.notes} onChange={(e) => setFilter("notes", e.target.value)} className={inputCls} />
              </th>
              <th className="p-1"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((li) => {
              const itemOver = Number(li.actual_amount) > Number(li.budgeted_amount) && Number(li.budgeted_amount) > 0;
              const itemBids = bidsByLineItem.get(li.id) ?? [];
              const itemDocs = documentsByLineItem.get(li.id) ?? [];
              const catColor = colorByCategory.get(li.category) ?? "#64748b";
              return (
                <>
                  <tr key={li.id} style={{ borderLeft: `3px solid ${catColor}` }}>
                    <td>{li.expense_date ?? "—"}</td>
                    <td>
                      <span className="badge" style={{ backgroundColor: catColor + "1a", color: catColor }}>
                        {li.category}
                      </span>
                    </td>
                    <td>{li.vendor ?? "—"}</td>
                    <td>{li.description ?? "—"}</td>
                    <td>{li.budgeted_amount > 0 ? money(li.budgeted_amount) : "—"}</td>
                    <td className={itemOver ? "font-medium text-red-700" : Number(li.actual_amount) < 0 ? "font-medium text-emerald-700" : ""}>
                      {money(li.actual_amount)}
                    </td>
                    <td>{li.payment_method ?? "—"}</td>
                    <td>{li.paid_by ?? "—"}</td>
                    <td className="text-xs text-black/60">{li.notes ?? "—"}</td>
                    <td className="text-xs text-black/40">{itemDocs.length > 0 ? `📎 ${itemDocs.length}` : ""}</td>
                  </tr>
                  <tr key={li.id + "-edit"}>
                    <td colSpan={10} className="bg-black/[0.02] px-4 py-2">
                      <details>
                        <summary className="cursor-pointer text-xs text-accent underline">Edit line item</summary>
                        <form action={updateLineItemDetails} className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-6">
                          <input type="hidden" name="line_item_id" value={li.id} />
                          <input name="expense_date" type="date" defaultValue={li.expense_date ?? ""} className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
                          <input name="category" defaultValue={li.category} required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
                          <input name="vendor" defaultValue={li.vendor ?? ""} placeholder="Vendor" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
                          <input name="description" defaultValue={li.description ?? ""} placeholder="Description" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
                          <input name="budgeted_amount" type="number" defaultValue={li.budgeted_amount ?? ""} placeholder="Budgeted $" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
                          <input name="actual_amount" type="number" defaultValue={li.actual_amount ?? ""} placeholder="Amount $" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
                          <input name="payment_method" defaultValue={li.payment_method ?? ""} placeholder="Payment method" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
                          <input name="paid_by" defaultValue={li.paid_by ?? ""} placeholder="Paid by" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
                          <select name="contractor_id" defaultValue={li.contractor_id ?? ""} className="rounded-lg border border-black/15 px-3 py-2 text-sm">
                            <option value="">Contractor (optional)...</option>
                            {contractors.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                          </select>
                          <select name="status" defaultValue={li.status} className="rounded-lg border border-black/15 px-3 py-2 text-sm">
                            <option value="not_started">Not started</option>
                            <option value="in_progress">In progress</option>
                            <option value="complete">Complete</option>
                          </select>
                          <input name="notes" defaultValue={li.notes ?? ""} placeholder="Notes" className="col-span-2 rounded-lg border border-black/15 px-3 py-2 text-sm" />
                          <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Save changes</button>
                        </form>
                      </details>
                    </td>
                  </tr>
                  <tr key={li.id + "-invoices"}>
                    <td colSpan={10} className="bg-black/[0.02] px-4 py-2">
                      <details>
                        <summary className="cursor-pointer text-xs text-accent underline">
                          Invoices {itemDocs.length > 0 ? `(${itemDocs.length})` : ""}
                        </summary>
                        <div className="mt-3 flex flex-col gap-3">
                          {itemDocs.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {itemDocs.map((d) => (
                                <div key={d.id} className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs">
                                  <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                                    📎 {d.file_name ?? "View file"}
                                  </a>
                                  {d.caption && <span className="text-black/40">— {d.caption}</span>}
                                  <form action={deleteLineItemDocument}>
                                    <input type="hidden" name="document_id" value={d.id} />
                                    <button type="submit" className="text-black/40 underline hover:text-red-700">Remove</button>
                                  </form>
                                </div>
                              ))}
                            </div>
                          )}
                          <form action={uploadLineItemInvoice} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="line_item_id" value={li.id} />
                            <input name="file" type="file" accept="image/*,.pdf" required className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
                            <input name="caption" placeholder="Caption (optional)" className="rounded-lg border border-black/15 px-3 py-2 text-sm" />
                            <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">Upload invoice</button>
                          </form>
                        </div>
                      </details>
                    </td>
                  </tr>
                  {itemBids.length > 0 && (
                    <tr key={li.id + "-bids"}>
                      <td colSpan={10} className="bg-black/[0.02] px-4 py-2">
                        <div className="mb-1 text-xs font-medium text-black/50">Bids for {li.category}</div>
                        <div className="flex flex-wrap gap-2">
                          {itemBids.map((b) => (
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-black/40">
                  {lineItems.length === 0 ? "No line items yet." : "No line items match these filters."}
                </td>
              </tr>
            )}
            {filtered.length > 0 && (
              <tr className="border-t-2 border-black/20 font-semibold">
                <td colSpan={5} className="text-right">Total expenses{filtersActive ? " (filtered)" : ""}</td>
                <td>{money(filteredTotal)}</td>
                <td colSpan={4}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
