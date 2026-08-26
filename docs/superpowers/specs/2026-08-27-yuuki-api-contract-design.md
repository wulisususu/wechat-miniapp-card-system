# Yuuki API Contract Synchronization Design

## Goal

Keep the WeChat mini-program, the deployed card backend, and the backend GitHub source aligned on the Yuuki account-pool API.

## Scope

- Change the mini-program list request to use query parameters, matching the FastAPI route signature.
- Add a backend contract test for the mini-program's required Yuuki routes and list-filter semantics.
- Commit and push the deployed Yuuki source changes that are currently outside Git history.

## Design

`GET /api/yuuki-pool/list?status=...&keyword=...&page=...&page_size=...` is the single list-read contract used by the mini-program. The backend keeps its existing POST compatibility route, but the mini-program no longer relies on JSON request-body parameters that FastAPI ignores for this endpoint.

The backend test reads the OpenAPI route map and exercises the list endpoint with a deliberately unmatched keyword. It asserts that the GET query returns no rows, while guarding the required routes used by the mini-program, including the production-only player-candidates endpoint.

Only Yuuki source files and the new test are staged in the server repository; unrelated working-tree changes remain untouched. The local mini-program change is committed independently.

## Verification

- The new backend contract test fails before its required player-candidates route is represented in the tracked backend baseline, then passes against the deployed source.
- TypeScript compilation validates the mini-program request change.
- Backend tests pass before the server commit and push.
