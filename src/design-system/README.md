# KitchenKit Design System

## Principles
- Professional workshop SaaS UI: clear, dense where useful, never cluttered.
- Arabic-first readiness with RTL support from the beginning.
- Light and dark themes use semantic tokens, not hard-coded page colors.
- Components should depend on design-system primitives rather than vendor-specific APIs.
- Units are displayed contextually, while calculation values remain normalized to meters.

## Foundations

### Typography
- UI/body: Inter or system sans stack.
- Arabic: Noto Sans Arabic preferred when available.
- Numeric dimensions: tabular numerals where supported.

### Layout
- 4px base spacing grid.
- Content max width: 1440px for dense operational pages.
- Cards use modest radius; avoid excessive rounded/pill styling.
- Tables prioritize scanability and stable column widths.

### Semantic colors
Use CSS variables/tokens for:
- background / foreground
- card / card-foreground
- muted / muted-foreground
- border / input / ring
- primary / primary-foreground
- secondary / secondary-foreground
- destructive / destructive-foreground
- success / success-foreground
- warning / warning-foreground
- info / info-foreground

Do not couple application logic to raw color names.

### Status semantics
- Draft: neutral
- Saved: informational
- In progress: warning/active
- Completed: success
- Cancelled: destructive

### RTL
The app must support `dir="rtl"` at the root. Direction-sensitive spacing, icons and navigation must use logical CSS properties where possible.

## Component layers
1. Primitives: Button, Input, Select, Checkbox, Switch, Dialog, Badge, Card.
2. Data components: DataTable, DimensionInput, QuantityInput, StatusBadge.
3. Domain components: ProjectCard, BoxEditor, PartsTable, PurchaseSummary, CutPlanPreview.
4. Page components: Dashboard, ProjectEditor, Workshop, ProjectDetail.

## Accessibility
- Keyboard reachable controls.
- Visible focus state.
- Labels for every form field.
- Do not rely on color alone for status.
- Confirm destructive actions.
