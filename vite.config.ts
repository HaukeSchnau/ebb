import { defineConfig } from "vite-plus";

export default defineConfig({
  // Every file compiles with the root tsconfig. test/release.test.ts imports .calder/decide.ts, whose
  // nearest tsconfig extends @calder-ci/tsconfig, which only `calder gen`'s link provides. Drop this
  // once that package resolves without the link.
  tsconfig: "tsconfig.json",
  fmt: {
    ignorePatterns: [
      // Vendored as upstream wrote it, so the next update is a plain copy.
      "tools/oxlint/anti-slop/**",
    ],
    sortPackageJson: {},
  },
  lint: {
    ignorePatterns: [
      // Calder's own TypeScript project, with a tsconfig package the root doesn't install.
      ".calder",
      // Vendored as upstream wrote it; upstream lints and tests it.
      "tools/oxlint/anti-slop",
    ],
    plugins: ["eslint", "import", "oxc", "typescript", "unicorn"],
    jsPlugins: [
      { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
      { name: "anti-slop-effect", specifier: "./tools/oxlint/anti-slop/effect/index.ts" },
    ],
    categories: {
      correctness: "error",
      perf: "error",
      suspicious: "error",
    },
    rules: {
      "eslint/eqeqeq": "error",
      "typescript/consistent-type-imports": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
      "unicorn/prefer-node-protocol": "error",

      "oxc/no-accumulating-spread": "error",
      "anti-slop/no-array-filter-map": "error",
      "anti-slop/no-reduce-accumulator-copy": "error",
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-readable-spacing": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",
      "anti-slop-effect/no-manual-effect-error-tag": "error",
      "anti-slop-effect/no-manual-tag-comparison": "error",
      "anti-slop-effect/no-manual-tagged-construction": "error",
      "anti-slop-effect/no-service-constructor-imports": "error",
      "anti-slop-effect/prefer-effect-match": "error",

      // Each await in a loop here is sequential on purpose: polling until a deadline, opening tabs
      // in order, reopening a sweep in its tab order, closing tabs one by one (6 findings).
      // https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-await-in-loop.html
      "eslint/no-await-in-loop": "off",

      // Small immutable updates of a tab, an entry or a kept tab read better as spreads than as
      // mutation (4 findings).
      // https://oxc.rs/docs/guide/usage/linter/rules/oxc/no-map-spread.html
      "oxc/no-map-spread": "off",

      // Both remaining checks narrow values without a schema: chrome.storage's change event types
      // newValue as unknown, and text.ts mixes phrases with functions (2 findings).
      // https://github.com/dmmulroy/anti-slop/blob/63dbb09/src/rules/no-runtime-typeof.ts
      "anti-slop/no-runtime-typeof": "off",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
