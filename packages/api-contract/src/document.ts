import { OpenApiGeneratorV31, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import {
  CreateNoteRequestSchema,
  ErrorResponseSchema,
  ListNotesQuerySchema,
  ListNotesResponseSchema,
  NoteResponseSchema,
  UpdateNoteRequestSchema,
} from './schemas.js';

/**
 * The OpenAPI document this package generates. The generated `openapi/openapi.json`
 * is the published contract, and `oasdiff` diffs it to detect breaking changes.
 * @public
 */
export type OpenApiDocument = ReturnType<OpenApiGeneratorV31['generateDocument']>;

const noteIdParams = z.object({ note_id: z.string().meta({ example: 'note_01J9Z3K8V6' }) });

const errorResponses = {
  400: { description: 'The request failed validation.', schema: ErrorResponseSchema },
  404: { description: 'No note has this ID.', schema: ErrorResponseSchema },
  429: {
    description: 'Rate limited. Retry after the `Retry-After` header.',
    schema: ErrorResponseSchema,
  },
} as const;

function jsonResponse(description: string, schema: z.ZodType) {
  return { description, content: { 'application/json': { schema } } };
}

function errors(...codes: (keyof typeof errorResponses)[]) {
  return Object.fromEntries(
    codes.map((code) => [
      code,
      jsonResponse(errorResponses[code].description, errorResponses[code].schema),
    ]),
  );
}

function buildRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();

  registry.registerPath({
    method: 'get',
    path: '/v1/notes',
    operationId: 'list_notes',
    summary: 'List notes',
    request: { query: ListNotesQuerySchema },
    responses: {
      200: jsonResponse('A page of notes.', ListNotesResponseSchema),
      ...errors(400, 429),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/v1/notes',
    operationId: 'create_note',
    summary: 'Create a note',
    request: {
      headers: z.object({
        'Idempotency-Key': z.string().optional().meta({
          description:
            'Retries with the same key return the original result instead of creating a duplicate.',
        }),
      }),
      body: { content: { 'application/json': { schema: CreateNoteRequestSchema } } },
    },
    responses: { 201: jsonResponse('The created note.', NoteResponseSchema), ...errors(400, 429) },
  });

  registry.registerPath({
    method: 'get',
    path: '/v1/notes/{note_id}',
    operationId: 'get_note',
    summary: 'Get a note',
    request: { params: noteIdParams },
    responses: { 200: jsonResponse('The note.', NoteResponseSchema), ...errors(404, 429) },
  });

  registry.registerPath({
    method: 'patch',
    path: '/v1/notes/{note_id}',
    operationId: 'update_note',
    summary: 'Update a note',
    request: {
      params: noteIdParams,
      body: { content: { 'application/json': { schema: UpdateNoteRequestSchema } } },
    },
    responses: {
      200: jsonResponse('The updated note.', NoteResponseSchema),
      ...errors(400, 404, 429),
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/v1/notes/{note_id}',
    operationId: 'delete_note',
    summary: 'Delete a note',
    request: { params: noteIdParams },
    responses: { 204: { description: 'The note was deleted.' }, ...errors(404, 429) },
  });

  return registry;
}

/**
 * Builds the OpenAPI 3.1 document for the notes API. `version` becomes `info.version`,
 * which tracks this package's own semver, independent of every other interface.
 * @public
 */
export function buildOpenApiDocument(version: string): OpenApiDocument {
  return new OpenApiGeneratorV31(buildRegistry().definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Notes API',
      version,
      description: 'Example HTTP contract for the dev-best-practices template.',
    },
    servers: [{ url: 'https://api.example.com' }],
  });
}
