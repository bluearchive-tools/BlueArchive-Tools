# Wikiru student converter

Paste a wikiru student page URL to generate a `students.json`-style template.

## Steps

1. Paste the student page URL
2. Click convert
3. Review and fill missing fields before adding to `students.json`

## Notes

- Extraction depends on wiki page structure.
- Skill multiplier arrays can be empty and may require manual completion.

## Skill variable naming rules

`{variables}` in parsed skill text follow these names:

- `cost`: Cost Recovery (percent)
- `costnum`: Cost gain (flat value)
- `defense`: Defense (percent)
- `defensenum`: Defense (flat value)
- `hp`: HP (percent)
- `hpnum`: HP (flat value)
- `attack`: Attack (percent)
- `attacknum`: Attack (flat value)
- `heal`: Healing (percent)
- `healnum`: Healing (flat value)
- `damage`: Damage
- `crit`: Critical rate (percent)
- `critnum`: Critical value (flat)
- `critdamage`: Critical damage (percent)
- `critdamagenum`: Critical damage (flat)
- `type`: Effective damage / type bonus (percent)
- `typenum`: Effective damage / type bonus (flat)
