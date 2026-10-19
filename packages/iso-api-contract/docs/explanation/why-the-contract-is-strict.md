# Why the contract is strict

Every schema in `@dbp/iso-api-contract` rejects keys it does not define. A lenient schema
would drop them and carry on, which looks friendlier, but it hides mistakes. A client that
sends `colour` instead of `color` gets a success response and loses the value. With a
strict schema, the same client gets a `400` that names the unknown key, and the typo is
fixed in minutes.

Strictness has a cost that shapes how the contract evolves. Because an unknown key is an
error, removing a request field turns every client that still sends it from working to
failing. So request fields are never removed in one step. They are deprecated, kept
accepted, and discarded where the request is handled. Responses have the opposite rule:
generated clients validate what they receive, so a response never widens an existing field.
The full rules are in the repository's schema evolution reference.

## Why breaking changes are checked by a tool

The schemas generate `openapi/openapi.json`, and that document is the published contract.
On every pull request, `oasdiff` compares it with the version on `main` and classifies each
change. A change that would break an existing client requires a major version, and the
check fails until the pull request plans one. Reviewers miss breaking changes. The check
does not, because it reads the contract instead of the code.

## Why the version lives in the document

`info.version` is this package's own version, separate from every other package in the
repository. A client, a changelog, and the breaking-change check all read the same number,
so "which contract is this?" always has one answer.
