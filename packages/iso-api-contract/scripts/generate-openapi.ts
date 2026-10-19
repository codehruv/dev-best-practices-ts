import { readFileSync, writeFileSync } from 'node:fs';

// The self-import resolves to dist at runtime and to src for type checking (tsconfig
// paths), so the package must be built before this script runs.
import { buildOpenApiDocument } from '@dbp/iso-api-contract';

// Run from the package root by `pnpm run generate`. The spec version comes from
// package.json, so `changeset version` followed by `just generate` keeps them equal.
const packageJson: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
if (
  typeof packageJson !== 'object' ||
  packageJson === null ||
  !('version' in packageJson) ||
  typeof packageJson.version !== 'string'
) {
  throw new Error('package.json has no string "version" field');
}

const document = buildOpenApiDocument(packageJson.version);
writeFileSync('openapi/openapi.json', `${JSON.stringify(document, null, 2)}\n`);
