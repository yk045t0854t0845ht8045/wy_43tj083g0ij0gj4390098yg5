// app/(dashboard)/_components/sidebar.tsx
"use client";

import React, { useMemo, useState } from "react";

type MainItemId =
  | "home"
  | "transactions"
  | "catalog"
  | "customers"
  | "content"
  | "analytics"
  | "campaigns"
  | "discounts";

type SubItemId = "orders" | "drafts" | "shipping" | "abandoned";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ─────────────────────────────────────────────────────────────────────────────
   Icons (leve, fino, estilo igual do print)
   ───────────────────────────────────────────────────────────────────────────── */

function Icon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="w-[18px] h-[18px] inline-flex items-center justify-center text-black/70">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-[18px] h-[18px]"
      >
        {children}
      </svg>
    </span>
  );
}

function IHome() {
  return (
    <Icon>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10.8V20h13V10.8" />
    </Icon>
  );
}

function ITransactions() {
  return (
    <Icon>
      <rect x="4.5" y="6.5" width="15" height="13" rx="2" />
      <path d="M7.5 10h9" />
      <path d="M7.5 14h6.5" />
    </Icon>
  );
}

function ICatalog() {
  return (
    <Icon>
      <path d="M12 3 20 7v10l-8 4-8-4V7l8-4Z" />
      <path d="M12 3v18" />
      <path d="M20 7l-8 4-8-4" />
    </Icon>
  );
}

function ICustomers() {
  return (
    <Icon>
      <path d="M16 11a4 4 0 1 0-8 0" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Icon>
  );
}

function IContent() {
  return (
    <Icon>
      <rect x="4.5" y="5.5" width="15" height="13" rx="2" />
      <path d="M8 9h8" />
      <path d="M8 12.5h6" />
    </Icon>
  );
}

function IAnalytics() {
  return (
    <Icon>
      <path d="M12 6v6l4 2" />
      <circle cx="12" cy="12" r="8" />
    </Icon>
  );
}

function ICampaigns() {
  return (
    <Icon>
      <path d="M4.5 12h4l10-5v10l-10-5h-4Z" />
      <path d="M8.5 14.5v3" />
    </Icon>
  );
}

function IDiscounts() {
  return (
    <Icon>
      <path d="M20 12 12 20 4 12V4h8l8 8Z" />
      <path d="M7.5 7.5h.01" />
    </Icon>
  );
}

function IStore() {
  return (
    <Icon>
      <path d="M4.5 9 6.2 5.5h11.6L19.5 9" />
      <path d="M5.5 9v10.5h13V9" />
      <path d="M9 19.5V13h6v6.5" />
    </Icon>
  );
}

function IPOS() {
  return (
    <Icon>
      <rect x="5" y="6.5" width="14" height="12.5" rx="2" />
      <path d="M8 10h8" />
      <path d="M8 13.5h4.5" />
      <path d="M8 17h8" />
    </Icon>
  );
}

function IShop() {
  return (
    <Icon>
      <rect x="6" y="7" width="12" height="13" rx="2" />
      <path d="M9 7V5.5A3 3 0 0 1 12 3a3 3 0 0 1 3 2.5V7" />
    </Icon>
  );
}

function ProjectIcon() {
  return (
    <span className="inline-flex w-[22px] h-[22px] items-center justify-center rounded-md bg-black/90 text-white">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 7h10v10H7z" />
      </svg>
    </span>
  );
}

function ChevronsUpDown() {
  return (
    <span className="inline-flex items-center justify-center text-black/55">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m7 10 5-5 5 5" />
        <path d="m7 14 5 5 5-5" />
      </svg>
    </span>
  );
}

function CaretDown({ open }: { open: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center text-black/55 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        open && "rotate-180"
      )}
      aria-hidden="true"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}

/* ───────────────────────────────────────────────────────────────────────────── */

type Props = {
  activeMain?: MainItemId;
  activeSub?: SubItemId;
};

