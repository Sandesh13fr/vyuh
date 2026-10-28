# DESIGN.md: Vyuh visual system

World: **Chakravyuh rings.** Seven concentric rings with gaps guard a marigold core. Indigo ink on cool paper by day, indigo night by dark. Tokens: [brand/tokens.css](brand/tokens.css). Guidelines page: [brand/guidelines.html](brand/guidelines.html).

## Principles
1. **The rings carry the idea.** Every product moment maps onto the seven rings: an intent travels inward, a ring holds or fails. Use the motif to explain state, never as wallpaper.
2. **One focal move per view.** Usually the ring emblem or a single number. Everything else is quiet.
3. **Truth over theatre.** Real reason codes, real hashes, real addresses. Mocks and targets are labelled.
4. **Legible at distance.** Projector in a bright hall and a 375px phone are both first-class.

## Color
| Token | Light | Dark | Role |
|---|---|---|---|
| `--vy-bg` | #f3f4fa | #0d0f2a | page ground |
| `--vy-surface` | #ffffff | #15183a | panels, tables |
| `--vy-surface-2` | #e9ebf6 | #1c2048 | table heads, wells |
| `--vy-ink` | #161a3d | #ecedf9 | text |
| `--vy-ink-2` | #4a4f75 | #a9acd0 | secondary text |
| `--vy-line` | #d9dbec | #2a2e5c | borders, rules |
| `--vy-ring` | #2b3180 | #8f96ff | active ring, primary action, links, focus |
| `--vy-ring-quiet` | #c9cce6 | #2a2e5c | idle ring tracks |
| `--vy-core` | #f2b233 | #f2b233 | the core: fills only |
| `--vy-core-ink` | #a35f00 | #f2b233 | marigold as text |
| `--vy-held` | #0e7a6d | #3cc7b4 | passed, healthy, held |
| `--vy-blocked` | #b8332a | #ff7a6b | stopped, violation, halted |

Strategy: restrained. Neutrals + indigo; marigold only for the core and one emphasis per view. Held and blocked are state colors, never decoration. Never gradient text.

## Type
- **Schibsted Grotesk** for everything human: display 800, tracking -0.035em; body 400; labels 600.
- **JetBrains Mono** only for data: addresses, hashes, amounts, reason codes, block numbers. Tabular numerals.
- Scale: 12 / 14 / 16 / 20 / 28 / 40 / clamp(40-72). Body measure 65-75ch.

## Shape and depth
- Radius 6 / 12 / 20 / pill. Chips and status are pills; panels are 12.
- Hairline borders (1px `--vy-line`) do most separation. Shadow `--vy-shadow-1` for floating Radix content (popover, dialog, dropdown); `--vy-shadow-2` for the one focal panel.
- No colored side-borders, no hard offset shadows, no glass.

## The ring motif
- **Emblem:** 7 rings, stroke 9 at 300px, gaps preserved. The active/deciding ring uses `--vy-ring`; the rest `--vy-ring-quiet`; the ring that stopped an attack flashes `--vy-blocked`.
- **Mark:** 2 rings + core for <= 64px. Files in `brand/logo/`.
- **Ring order is fixed:** 1 Spend cap, 2 Allowlist, 3 Oracle band, 4 Slippage, 5 Daily loss, 6 KYC tier, 7 Cooldown. Labels come from `RING_NAMES` in `@vyuh/shared`.
- **Ring meter (component):** 7 small arcs in a row or ring; each held, blocked or idle. Used in receipts, attempt rows and the arena hero.

## Components (Radix primitives, styled with tokens)
| Component | Radix | Notes |
|---|---|---|
| Button | Slot | primary = `--vy-ring` fill; secondary = surface + line; danger = `--vy-blocked` |
| Reason chip | - | pill, mono code + plain words; held/blocked color dot |
| Dialog | Dialog | mandate sign, halt confirm |
| Tabs | Tabs | console sections |
| Tooltip | Tooltip | explain a ring or code |
| Toast | Toast | tx submitted / reverted with reason |
| Dropdown | DropdownMenu | wallet, theme |
| Switch | Switch | dry run, auto-trade |
| Slider | Slider | mandate limits (tighten only shows direction) |
| Table | - | receipts, attempts; mono numerals, right-aligned amounts |

## Motion
- One authored moment per view: the attack dot travels inward and stops at the ring that held (`--vy-slow`, `--vy-ease`).
- UI transitions `--vy-fast`/`--vy-base`, ease-out only. No bounce. Honour `prefers-reduced-motion`.

## Voice
Confident, precise, a little defiant. Short sentences. Name the ring and the reason.
- Yes: "Blocked at ring 3: price 4.1% off oracle."  No: "Oops! Something went wrong."
- Yes: "Break the Vyuh."  No: "Revolutionary AI-powered security."
- CTA verbs: Break, Sign, Halt, Withdraw, Tighten.

## Surfaces
| Surface | Mode | First viewport |
|---|---|---|
| Landing `/` | Persuade | thesis line + live emblem with attack animation + counter of blocked attempts + "Break the Vyuh" |
| Arena `/arena` | Experience | chat left, live ring emblem right, wall of attempts below |
| Console `/console` | Operate | vault NAV + status, ring meter of mandate, receipts table, halt |
| Docs `/docs` | Read | sidebar + article |
