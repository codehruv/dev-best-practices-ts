Feature: Notes API contract
  The Zod schemas are the contract of the notes API. Requests that break them are
  rejected before any handler runs, and the OpenAPI document generated from them is
  what clients and the breaking-change check consume. These scenarios are the
  acceptance criteria of the contract. Each one runs as a test.

  @REQ-001
  Scenario: Default the page and page size of a list request
    Given a list request with no query parameters
    When the request is validated against ListNotesQuerySchema
    Then validation passes with page 1 and limit 20

  @REQ-002
  Scenario: Reject a page size above the maximum
    Given a list request with limit "500"
    When the request is validated against ListNotesQuerySchema
    Then validation fails on the "limit" field

  @REQ-003
  Scenario: Reject a field the contract does not define
    Given a create request with a title and an extra field "color"
    When the request is validated against CreateNoteRequestSchema
    Then validation fails because "color" is not a known field

  @REQ-004
  Scenario: Version every route
    Given the OpenAPI document for version "1.2.3"
    Then every path starts with "/v1/"
    And the document version is "1.2.3"
