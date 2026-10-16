# UniLink update notes

## Latest UI and event updates
- The AI assistant launcher is moved above the composer on Chat rooms and Messages so it no longer covers the send button. The assistant panel is shorter on those pages.
- Profile access and the dark/light theme toggle are available in the top-right app bar on desktop and mobile.
- Chat-room information headers and message composers stay anchored while the message history scrolls; direct-message headers/composers are anchored too.
- Campus events now support start and end dates. The end date cannot be earlier than the start date, and date ranges are displayed in event cards, the Home page, Community feed, event attendance/certificates, and the admin Home manager. Existing events are backfilled as single-day events.

## Database migration
- Local SQLite databases are upgraded automatically when the server starts.
- For Supabase deployments, apply `supabase/migrations/20261016100000_event_end_dates.sql` before using the updated event form.

## Validation status
- Server/script syntax checks and SQLite startup smoke test were run.
- Frontend production build/typecheck could not be completed in this environment because npm dependencies could not be installed; run `npm ci`, `npm run typecheck`, and `npm run build` before deploying.
- Existing external services (Supabase project settings and any configured AI provider) still need their own credentials and deployment configuration.

## Review fixes (server and events)
- Events: the server now rejects an end date before the start date or an invalid date (create and edit), and stores a single-day event's end date as its start date. Before, only the browser form checked this.
- Events: the upcoming/past check on the Events page no longer marks today's events as past for people west of UTC; the Home page now shows the date range on event cards and parses dates as local days.
- Events (Community tab): the list shows upcoming events first, so old events can no longer push new ones past the 100-row limit.
- RSVP to a college-only event and joining a college-only study group now check college membership on the server.
- An event's organizer can no longer be changed through an edit.
- Still not run here (npm registry was unreachable): `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`. Run them before deploying.
- Student tools > My Dashboard crashed to a blank page (the saved-goals list was read as the wrong shape). Fixed in src/pages/StudentToolsPages.tsx.
- AI assistant: higher token limit (Gemini 2.5/3 models can use the budget on thinking and return an empty answer) and the provider's real error is now printed in the server terminal as `[assistant] ...`.
