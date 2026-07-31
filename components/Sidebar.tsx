import Link from "next/link";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/deals", label: "Acquisition" },
  { href: "/properties", label: "Properties" },
  { href: "/renovations", label: "Renovations" },
  { href: "/contractors", label: "Contractors" },
  { href: "/rentals", label: "Rentals" },
  { href: "/financials", label: "Financials" },
];

export default function Sidebar({ roleLabel }: { roleLabel?: string }) {
  return (
    <aside className="flex h-screen w-56 flex-col justify-between border-r border-black/10 bg-white px-4 py-6">
      <div>
        <div className="mb-8 px-2 text-lg font-semibold tracking-tight">
          REI HQ
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-black/70 hover:bg-black/5 hover:text-black"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {roleLabel && (
        <div className="px-2 text-xs text-black/40">Signed in as {roleLabel}</div>
      )}
    </aside>
  );
}
