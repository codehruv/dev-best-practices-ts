import { readFileSync, writeFileSync } from 'node:fs';

import { buildOpenApiDocument } from '../document.js';

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
