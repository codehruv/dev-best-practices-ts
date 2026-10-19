/**
 * Example HTTP contract. Zod schemas are the source of truth: they validate requests at
 * runtime and generate the OpenAPI document that clients and `oasdiff` consume.
 *
 * @packageDocumentation
 */

// Schemas
export {
  type CreateNoteRequest,
  CreateNoteRequestSchema,
  type ErrorResponse,
  ErrorResponseSchema,
  type ListNotesQuery,
  ListNotesQuerySchema,
  type ListNotesResponse,
  ListNotesResponseSchema,
  type Note,
  type NoteResponse,
  NoteResponseSchema,
  NoteSchema,
  type Pagination,
  PaginationSchema,
  type UpdateNoteRequest,
  UpdateNoteRequestSchema,
} from './schemas.js';

// Document
export { buildOpenApiDocument, type OpenApiDocument } from './document.js';
