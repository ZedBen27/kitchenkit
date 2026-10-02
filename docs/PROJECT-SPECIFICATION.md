# KitchenKit — Project Specification

## Status
Current functional specification and single source of truth for the project.

## Product
A SaaS for workshop/manufacturing planning of boxes. Projects generate profiles, panels, accessories, cutting requirements, purchase summaries, and workshop documents.

## Project workflow
1. Create project: project name (required), client name (required), phone/address (optional).
2. Technical settings: A, B, B2, C, T, R and handles yes/no. All are editable per project. Defaults: A=5.3 cm, B=1.7 cm, B2=3.4 cm, C=4 mm. T and R currently have no fixed default.
3. Box tables: automatically numbered; unlimited tables; adding a table saves the project as Draft and enables the next table; calculations update while editing.
4. Each box: Structure ET/SET/Eco; Type Potager/Element; shelves 0..8; doors 0/1/2; L/H/P.
5. End actions: Save or Start manufacturing.
6. Workshop: manufacturing projects appear here; project detail shows all generated requirements. Actions: Mark completed or Cancel. Cancelled projects remain stored.
7. Workshop documents: profile cutting tables, Résine cut plans, Aluco cut plans; extensible.

## Profiles / bars
1 Départ; 2 Départ Long; 2 Départ Court; Ouvrant.

## Panels
Résine; Aluco.

## Accessories
Pied; Coin 3 Départ; Coin 2 Départ; Coin Équerre; Charnière; Poignée.

## Confirmed profile rules
For box L/H/P:

### ET
- L: 1 Départ ×2 + 2 Départ Long ×2
- H: 1 Départ ×2 + 2 Départ Court ×2
- P: 2 Départ Long ×4

### SET
- L: 1 Départ ×2 + 2 Départ Court ×2
- H: 1 Départ ×2 + 2 Départ Long ×2
- P: 2 Départ Long ×4

### Eco
- L: 1 Départ ×2 + 2 Départ Court ×2
- H: 1 Départ ×2 + 2 Départ Court ×2
- P: 2 Départ Court ×4

The rules depend on dimension position (L/H/P), not which numeric value is larger.

## Résine rules
### Box faces
Potager: back + bottom + right + left; no front/top.
Element: back + top + bottom + right + left; no front.

### Piece dimensions
- Side: L = P - A; H = H - A
- Top/bottom: L = L - A; H = P - A
- Back: L = L - A; H = H - A

### Shelves
- Shelf: L = L_box - T; P = P_box - R
- Shelf Résine: L = L_shelf - A; P = P_shelf - A
- Each shelf: Coin 2 Départ ×4
- Shelf count: 0..8; unaffected by ET/SET/Eco.

## Door rules
### One door
Ouvrant: H Port = H box ×2; L Port = (L box - B) ×2.
Aluco: H = H Port - C; L = L Port - C; quantities for one door.

### Two doors
Ouvrant: H = H box ×4; L = ((L box - B2)/2) ×4.
Aluco uses the same dimensional logic, for two doors.

Per door: Coin Équerre ×4; Charnière ×2; Poignée ×1 if handles enabled.

## Per-box accessories
Potager: Pied ×4. Element: no Pied. Every box: Coin 3 Départ ×8.

## Purchase summary
No inventory system in current scope. Calculated profiles, panels and accessories are aggregated into a project purchase list after optimization. This is not a stock ledger.

## Architecture principles
- Separate UI, domain/business logic, optimization, documents, and infrastructure.
- Preserve original inputs and calculation rules so results can be recomputed.
- Calculation engine must be deterministic and testable.
- Cut optimization behind an adapter/service boundary.
- Document generation/printing behind an adapter/service boundary.
- SaaS-grade design system with Light/Dark modes, readable typography, responsive UI and RTL-ready Arabic support.
- Verify commercial-use licenses before adopting external/open-source tools.

## Technical direction
Next.js + TypeScript; Tailwind CSS + shadcn/ui; Supabase/PostgreSQL/Auth/Storage; Vercel; GitHub; Univer candidate for spreadsheet-like tables; TanStack Table candidate for traditional tables; Zod; React Hook Form; Recharts; Cut Optimizer and PDF/printing library to be selected after real-case and license evaluation.

## Open items
- Exact defaults for T and R.
- Full visual rule-builder for customer-defined box types.
- Additional Structure/box cases not yet specified.
- Exact shelf/profile rules beyond confirmed rules.
- Exact purchase units (sheet/bar/piece/length).
- Final cut optimization algorithm/library.
- Final PDF/printing library.
