"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Inbox" },
  { href: "/dashboard/overview", label: "Overview" },
  { href: "/dashboard/bookings", label: "New Bookings" },
  { href: "/dashboard/experiences", label: "Experiences" },
  { href: "/dashboard/tasks", label: "Follow-ups" },
  { href: "/dashboard/vendors", label: "Vendors" },
  { href: "/dashboard/properties", label: "Property Guide" },
] as const;

/** Keeps the primary workspace sections easy to reach from every dashboard page. */
export default function DashboardNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="GuestOpsHQ workspace"
      style={{
        display: "flex",
        gap: 3,
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: 22,
        padding: 5,
        border: "1px solid #d9e3ee",
        borderRadius: 12,
        background: "#f6f9fc",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.9)",
      }}
    >
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            href={link.href}
            key={link.href}
            aria-current={active ? "page" : undefined}
            style={{
              padding: "7px 9px",
              borderRadius: 8,
              color: active ? "#0f3d75" : "#334155",
              background: active ? "#fff" : "transparent",
              boxShadow: active ? "0 1px 2px rgba(15, 23, 42, 0.10)" : "none",
              fontSize: 13,
              fontWeight: active ? 650 : 550,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
