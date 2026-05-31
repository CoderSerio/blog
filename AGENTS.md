# Agent Notes

## Required Checks

Run the same checks that CI runs before handing work back:

```bash
pnpm biome ci ./src --reporter=github
pnpm type-check
pnpm astro check
pnpm build
```

Biome is a real CI gate in `.github/workflows/biome.yml`, not just a formatter preference. If it reports formatting, import sorting, or lint assists, run this mechanical fix first and then rerun the CI command:

```bash
pnpm biome check --write ./src
```

Do not rely on `astro check`, `type-check`, or `build` alone for this repo.