export default function Sidebar({
  activeMain = "transactions",
  activeSub = "orders",
}: Props) {
  const [transactionsOpen, setTransactionsOpen] = useState(true);

  const main = useMemo(
    () => [
      { id: "home" as const, label: "Home", icon: <IHome /> },
      { id: "transactions" as const, label: "Transactions", icon: <ITransactions /> },
      { id: "catalog" as const, label: "Catalog", icon: <ICatalog /> },
      { id: "customers" as const, label: "Customers", icon: <ICustomers /> },
      { id: "content" as const, label: "Content", icon: <IContent /> },
      { id: "analytics" as const, label: "Analytics", icon: <IAnalytics /> },
      { id: "campaigns" as const, label: "Campaigns", icon: <ICampaigns /> },
      { id: "discounts" as const, label: "Discounts", icon: <IDiscounts /> },
    ],
    []
  );

  const sub = useMemo(
    () => [
      { id: "orders" as const, label: "Orders" },
      { id: "drafts" as const, label: "Drafts" },
      { id: "shipping" as const, label: "Shipping labels" },
      { id: "abandoned" as const, label: "Abandoned checkouts" },
    ],
    []
  );

  const channels = useMemo(
    () => [
      { id: "online-store", label: "Online Store", icon: <IStore /> },
      { id: "retail-pos", label: "Retail POS", icon: <IPOS /> },
      { id: "shop", label: "Shop", icon: <IShop /> },
    ],
    []
  );

  return (
    <aside className="w-[308px] min-h-screen bg-[#f6f6f7] text-black">
      <div className="px-4 pt-4">
        {/* Project selector */}
        <button
          type="button"
          className={cx(
            "w-full h-[44px] rounded-xl bg-white",
            "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
            "flex items-center justify-between px-3",
            "transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.995]"
          )}
        >
          <span className="flex items-center gap-3">
            <ProjectIcon />
            <span className="font-semibold text-[16px] tracking-[-0.01em]">
              My Project
            </span>
          </span>
          <ChevronsUpDown />
        </button>

        {/* dashed divider */}
        <div className="mt-4 border-t border-dashed border-black/15" />
      </div>

      {/* Menu */}
      <nav className="mt-2 px-2">
        <ul className="space-y-[2px]">
          {/* Home */}
          <li>
            <button
              type="button"
              className={cx(
                "w-full h-[44px] rounded-xl",
                "flex items-center gap-3 px-3",
                "text-[16px] font-medium",
                "text-black/90 hover:bg-black/[0.04]",
                "transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              )}
            >
              <IHome />
              <span>Home</span>
            </button>
          </li>

          {/* Transactions (accordion) */}
          <li>
            <button
              type="button"
              onClick={() => setTransactionsOpen((v) => !v)}
              className={cx(
                "w-full h-[44px] rounded-xl",
                "flex items-center justify-between px-3",
                "text-[16px] font-medium",
                "text-black/90 hover:bg-black/[0.04]",
                "transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              )}
              aria-expanded={transactionsOpen}
            >
              <span className="flex items-center gap-3">
                <ITransactions />
                <span>Transactions</span>
              </span>

              <CaretDown open={transactionsOpen} />
            </button>

            {/* Submenu */}
            <div
              className={cx(
                "overflow-hidden",
                "transition-[max-height,opacity,transform] duration-350 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                transactionsOpen
                  ? "max-h-[320px] opacity-100 translate-y-0"
                  : "max-h-0 opacity-0 -translate-y-[4px]"
              )}
            >
              <div className="relative pl-[46px] pr-2 py-1">
                {/* dashed vertical guide */}
                <div
                  className={cx(
                    "absolute left-[24px] top-[8px] bottom-[8px]",
                    "border-l border-dashed border-black/20",
                    transactionsOpen ? "opacity-100" : "opacity-0"
                  )}
                />

                <ul className="space-y-[2px]">
                  {sub.map((it) => {
                    const isActive = activeMain === "transactions" && activeSub === it.id;

                    return (
                      <li key={it.id} className="relative">
                        {/* active black bar (replaces dashed for this row) */}
                        <span
                          className={cx(
                            "absolute left-[21px] top-1/2 -translate-y-1/2",
                            "h-[26px] w-[3px] rounded-full",
                            isActive ? "bg-black" : "bg-transparent"
                          )}
                          aria-hidden="true"
                        />

                        <button
                          type="button"
                          className={cx(
                            "w-full h-[42px] rounded-xl",
                            "flex items-center",
                            "px-3 text-[16px] font-semibold tracking-[-0.01em]",
                            "text-black/90",
                            isActive ? "bg-black/[0.06]" : "hover:bg-black/[0.04]",
                            "transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                          )}
                        >
                          {it.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </li>

          {/* Rest (as in image) */}
          <li>
            <button
              type="button"
              className={cx(
                "w-full h-[44px] rounded-xl",
                "flex items-center gap-3 px-3",
                "text-[16px] font-medium text-black/90 hover:bg-black/[0.04]",
                "transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              )}
            >
              <ICatalog />
              <span>Catalog</span>
            </button>
          </li>

          <li>
            <button
              type="button"
              className={cx(
                "w-full h-[44px] rounded-xl",
                "flex items-center gap-3 px-3",
                "text-[16px] font-medium text-black/90 hover:bg-black/[0.04]",
                "transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              )}
            >
              <ICustomers />
              <span>Customers</span>
            </button>
          </li>

          <li>
            <button
              type="button"
              className={cx(
                "w-full h-[44px] rounded-xl",
                "flex items-center gap-3 px-3",
                "text-[16px] font-medium text-black/90 hover:bg-black/[0.04]",
                "transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              )}
            >
              <IContent />
              <span>Content</span>
            </button>
          </li>

          <li>
            <button
              type="button"
              className={cx(
                "w-full h-[44px] rounded-xl",
                "flex items-center gap-3 px-3",
                "text-[16px] font-medium text-black/90 hover:bg-black/[0.04]",
                "transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              )}
            >
              <IAnalytics />
              <span>Analytics</span>
            </button>
          </li>

          <li>
            <button
              type="button"
              className={cx(
                "w-full h-[44px] rounded-xl",
                "flex items-center gap-3 px-3",
                "text-[16px] font-medium text-black/90 hover:bg-black/[0.04]",
                "transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              )}
            >
              <ICampaigns />
              <span>Campaigns</span>
            </button>
          </li>

          <li>
            <button
              type="button"
              className={cx(
                "w-full h-[44px] rounded-xl",
                "flex items-center gap-3 px-3",
                "text-[16px] font-medium text-black/90 hover:bg-black/[0.04]",
                "transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              )}
            >
              <IDiscounts />
              <span>Discounts</span>
            </button>
          </li>
        </ul>

        {/* Channels section */}
        <div className="mt-6 px-2">
          <div className="px-2 py-2 text-[13px] font-semibold tracking-[0.08em] text-black/45">
            CHANNELS
          </div>

          <ul className="space-y-[2px]">
            {channels.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={cx(
                    "w-full h-[44px] rounded-xl",
                    "flex items-center gap-3 px-3",
                    "text-[16px] font-medium text-black/90 hover:bg-black/[0.04]",
                    "transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                  )}
                >
                  {c.icon}
                  <span>{c.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  );
}
