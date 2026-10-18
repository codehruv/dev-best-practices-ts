import { z } from 'zod';

// Every schema is `.strict()`, so the API rejects unknown keys with a 400 instead of
// silently dropping them. That is why removing a request property breaks clients
// (docs/reference/schema-evolution.md).

/**
 * The machine-readable error shape every endpoint returns. Clients branch on `code`,
 * so codes are part of the contract and follow the same evolution rules as fields.
 * @public
 */
export const ErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.string().meta({ example: 'invalid_argument' }),
        message: z.string().meta({ example: 'limit must be between 1 and 100, got 500' }),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
  })
  .strict()
  .meta({ id: 'ErrorResponse' });

/** @public */
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Offset pagination returned by every list endpoint. Lists paginate from their first
 * version, because adding pagination later changes the response shape.
 * @public
 */
export const PaginationSchema = z
  .object({
    page: z.int().min(1),
    limit: z.int().min(1).max(100),
    total_items: z.int().min(0),
    total_pages: z.int().min(0),
  })
  .strict()
  .meta({ id: 'Pagination' });

/** @public */
export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * A note: the example resource this contract exposes.
 * @public
 */
export const NoteSchema = z
  .object({
    note_id: z.string().meta({ example: 'note_01J9Z3K8V6' }),
    title: z.string().min(1).max(200),
    body: z.string().max(10_000),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
  })
  .strict()
  .meta({ id: 'Note' });

/** @public */
export type Note = z.infer<typeof NoteSchema>;

/**
 * Body of `POST /v1/notes`. A bare resource, not wrapped in an envelope.
 * @public
 */
export const CreateNoteRequestSchema = z
  .object({
    title: z.string().min(1).max(200),
    body: z.string().max(10_000).default(''),
  })
  .strict()
  .meta({ id: 'CreateNoteRequest' });

/** @public */
export type CreateNoteRequest = z.input<typeof CreateNoteRequestSchema>;

/**
 * Body of `PATCH /v1/notes/{note_id}`. A merge update: absent fields keep their value.
 * @public
 */
export const UpdateNoteRequestSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    body: z.string().max(10_000).optional(),
  })
  .strict()
  .meta({ id: 'UpdateNoteRequest' });

/** @public */
export type UpdateNoteRequest = z.infer<typeof UpdateNoteRequestSchema>;

/**
 * Query parameters of `GET /v1/notes`.
 * @public
 */
export const ListNotesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

/** @public */
export type ListNotesQuery = z.input<typeof ListNotesQuerySchema>;

/**
 * Response of `GET /v1/notes/{note_id}`, `POST /v1/notes`, and `PATCH /v1/notes/{note_id}`.
 * @public
 */
export const NoteResponseSchema = z
  .object({ data: NoteSchema })
  .strict()
  .meta({ id: 'NoteResponse' });

/** @public */
export type NoteResponse = z.infer<typeof NoteResponseSchema>;

/**
 * Response of `GET /v1/notes`. The `data` array sits inside an envelope so the
 * response can grow new top-level fields without breaking clients.
 * @public
 */
export const ListNotesResponseSchema = z
  .object({ data: z.array(NoteSchema), pagination: PaginationSchema })
  .strict()
  .meta({ id: 'ListNotesResponse' });

/** @public */
export type ListNotesResponse = z.infer<typeof ListNotesResponseSchema>;
