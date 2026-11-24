# anti-slop (vendored)

`skills/install-anti-slop/assets/anti-slop` of [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop)
at `63dbb09` (2026-11-20), copied with that skill's `scripts/install.mjs`. `LICENSE` is the upstream MIT
notice and covers everything here except `vendor/eslint-stylistic`, which carries its own.

The copy is unchanged, so `vp fmt` and `vp lint` skip this directory and the next update is a plain copy
(`references/update.md` of the same skill). It imports `@oxlint/plugins`, which `package.json` pins
to the Oxlint that `vite-plus` bundles; bump both together. The root `vite.config.ts` switches the rules on.
