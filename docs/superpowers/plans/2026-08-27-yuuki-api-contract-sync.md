# Yuuki API Contract Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize the mini-program's Yuuki list request with the FastAPI contract and preserve the deployed Yuuki routes in GitHub.

**Architecture:** The mini-program performs list reads with GET query parameters. A server-side contract test makes that behavior and the mini-program-required Yuuki route set executable. The server's uncommitted Yuuki implementation and test are committed separately from the local mini-program fix.

**Tech Stack:** WeChat Mini Program TypeScript, FastAPI, pytest, GitHub.

**Spec:** `docs/superpowers/specs/2026-08-27-yuuki-api-contract-design.md`

## Global Constraints

- Do not send any endpoint request that registers, issues, discards, releases, verifies, or grants an account.
- Do not stage unrelated server working-tree changes.
- Keep `POST /api/yuuki-pool/list` as server compatibility behavior; change only the mini-program consumer.

---

### Task 1: Backend Yuuki contract test

**Files:**
- Create: `/opt/card-backend/tests/test_miniprogram_yuuki_contract.py`
- Modify: `/opt/card-backend/app/routers/yuuki_pool.py` only if the test proves a required route is missing
- Test: `/opt/card-backend/tests/test_miniprogram_yuuki_contract.py`

**Interfaces:**
- Consumes: FastAPI `app.main:app` and `/api/yuuki-pool/*` routes.
- Produces: A repeatable assertion that required mini-program routes exist and list filtering is query-driven.

- [ ] **Step 1: Write the failing test**

```python
def test_miniprogram_requires_player_candidates_route():
    assert "/api/yuuki-pool/grant/player-candidates" in app.openapi()["paths"]
```

- [ ] **Step 2: Run test to verify it fails against the tracked baseline**

Run: `git show origin/main:app/routers/yuuki_pool.py | grep player-candidates`

Expected: no route in the tracked baseline.

- [ ] **Step 3: Keep the deployed route and add complete route/list contract assertions**

```python
required_paths = {
    "/api/yuuki-pool/list": {"get", "post"},
    "/api/yuuki-pool/grant/player-candidates": {"post"},
}
```

- [ ] **Step 4: Run the contract test**

Run: `/opt/card-backend/venv/bin/python -m pytest tests/test_miniprogram_yuuki_contract.py -q`

Expected: PASS.

- [ ] **Step 5: Commit server Yuuki source and test**

```bash
git add app/routers/yuuki_pool.py app/yuuki_pool_grant.py tests/test_miniprogram_yuuki_contract.py
git commit -m "fix: sync Yuuki mini-program API contract"
```

### Task 2: Mini-program list request

**Files:**
- Modify: `miniprogram/services/yuuki.ts:89-90`
- Test: server contract test from Task 1 plus TypeScript compilation

**Interfaces:**
- Consumes: `GET /api/yuuki-pool/list` query parameters `status`, `keyword`, `page`, and `page_size`.
- Produces: `yuukiApi.list()` retaining its current TypeScript signature and honoring caller-supplied search and paging values.

- [ ] **Step 1: Write the failing static request assertion**

```python
assert "request<any>(`${PREFIX}/list?" in yuuki_api_source
assert "method: 'POST'" not in list_function_source
```

- [ ] **Step 2: Run the assertion before changing production code**

Run: `python tests/check_yuuki_list_request.py`

Expected: FAIL because `list()` currently sends a JSON POST body.

- [ ] **Step 3: Change list to construct an encoded GET query string**

```ts
list: (status, keyword, page, pageSize = 50) =>
  request<any>(`${PREFIX}/list?status=${encodeURIComponent(status)}&keyword=${encodeURIComponent(keyword)}&page=${page}&page_size=${pageSize}`),
```

- [ ] **Step 4: Run the request assertion and TypeScript compiler**

Run: `python tests/check_yuuki_list_request.py && npm exec tsc -- --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit the mini-program change and test**

```bash
git add miniprogram/services/yuuki.ts tests/check_yuuki_list_request.py
git commit -m "fix: send Yuuki list filters as query parameters"
```

### Task 3: Publish and verify source-of-truth alignment

**Files:**
- No additional source files.

**Interfaces:**
- Consumes: committed server `main` and local mini-program `main` changes.
- Produces: both Git histories contain the deployed API contract.

- [ ] **Step 1: Push the server commit**

Run: `git push origin main`

Expected: server Yuuki contract commit is accepted by GitHub.

- [ ] **Step 2: Push the mini-program commit**

Run: `git push origin main`

Expected: mini-program list fix is accepted by GitHub.

- [ ] **Step 3: Verify GitHub heads and clean targeted paths**

Run: `git ls-remote origin refs/heads/main`

Expected: each remote head contains its local commit; unrelated pre-existing server changes remain unstaged.
