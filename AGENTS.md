# Project development guide

## Environment

- This project is developed on Windows with PowerShell and the VS Code Codex extension.
- Use `npm.cmd` and `npx.cmd` in PowerShell. Do not change PowerShell ExecutionPolicy.
- Do not run project initializers such as `npm create vite` or `git init` unless the user explicitly asks.

## Stack and commands

- React, TypeScript, Vite, Tailwind CSS, React Hook Form, Zod, and Supabase.
- Install dependencies: `npm.cmd install`
- Start development server: `npm.cmd run dev`
- Build: `npm.cmd run build`
- Lint: `npm.cmd run lint`
- Run Chromium E2E smoke tests: `npm.cmd run test:e2e`
- Install the E2E browser if needed: `npm.cmd run test:e2e:install`

The application uses `HashRouter`. Important routes are:

- `/#/apply`
- `/#/manager/login`
- `/#/manager/dashboard`

## UI wording ground rules

- Use `직접 소개팅 매물 등록하기` for the direct profile registration action.
- In UI role labels (buttons, links, headings, and badges), append a small heart (`❤️`) immediately after `일반 사용자` and a crown (`👑`) immediately after `주선자`, before any action wording such as 로그인 or 회원가입.
- Display the current year dynamically in the service footer; do not hard-code a year.
- Render role icons as small decorative elements with `aria-hidden="true"` so accessible names remain readable. Explanatory prose does not need role icons.
- Preserve these conventions in future UI changes unless the user explicitly changes this rule.

## Supabase safety

- The frontend may use only `VITE_SUPABASE_URL` and a publishable/legacy anon key.
- Never put a secret key, service-role key, database password, personal access token, or admin credential in frontend code, chat output, committed files, or MCP configuration.
- Keep real values in ignored local environment files. Keep only variable names and safe placeholders in `.env.example`.
- The configured Supabase MCP is project-scoped and read-only. Use it for inspection only unless the user explicitly authorizes a change.
- Obtain explicit user approval before changing database schema, migrations applied to a live project, RLS policies, or live data.
- Do not expose dating-profile row data during diagnostics. Prefer schema/catalog metadata and aggregate-free checks.

## Repository and remote operations

- Preserve the existing application. Make focused changes and do not rewrite or reinitialize it.
- Obtain explicit user approval before `git push`, changing GitHub repository settings, or creating/changing a remote repository.
- Never commit `.env` or generated Playwright reports.

## Testing guidance

- Keep route smoke tests in `tests/e2e` deterministic and non-destructive.
- Tests that create or approve/reject real profiles require an explicitly selected test Supabase project and user approval before execution.
- Prefer stable locators (`name`, role, label, or `data-testid`) over text that may change.
