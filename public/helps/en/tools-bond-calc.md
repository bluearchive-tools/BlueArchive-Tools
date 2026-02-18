# Bond calculator

## What this tool does
- Select a student and calculate the required bond points from `Current bond` to `Target bond`.
- Enter `Owned materials (optional)` to see shortages against required amounts.
- Shows farming estimates (recommended run counts per material) to cover the shortage.

## Calculation specification
- Required bond points are calculated by summing an internal per-level bond table.
- The calculator uses the following material values:
  - Basic gift: 20 points each
  - Advanced gift: 60 points each
  - Premium gift: 180 points each
- Farming estimates divide shortage points by expected points per run and round up.
  - Basic gift: B-1 (assumes 6 drops/run)
  - Advanced gift: B-2 (assumes 4 drops/run)
  - Premium gift: B-3 (assumes 2 drops/run)

## Default value behavior
- When a student is selected, saved data (if available) is used to auto-fill `Current bond`.
- `Owned materials` values are saved per student in local storage.
