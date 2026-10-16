# Clear Sky Design System

A premium, light-first, airy design specification with first-class Dark mode and accent presets for InstituteOS (`COPILET`).

---

## 1. Design Philosophy

- **Light-First Default**: Crisp white space, soft layered depth, airy surfaces (`#F6F8FC` base, `#FFFFFF` surfaces).
- **First-Class Dark Theme**: Deep midnight canvas (`#0A0F1C`, `#111827` surfaces) without muddy greys or high-contrast eye fatigue.
- **Strict Color Rule**: Zero purple, violet, pink, or neon colors. The palette is built on authoritative royal blues, deep teals, warm corals, and emerald greens.
- **Living Theme-Aware Background**:
  - Base `--bg-0`
  - 3 soft accent mesh blobs drifting on 40–60s loops (10–14% opacity in Light, 20–28% in Dark)
  - 24px dot grid with radial edge mask and 8px pointer parallax
  - 3% paper grain noise texture to prevent color banding
  - Cursor spotlight sheen (`--mx`, `--my`)
  - Faint 80-star twinkling starfield rendered **strictly in Dark theme** (Light theme has no stars).
- **60 FPS Motion Budget**: Animate transform and opacity only. Spring physics (`stiffness: 260, damping: 24`). Durations: 120ms (instant), 220ms (fast), 380ms (normal), 600ms (max).
- **Accessibility & Calm Mode**: WCAG AA contrast in both themes, 2px visible focus rings, full keyboard accessibility (Cmd/Ctrl+K, arrow navigation, escape), and a dedicated Calm Mode toggle (fades only, no parallax, no loops).

---

## 2. Design Tokens

### 2.1 Surfaces & Typography

| Token | Light Theme | Dark Theme | Purpose |
|---|---|---|---|
| `--bg-0` | `#F6F8FC` | `#0A0F1C` | Viewport canvas background |
| `--surface` | `#FFFFFF` | `#111827` | Primary card elevation & panels |
| `--surface-2` | `#F0F3FA` | `#172033` | Secondary inputs, chips, tables |
| `--surface-3` | `#E7ECF6` | `#1F2A40` | Hover layers & active pill backgrounds |
| `--border` | `rgba(15,23,42,0.08)` | `rgba(255,255,255,0.08)` | Subtle card & cell borders |
| `--border-hover`| `rgba(15,23,42,0.16)` | `rgba(255,255,255,0.16)` | Card hover outline |
| `--text-primary` | `#0F172A` | `#EAF0FB` | High-contrast headings and body |
| `--text-secondary` | `#475569` | `#A3AEC4` | Subtitles and supporting copy |
| `--text-muted` | `#8A94A8` | `#6B778F` | Timestamps and secondary labels |

### 2.2 Accent Presets

User-selectable in Settings and quick-picker in Topbar:

#### Ocean (Default)
- **Primary**: `#2563EB` (Dark: `#60A5FA`)
- **Secondary**: `#0D9488` (Dark: `#2DD4BF`)
- **Highlight**: `#F97316` (Dark: `#FB923C`)
- **Brand Gradient**: `linear-gradient(120deg, #2563EB, #0EA5A4)`

#### Emerald
- **Primary**: `#059669` (Dark: `#34D399`)
- **Secondary**: `#0284C7` (Dark: `#38BDF8`)
- **Highlight**: `#F59E0B` (Dark: `#FBBF24`)
- **Brand Gradient**: `linear-gradient(120deg, #059669, #0284C7)`

#### Sunset
- **Primary**: `#EA580C` (Dark: `#FB923C`)
- **Secondary**: `#0F766E` (Dark: `#2DD4BF`)
- **Highlight**: `#2563EB` (Dark: `#60A5FA`)
- **Brand Gradient**: `linear-gradient(120deg, #EA580C, #0F766E)`

