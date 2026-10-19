import { readFileSync } from 'node:fs';

import {
  buildOpenApiDocument,
  CreateNoteRequestSchema,
  ListNotesQuerySchema,
  NoteSchema,
} from '@dbp/iso-api-contract';
import { describe, expect, it } from 'vitest';

const packageVersion = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string })
  .version;
const document = buildOpenApiDocument(packageVersion);

/** Every property name in every schema, found by walking the document. */
function propertyNames(node: unknown, names: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) propertyNames(item, names);
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'properties' && typeof value === 'object' && value !== null) {
        names.push(...Object.keys(value));
      }
      propertyNames(value, names);
    }
  }
  return names;
}

describe('OpenAPI document', () => {
  it('carries the package version, so each contract versions independently', () => {
    expect(document.info.version).toBe(packageVersion);
  });

  it('matches the committed openapi/openapi.json', () => {
    // A stale document would let oasdiff compare the wrong contract. `just generate` fixes it.
    expect(readFileSync('openapi/openapi.json', 'utf8')).toBe(
      `${JSON.stringify(document, null, 2)}\n`,
    );
  });

  it('versions every route under /v1', () => {
    expect(Object.keys(document.paths ?? {}).every((path) => path.startsWith('/v1/'))).toBe(true);
  });

  it('uses snake_case for every JSON field', () => {
    const names = propertyNames(document.components);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !/^[a-z][a-z0-9_]*$/.test(name))).toEqual([]);
  });

  it('paginates every list response', () => {
    const list = document.components?.schemas?.['ListNotesResponse'];
    expect(list).toMatchObject({
      properties: { pagination: { $ref: '#/components/schemas/Pagination' } },
    });
  });

  it('returns the shared error shape for every error status', () => {
    for (const item of Object.values(document.paths ?? {})) {
      for (const operation of Object.values(
        item as Record<string, { responses: Record<string, unknown> }>,
      )) {
        for (const [status, response] of Object.entries(operation.responses)) {
          if (!status.startsWith('4')) continue;
          expect(response).toMatchObject({
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          });
        }
      }
    }
  });
});

describe('schemas', () => {
  it('reject unknown keys, so clients learn about typos instead of losing data', () => {
    expect(CreateNoteRequestSchema.safeParse({ title: 'a', colour: 'red' }).success).toBe(false);
  });

  it('apply request defaults', () => {
    expect(CreateNoteRequestSchema.parse({ title: 'a' })).toEqual({ title: 'a', body: '' });
    expect(ListNotesQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('bound the page size', () => {
    expect(ListNotesQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('accept a well-formed note', () => {
    const note = {
      note_id: 'note_1',
      title: 'Hello',
      body: '',
      created_at: '2026-10-18T00:00:00Z',
      updated_at: '2026-10-18T00:00:00Z',
    };
    expect(NoteSchema.parse(note)).toEqual(note);
  });
});
