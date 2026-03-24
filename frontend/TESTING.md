# Testing

100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence — without them, vibe coding is just yolo coding. With tests, it's a superpower.

## Framework

- **Vitest** v4.x with jsdom environment
- **@testing-library/react** for component tests
- **@testing-library/jest-dom** for DOM matchers

## Running Tests

```bash
cd frontend
npx vitest run        # single run
npx vitest            # watch mode
```

## Test Layers

- **Unit tests** (`src/test/*.test.ts`) — pure functions, utilities, store logic
- **Component tests** (`src/test/*.test.tsx`) — render components, assert DOM output
- **Integration tests** — API interactions, multi-component flows
- **E2E tests** — (future) Playwright for full browser flows

## Conventions

- Test files: `src/test/{module}.test.ts` or `.test.tsx`
- Use `describe` / `it` blocks
- Assertion style: `expect(...).toBe(...)`, `expect(...).toBeGreaterThan(...)`
- Setup: `src/test/setup.ts` imports jest-dom matchers globally
