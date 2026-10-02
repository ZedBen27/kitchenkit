# Calculation validation cases

These are manual acceptance cases for the initial calculation engine.

## Case 1
Input: L=0.90 m, H=0.80 m, P=0.60 m.

Expected profiles:
- ET: L → 1Départ×2 + 2 Départ Long×2; H → 1Départ×2 + 2 Départ Court×2; P → 2 Départ Long×4.
- SET: L → 1Départ×2 + 2 Départ Court×2; H → 1Départ×2 + 2 Départ Long×2; P → 2 Départ Long×4.
- Eco: L → 1Départ×2 + 2 Départ Court×2; H → 1Départ×2 + 2 Départ Court×2; P → 2 Départ Court×4.

## Case 2
Input: L=1.20 m, H=0.70 m, P=0.50 m.

Expected profile rules are identical by dimension position to Case 1.

## Case 3
Input: L=0.70 m, H=1.20 m, P=0.50 m.

Expected profile rules are identical by dimension position to Case 1. Numeric ordering must not alter which profile is assigned to L/H/P.

## Additional checks
- Potager has Résine on back/bottom/right/left only and 4 Pied.
- Element has Résine on back/top/bottom/right/left and no Pied.
- Shelves range from 0 to 8 and each adds one shelf Résine panel plus 4 Coin 2 Départ.
- Every box adds 8 Coin 3 Départ.
- One door: 2 Ouvrant at H, 2 Ouvrant at L-B, one Aluco panel, 4 Coin Équerre, 2 Charnière, optional 1 Poignée.
- Two doors: 4 Ouvrant at H, 4 Ouvrant at (L-B2)/2, two Aluco panels, 8 Coin Équerre, 4 Charnière, optional 2 Poignée.
