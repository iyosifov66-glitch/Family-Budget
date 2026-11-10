# Family Budget

Milestone 1 sets up a private, two-person household budget for Android and iOS. It uses Expo, TypeScript, Expo Router, Supabase Auth and Postgres, TanStack Query, React Hook Form, Zod, and SecureStore.

## Run locally

1. Install Node.js 22.13+ and npm. Run `npm ci` from this directory.
2. Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and start Docker. Run `supabase start` to start an isolated local stack and apply the included migration. Use `supabase status` to obtain the local API URL and publishable key.
3. Copy `.env.example` to `.env` and enter the API URL and publishable key. A physical device needs a LAN-reachable host address, and the stock Android emulator uses `10.0.2.2` to reach the host. A hosted development project can use its HTTPS project URL. Never put a service-role or secret key in an Expo public variable.
4. Install an Android development build with `npm run android` (Android Studio, SDK and JDK) or an iOS development build with `npm run ios` (macOS and Xcode). Run `npm start` for subsequent sessions. Use a development build for the registered `familybudget` callback scheme.
5. For local Auth emails, open the mail inbox URL listed by `supabase status`, normally `http://127.0.0.1:54324`. For password recovery, open the email on the device that requested the reset. If using local Supabase, replace the email's API hostname with a device-reachable address when necessary and keep its path and query intact.

## Configure a hosted Supabase project

- Set up a separate development project or branch and apply the migration there using your normal Supabase migration workflow. Confirm the target before pushing. The supplied workspace had no remote or link metadata.
- Enable the Email provider, email signup, and email confirmation. Set the minimum password length to at least 8 characters.
- Add the exact Auth redirect URLs `familybudget://verify` and `familybudget://reset`. Keep the default password recovery template with `{{ .ConfirmationURL }}` so the requesting device can exchange the PKCE code.
- Replace the **Confirm signup** email template with `supabase/templates/confirmation.html`. Signup and resend both use the one-time code in this template. Configure SMTP to deliver Auth email to household addresses and disable tracking that rewrites recovery links.
- Use the project's publishable key on mobile. The migration publishes membership and invitation changes for Supabase Realtime.
- A household invitation is an expiring database record tied to the recipient's verified email. Settings provides an email draft the inviter can send. The recipient installs the app, signs in with that address, and accepts from the setup screen.

## Checks

```sh
npm run typecheck
npm test
npm run export:mobile
```

Vitest checks Auth calls and input handling. Database tests apply the real migration in isolated PGlite PostgreSQL with a minimal Supabase Auth fixture. They exercise household creation, invitation authorization and replay, table grants, row-level visibility, the member cap, and cross-household foreign keys.

For device and hosted integration checks, register two test accounts, confirm both via email, sign in, and relaunch to check session persistence. Create a household, send an invitation, and accept it as the second account. Check that the member count refreshes on the first device. Try the same invitation from another verified account, and try two simultaneous accept calls with the invitee session. Confirm a single slot-2 row and an idempotent result for the retry. Check sign-out and the recovery link on the device that requested it.

## Project layout

- `src/app/` contains the root, Auth callbacks, and five tab routes.
- `src/features/auth/` contains validation, Auth operations, forms, and session lifecycle.
- `src/features/household/` contains onboarding, member and invitation settings, and Realtime query invalidation.
- `src/ui/` contains theme-aware screen, typography, form, and status components.
- `src/lib/` configures the Supabase client.
- `supabase/` contains local configuration, the email template, and the schema migration.
- `tests/` contains the Auth and database suites.

The schema stores EUR amounts in integer cents. Household creation seeds 14 categories, with Savings flagged as a reserve. Monthly allocations start empty. The household will enter its own category amounts when planning is available. The budget, transfers, and analytics tabs have empty states. Allocation editing, expense entry, rollover, transfer execution, and analytics are later milestones.



## Verify the intended hosted target

The intended project ref is `pytqcicfcjitriafeypr`. The project URL is
`https://pytqcicfcjitriafeypr.supabase.co`. Verify the ref in the dashboard
and the CLI before deploying. The steps below link and inspect the target
without applying migrations.

```sh
supabase login
supabase link --project-ref pytqcicfcjitriafeypr
supabase migration list --linked
supabase db push --linked --dry-run
```

Review the remote migration history and dry-run output before requesting
deployment approval. Confirm the hosted Auth settings against the local
configuration and email template above. Keep the project publishable key in
your ignored local `.env`.
