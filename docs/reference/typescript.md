# TypeScript Conventions

The official guidance this repo follows, and the choices layered on top. Where a rule here is enforced by a tool, the tool is named. Where it is not, reviewers enforce it.

## Sources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) and [TSConfig Reference](https://www.typescriptlang.org/tsconfig/)
- [typescript-eslint: shared configs](https://typescript-eslint.io/users/configs/) and [typed linting](https://typescript-eslint.io/getting-started/typed-linting/)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Node.js: modules (ESM)](https://nodejs.org/api/esm.html) and [type stripping](https://nodejs.org/api/typescript.html)
- [pnpm: workspaces](https://pnpm.io/workspaces), [catalogs](https://pnpm.io/catalogs), [supply-chain settings](https://pnpm.io/settings)
- [Turborepo: structuring a repository](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository) and [`--affected`](https://turborepo.com/docs/reference/run#--affected)
- [Vitest](https://vitest.dev/guide/)

## Repository Layout

```text
packages/<name>/
  src/              library source; src/index.ts is the only public entry point
  tests/unit/       Vitest unit tests (tests/integration/ when needed)
  eslint.config.ts  composes getBaseESLintConfig from the root
  tsconfig.json     type-checks src, tests, and config files (noEmit)
  tsconfig.build.json  emits src to dist
  vitest.config.ts
```

- Library packages live in `packages/`, scoped `@dbp/`. Rename the scope when you adopt the template.
- Each package owns its scripts: `build`, `typecheck`, `lint`, `lint:fix`, `test:unit`, `clean`. Turborepo runs them across the graph.
- Shared dev-dependency versions live in the `catalog:` in `pnpm-workspace.yaml`. Packages reference `"catalog:"`, never a version.

## Compiler

`tsconfig.base.json` is the strictest practical config. Packages extend it and never override a strictness flag.

| Flag                                                                    | Why                                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `strict`                                                                | The baseline every TypeScript project starts from.                                                      |
| `noUncheckedIndexedAccess`                                              | `arr[i]` and `record[key]` include `undefined`, which is what they return at runtime.                   |
| `exactOptionalPropertyTypes`                                            | `foo?: string` means "absent or a string", not "explicitly `undefined`".                                |
| `noPropertyAccessFromIndexSignature`                                    | Dynamic keys use `obj['key']`, so a typo on a declared property stays a compile error.                  |
| `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch` | Catch refactoring slips the type system otherwise allows.                                               |
| `verbatimModuleSyntax`                                                  | Imports are emitted exactly as written. Type-only imports must say `type`.                              |
| `erasableSyntaxOnly`                                                    | Bans `enum`, `namespace`, and parameter properties, so Node's type stripping can run any file directly. |
| `module`/`moduleResolution: NodeNext`                                   | Matches how Node resolves ESM. Relative imports need the `.js` extension.                               |

## Modules

- ESM only. Every `package.json` has `"type": "module"`. No `require`, no `module.exports`.
- No new `.js`, `.mjs`, or `.cjs` files. Config files are TypeScript too (`eslint.config.ts`, `vitest.config.ts`).
- Relative imports end in `.js` (`import { Retrier } from './retrier.js'`).
- `src/index.ts` lists every public export by name, grouped under section comments. No `export *` (ESLint `no-restricted-syntax`).
- No namespace imports (`import * as x`). Use named imports (ESLint `no-restricted-syntax`).
- Type-only imports: `import type { A, B }` when every specifier is a type, `import { type A, b }` when mixed (ESLint `consistent-type-imports`, `no-import-type-side-effects`).
- Import order is enforced and auto-fixed (`simple-import-sort`).
- Avoid dynamic `import()` unless you need lazy or conditional loading. Static imports keep dead-code analysis (`knip`) accurate.

## Types

- No `any`. Use `unknown` and narrow it with a type guard (`strictTypeChecked`).
- No non-null assertions (`!`). Narrow instead.
- No `@ts-ignore` or `@ts-nocheck`. A `@ts-expect-error` needs a description and human approval.
- Exported functions declare their parameter and return types (`explicit-module-boundary-types`). Inference is fine inside a function.
- Prefer `interface` for object shapes and `type` for unions and function types.
- Mark interface properties `readonly` unless mutation is the point.
- Model states as discriminated unions, and let `switch-exhaustiveness-check` prove every case is handled.
- Prefer `as const` objects or string-literal unions to `enum` (`erasableSyntaxOnly` bans `enum`).
- Validate data at trust boundaries with a schema library and infer the type from the schema, so the type and the check cannot drift.

## Classes and Functions

- Prefer functions and plain objects. Use a class when it holds validated state or injected dependencies.
- Private state uses `#private` fields, which are private at runtime, not only at compile time.
- Inject dependencies through the constructor and default them to production implementations (`Retrier` in `packages/retry` shows the pattern).
- No parameter properties (`constructor(private x)`). `erasableSyntaxOnly` bans them.

## Errors

- Throw `Error` subclasses only. Each package defines a base error class and specific subclasses with typed fields.
- Set `name` from `new.target.name` so subclasses report their own name.
- Wrap with context and keep the original as `cause`: `new FooError('Loading config failed', { cause: error })`.
- Catch variables are `unknown`. Narrow before use.
- Reject promises with `Error` instances only (`prefer-promise-reject-errors`).
- Never swallow an error. An empty `catch` needs a comment that says why the error is irrelevant.

## Async

- Every promise is awaited, returned, or explicitly voided (`no-floating-promises`).
- Long-running operations accept an `AbortSignal`.
- Never pass an async function where a sync callback is expected (`no-misused-promises`).

## Lint and Format

- `eslint.config.base.ts` applies `strictTypeChecked` and `stylisticTypeChecked` with the project service, so every rule sees full type information.
- Library `src/` code cannot use `console`. Inject a logger.
- Unused `eslint-disable` directives are errors.
- Prettier owns formatting. ESLint formatting rules are off (`eslint-config-prettier`).
- `knip` fails on unused files, exports, and dependencies.

## Tests

- Vitest, in `tests/unit/` and `tests/integration/`, files named `*.test.ts`.
- Test through the public entry point (`../../src/index.js`).
- Fakes implement the package's interfaces. Factories (`makePolicy()`, `makeDependencies()`) build test data with overrides.
- Use fake timers (`vi.useFakeTimers()`) for real timer code. Inject a clock everywhere else.
- `restoreMocks: true` in `vitest.config.ts` resets spies between tests.

## Dependencies

- Add a dependency with `pnpm --filter <package> add <name>`. Shared dev tools go in the catalog.
- `minimumReleaseAge` blocks versions younger than 7 days. If an urgent security fix needs a newer version, add it to `minimumReleaseAgeExclude` with a comment and a removal date.
- Install scripts are denied (`strictDepBuilds`). Review a package's script before allowing it in `allowBuilds`.

## OpenTelemetry

- Libraries depend on `@opentelemetry/api` only, never on an SDK. Without an SDK the API calls do nothing, so the application decides what gets exported.
- Services use zero-code instrumentation from the [OpenTelemetry JavaScript getting started guide](https://opentelemetry.io/docs/zero-code/js/). Install `@opentelemetry/api` and `@opentelemetry/auto-instrumentations-node`, then load the register hook at startup:

  ```sh
  OTEL_SERVICE_NAME=my-service \
  OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
  node --import @opentelemetry/auto-instrumentations-node/register dist/index.js
  ```

- Configure the SDK only through the standard `OTEL_*` environment variables.
- Use attribute and metric names from the official [semantic conventions](https://opentelemetry.io/docs/specs/semconv/). Do not invent custom names until the team records a telemetry convention in an ADR.
