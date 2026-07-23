/**
 * Escapes Postgres `LIKE`/`ILIKE` wildcard metacharacters (`%`, `_`) and the
 * escape character itself (`\`) in free-text user input before it's handed
 * to a Prisma `contains`/`startsWith`/`endsWith` filter.
 *
 * Prisma's `contains` filter compiles (on Postgres) to something like
 * `column ILIKE '%' || $1 || '%'` — the `%'`s that bound the pattern are
 * literal SQL, but whatever the caller passes as `$1` is inserted verbatim
 * into the *pattern*, not escaped for LIKE's own metacharacter syntax. That
 * makes this a real correctness bug, not a SQL-injection risk (the value is
 * still a properly parameterized bind, so no query-injection is possible):
 * a literal `%` or `_` typed into a search box acts as a wildcard rather
 * than a literal character, so searching for e.g. just `%` or `_` matches
 * far more rows than the user typed anything specific for. Escaping the
 * backslash first (so a user-typed `\` itself doesn't get reinterpreted as
 * this function's own escape character) then `%`/`_` fixes this — Postgres
 * `LIKE`/`ILIKE` treats `\` as the default escape character, so `\%`/`\_`
 * match the literal characters.
 */
export function escapeLikeWildcards(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