### 2.3 Semantic Tokens
- **Success**: `#16A34A` (Background: `rgba(22, 163, 74, 0.12)`)
- **Warning**: `#D97706` (Background: `rgba(217, 119, 6, 0.12)`)
- **Danger**: `#DC2626` (Background: `rgba(220, 38, 38, 0.12)`)
- **Info**: `#0284C7` (Background: `rgba(2, 132, 199, 0.12)`)

---

## 3. Signature Moments & Components

1. **Boot Sequence (`BootSequence.jsx`)**:
   - 1.6s initial load on clean white canvas (skippable with Esc or click).
   - TechSummitTrainers mark stroke animation, pulsing ring, and typing status lines ("Syncing batches... Verifying roles... Copilot online").
2. **Role Picker (`LoginPage.jsx`)**:
   - 4 3D-tilting white glass cards (Owner, Counselor, Trainer, Accounts).
   - Soft layered elevation shadows, animated icon badges, and capability lists.
   - Smooth expansion transition on selection.
3. **Copilot Living Orb (`Orb.jsx`)**:
   - Glassy sphere with flowing blue/teal noise-driven shaders.
   - States: `idle` (breathing), `listening` (acoustic ripples), `thinking` (swirl with orbiting particles), `success` (bright bloom), and `refused` (coral lock refusal state).
   - Lives large on Copilot page and transitions smoothly into the floating action button (FAB) elsewhere via shared `layoutId`.
4. **Command Palette (`CommandPalette.jsx`)**:
   - Shortcut `Cmd+K` / `Ctrl+K`.
   - Fuzzy search across students, batches, pages, and copilot actions with dual-pane live preview.
5. **Bento Operations Dashboard (`DashboardBento.jsx`)**:
   - Asymmetric bento grid with KPI count-ups and SVG sparklines.
   - **Cash-Flow River Chart**: SVG area chart with travelling highlight dot.
   - **Risk Constellation**: Interactive cohort graph with node pulse and student drawer drill-down.
   - **Radial Attendance Gauge**: Animated SVG gauge with live percentage counter.
6. **Action Approval Ceremony (`HoldToConfirm.jsx`)**:
   - 700ms press-and-hold button with circular progress fill, tactile audio shimmer, micro-shake, and blue/teal/coral confetti burst (`canvas-confetti`).
7. **Slide-in Student Drawer (`Drawer.jsx`)**:
   - Radial attendance gauge, dropout-risk speedometer with animated needle, 14-session heat strip, and fee timeline.
8. **Animated Empty States (`EmptyState.jsx`)**:
   - Paper Plane (no data/new list).
   - Tangled Cable (network error/disconnected).
   - Sleeping Cloud (no search results).
9. **Interactive Catalog (`UiDesignSystemPage.jsx`)**:
   - Interactive Storybook-style route at `/ui` (or `#ui`).
   - Live theme toggle, accent preset switcher, and component showcase.
10. **Developer FPS Meter (`FpsMeter.jsx`)**:
    - Real-time FPS, frame time, and DOM node counter toggled via `Shift+F`.

---

## 4. Theme & State Management

- Use `useTheme()` from `src/app/providers.jsx`:
  ```javascript
  const {
    theme,           // 'light' | 'dark' | 'system'
    resolvedTheme,   // 'light' | 'dark'
    setTheme,        // (newTheme, event?) => void (circular reveal)
    accent,          // 'ocean' | 'emerald' | 'sunset'
    setAccent,       // (newAccent) => void
    calmMode,        // boolean
    setCalmMode,     // (bool) => void
  } = useTheme();
  ```
- **No Flash of Wrong Theme**: The inline script in `index.html` resolves and injects `data-theme` on `<html>` before first paint.
- **Circular Reveal**: `setTheme(theme, event)` leverages the View Transitions API when supported to smoothly expand the new theme as a circular mask from the trigger coordinate.

---

## 5. Print Stylesheet

Certificates and printable documents are always rendered in pure light theme (`#FFFFFF` background, high-contrast black typography) with sidebars, topbars, living background layers, and floating controls automatically hidden via `@media print`.
