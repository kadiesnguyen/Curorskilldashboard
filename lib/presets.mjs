/** One-click rule presets for common project types. */

export const PRESETS = [
  {
    id: 'admin-cms',
    name: 'Admin CMS',
    icon: '▣',
    summary: 'Sidebar ops UI, tables → cards mobile, enterprise components',
    suggestedProjects: ['ishineproject', 'vbpcrm', 'vbpgocrm', 'viet-erp'],
    rule: {
      id: 'layout-admin-cms',
      filename: 'layout-admin-cms.mdc',
      description: 'Admin/CMS layout — sidebar, tables, filter toolbar, enterprise UI',
      alwaysApply: true,
      globs: null,
      body: `# Admin / CMS layout standards

Apply when building **staff/admin** dashboards (spa-ishine, Vitapro CMS, VBPCRM, …).

## Page shell

- \`min-h-dvh w-full max-w-full overflow-x-hidden bg-gray-50\`
- White header strip: \`border-b border-gray-200 bg-white px-4 py-3\`
- Never \`100vw\` on page root — use \`w-full max-w-full\`

## Layout

| Area | Desktop | Mobile (<768px) |
|------|---------|-----------------|
| Sidebar | 240–300px fixed | Drawer or collapsed icon rail |
| Content | Fluid, cards on gray canvas | Single column, no horizontal scroll |
| Tables | Fixed columns, \`table-fixed\` | **Card list** via responsive table pattern |

## Components

- Cards: consistent padding \`p-4\` / \`p-5\`, \`rounded-lg\`, soft shadow
- Filter toolbar: \`flex flex-wrap gap-3 md:flex-nowrap\`
- Filter select: min-width 180px, height 44px, chevron not overlapping text
- Buttons: primary actions \`rounded-lg\`, height 40–44px
- States: loading / empty / error components — never blank screens

## Data tables

- Column widths as **% totaling 100%** — no horizontal scroll on desktop lists
- Long cell text: \`min-w-0 truncate\` or \`break-words\`
- Pagination when >100 rows

## Before UI work

1. Read \`DESIGN.md\` at repo root if present
2. Reuse shared enterprise/Hydrogen components — no one-off MUI on migrated screens
3. Menu routes must match \`pages/\` paths and permission routes

## Do not

- Extend legacy MUI on already-migrated modules
- Marketing-style hero blocks on operational screens
- Random spacing/font sizes outside 4–48px scale`,
    },
  },
  {
    id: 'tmdt',
    name: 'TMDT + Đặt lịch',
    icon: '◇',
    summary: 'E-commerce + booking, account tabs, herbal/clean aesthetic',
    suggestedProjects: ['ishineproject'],
    rule: {
      id: 'layout-tmdt',
      filename: 'layout-tmdt.mdc',
      description: 'E-commerce + spa booking layout — account, orders, appointments',
      alwaysApply: true,
      globs: '**/web-*/**/*.{tsx,jsx,vue}',
      body: `# TMDT + đặt lịch layout standards

Apply for **customer-facing** commerce/booking sites (web-vitadichvu, storefront, account pages).

## Visual tone

- Clean, airy, modern — herbal green + cream palette from \`DESIGN.md\`
- Professional e-commerce — not admin-heavy, not form-on-one-long-page

## Account / profile (\`/account/*\`)

- Container max-width **1180–1200px** centered
- Desktop: sidebar **260–300px** + main content
- Mobile: sidebar → **horizontal tab scroll** or select menu — no overflow at 375px
- Sections: Tổng quan, Thông tin, Địa chỉ, Đơn hàng, Lịch hẹn, Voucher, Yêu thích, Bảo mật
- Orders/appointments tables → **card list** on mobile

## Page structure

- Breadcrumb when site already has it: \`Trang chủ / Tài khoản\`
- One concern per tab — do not dump all forms on one scroll page
- Avatar + tên khách ở đầu sidebar; active item màu primary

## Product & booking flows

- Product grid: consistent card aspect, clear CTA, price hierarchy
- Booking: date/time picker accessible, confirmation summary before submit
- Empty states with next action (browse services, contact support)

## Responsive

- Mobile-first; test **375px** width
- \`min-w-0 break-words\` in flex children
- Touch targets min 44px

## Stack notes

- Prefer existing site components and \`DESIGN.md\` tokens
- Customer pages ≠ admin CMS — lighter chrome, no dense ops tables

## Do not

- Reuse admin sidebar density on customer account
- Horizontal scroll tables on mobile
- Hardcode colors — use design tokens only`,
    },
  },
  {
    id: 'storefront',
    name: 'Storefront',
    icon: '◈',
    summary: 'Marketing + shop — mobile/desktop layouts tách riêng khi cần',
    suggestedProjects: ['vbpgocrm', 'shopefy', 'shopify6'],
    rule: {
      id: 'layout-storefront',
      filename: 'layout-storefront.mdc',
      description: 'Storefront layout — marketing pages, separate mobile/desktop when required',
      alwaysApply: true,
      globs: null,
      body: `# Storefront layout standards

Apply for **public shop / marketing** experiences (storefront, landing, mobile app webview).

## Layout philosophy

- When product requires it: **mobile and desktop are different layouts**, not only responsive scale
- Breakpoint reference: **1024px** — below = mobile layout, above = desktop layout
- Each page may ship \`MobileX\` + \`DesktopX\` components when UX diverges materially

## Page shell

- Marketing: full-width heroes OK; content sections max-width ~1200px centered
- Shop listing: grid responsive 2-col mobile / 3–4 col desktop
- \`overflow-x-hidden\` on root — no sideways scroll at 375px

## Mobile storefront patterns

- Header: logo, search/cart icons, compact nav
- Bottom navigation for primary destinations when app-like
- Product cards: image top, title, price, badge stack
- Account hub: profile card, order shortcuts, utility grid — not admin sidebar

## Desktop storefront

- Top nav + optional mega menu
- Wider grids, inline filters, side cart drawer optional
- Footer with links, trust signals, contact

## Performance & UX

- Lazy-load below-fold images; explicit width/height to avoid CLS
- Skeleton loaders for product grids
- Sticky CTA on mobile product detail when appropriate

## Do not

- Shrink desktop layout with CSS scale and call it "mobile"
- Mix admin table patterns into storefront catalog
- Invent brand colors outside \`DESIGN.md\``,
    },
  },
  {
    id: 'persistent-memory',
    name: 'Persistent Memory (mem0)',
    icon: '🧠',
    summary: 'Local mem0 — search before tasks, save facts after work',
    suggestedProjects: [],
    rule: {
      id: 'persistent-memory',
      filename: 'persistent-memory.mdc',
      description: 'Persistent cross-project memory via local mem0 — search before tasks, save after',
      alwaysApply: true,
      globs: null,
      body: `# Persistent Memory (local mem0)

You have **local** persistent memory via the \`mem0\` MCP server (Qdrant on this machine).

## Before non-trivial work

Run **2–4 parallel** \`search_memories\` calls with noun phrases (project, module, bug, convention).

## After significant work

\`add_memory\` with \`infer: false\` — one fact per call, include file paths.

## Skip

Trivial fixes, duplicate facts already in rules/playbooks.`,
    },
  },
]

export function getPreset(id) {
  return PRESETS.find((p) => p.id === id) || null
}
