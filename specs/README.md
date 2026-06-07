# Finance Rules — YAML specs

Edit **`car.yaml`**, **`mortgage.yaml`**, or **`investment.yaml`** to change rules, thresholds, intake questions, and user-facing copy.

After editing, compile specs into TypeScript:

```bash
npm run specs:compile
```

`npm run build` runs this automatically (`prebuild`).

## What each file controls

| File | Examples you can change |
|------|-------------------------|
| `car.yaml` | Min down %, max loan months, transport cap, intake questions |
| `mortgage.yaml` | 15/30-year terms, 35% housing cap, refi 1% rule, readiness checklist |
| `investment.yaml` | Priority order steps, starter EF $2k, follow-up questions |
| `ai-behavior.yaml` | AI explainer tone, role, restrictions (rules decide — AI explains) |
| `platform.yaml` | Cross-section conversation principles |

## Universal intake policy

Each spec includes `intake.policy` — the bot parses everything you provide up front and only asks for missing fields. Change those bullets to adjust behavior across the app.

## Generated code

Compiled output: `src/lib/specs/bundle.ts` (do not edit by hand).

Application code imports from `@/lib/specs`.
