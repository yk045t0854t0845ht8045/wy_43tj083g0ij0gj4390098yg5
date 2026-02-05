import type { ReactNode } from "react";
import {
  Archive,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  CreditCard,
  HelpCircle,
  LayoutGrid,
  Mail,
  Megaphone,
  MoreVertical,
  Package,
  PanelLeftClose,
  RefreshCcw,
  Settings,
  Store,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

function BrandMark() {
  return (
    <div className="grid h-10 w-10 grid-cols-2 gap-1.5 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/5">
      <span className="h-full w-full rounded-full bg-orange-500" />
      <span className="h-full w-full rounded-full bg-orange-500/85" />
      <span className="h-full w-full rounded-full bg-orange-500/85" />
      <span className="h-full w-full rounded-full bg-orange-500" />
    </div>
  );
}

function Badge({ value }: { value: number }) {
  return (
    <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
      {value}
    </span>
  );
}

function Row({
  icon,
  label,
  active,
  trailing,
  dense,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  trailing?: ReactNode;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-4",
        dense ? "py-2" : "py-2.5",
        active
          ? "bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)] ring-1 ring-black/5"
          : "bg-transparent",
      )}
    >
      <span className="flex h-6 w-6 items-center justify-center text-black/60">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] text-black/75">
        {label}
      </span>
      {trailing}
    </div>
  );
}

function SubRow({
  icon,
  label,
  badge,
}: {
  icon: ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <div className="flex w-full items-center gap-2 rounded-2xl px-3 py-2">
      <span className="flex h-6 w-6 items-center justify-center text-black/55">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] text-black/70">
        {label}
      </span>
      {typeof badge === "number" && <Badge value={badge} />}
      <ChevronRight className="h-4 w-4 text-black/35" />
    </div>
  );
}

function deriveNameFromEmail(email: string) {
  const base = String(email || "").split("@")[0] || "";
  const cleaned = base.replace(/[^a-z0-9]+/gi, " ").trim();
  if (!cleaned) return "Hugh Middity";
  return cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(" ");
}

function truncateEmail(email: string) {
  const e = String(email || "");
  if (!e) return "hughmiddity@email.com";
  if (e.length <= 22) return e;
  return e.slice(0, 18) + "...";
}

export default function DashboardSidebar({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  void userId;

  const name = deriveNameFromEmail(email);
  const emailShort = truncateEmail(email);

  return (
    <aside className="flex h-dvh w-[320px] max-w-full flex-col border-r border-black/10 bg-[#f4f4f5]">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div className="min-w-0 flex-1 truncate text-[16px] font-semibold text-black/80">
            Random State
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-black/55"
            aria-label="Collapse"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mt-4">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 21l-4.3-4.3" />
            <circle cx="11" cy="11" r="7" />
          </svg>
          <input
            type="search"
            placeholder="Search"
            className={cn(
              "h-12 w-full rounded-2xl border border-black/10 bg-white px-11 text-[15px] text-black/80",
              "placeholder:text-black/35",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10",
            )}
          />
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3">
        <div className="space-y-1">
          <Row
            icon={<LayoutGrid className="h-[18px] w-[18px]" />}
            label="Dashboard"
          />
          <Row
            icon={<BarChart3 className="h-[18px] w-[18px]" />}
            label="Analytics"
            active
          />
          <Row
            icon={<BriefcaseBusiness className="h-[18px] w-[18px]" />}
            label="Projects"
          />
          <Row
            icon={<CalendarDays className="h-[18px] w-[18px]" />}
            label="Calendar"
          />

          <div className="pt-2" />

          <Row
            icon={<Mail className="h-[18px] w-[18px]" />}
            label="Messages"
            trailing={<ChevronUp className="h-4 w-4 text-black/35" />}
          />

          <div className="ml-7 border-l border-black/10 pl-4">
            <SubRow
              icon={<LayoutGrid className="h-4 w-4" />}
              label="All"
            />
            <SubRow icon={<Mail className="h-4 w-4" />} label="Unread" badge={12} />
            <SubRow
              icon={<Megaphone className="h-4 w-4" />}
              label="Updates"
            />
            <SubRow
              icon={<Archive className="h-4 w-4" />}
              label="Archived"
            />
          </div>

          <div className="pt-1" />

          <Row
            icon={<Bell className="h-[18px] w-[18px]" />}
            label="Notifications"
            trailing={<Badge value={4} />}
          />

          <div className="my-3 h-px bg-black/10" />

          <div className="flex items-center justify-between px-4 py-2">
            <div className="text-[11px] font-semibold tracking-wider text-black/35">
              ACCOUNT
            </div>
            <MoreVertical className="h-4 w-4 text-black/30" />
          </div>

          <Row icon={<Store className="h-[18px] w-[18px]" />} label="My Store" />
          <Row
            icon={<CreditCard className="h-[18px] w-[18px]" />}
            label="Billing"
          />
          <Row
            icon={<Package className="h-[18px] w-[18px]" />}
            label="Orders"
          />
          <Row
            icon={<RefreshCcw className="h-[18px] w-[18px]" />}
            label="Subscriptions"
          />

          <div className="pt-2" />

          <Row
            icon={<Settings className="h-[18px] w-[18px]" />}
            label="Settings"
          />
          <Row
            icon={<HelpCircle className="h-[18px] w-[18px]" />}
            label="Support"
          />
        </div>

        <div className="mt-auto px-2 pt-4">
          <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-3 py-3 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/5">
              <User className="h-5 w-5 text-black/45" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-black/80">
                {name}
              </div>
              <div className="truncate text-[12px] text-black/45">
                {emailShort}
              </div>
            </div>

            <ChevronsUpDown className="h-5 w-5 text-black/35" />
          </div>
        </div>
      </div>
    </aside>
  );
}
