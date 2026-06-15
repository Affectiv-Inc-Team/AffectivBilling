<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Intrinsic financial modeling app. PostHog is initialized via a shared singleton in `src/lib/posthog.js` using `posthog-js` (the browser SDK, appropriate for this Vite + React SPA). User identity is established at login and cleared on sign-out. Eight business events are tracked across four files covering authentication, model persistence, service line management, and data loading errors.

| Event | Description | File |
|---|---|---|
| `user_signed_in` | User successfully authenticated via email/password | `src/pages/LoginPage.jsx` |
| `user_sign_in_failed` | Login attempt returned an authentication error | `src/pages/LoginPage.jsx` |
| `user_signed_out` | User explicitly triggered sign-out from the header | `src/App.jsx` |
| `model_saved` | User saved the financial model config to Supabase; includes `success`, `company_count`, `service_line_count` | `src/pages/FinancialTool.jsx` |
| `service_line_added` | User added a new service line; includes `service_line_type` | `src/pages/FinancialTool.jsx` |
| `service_line_removed` | User confirmed removal of a service line; includes `service_line_type` | `src/pages/FinancialTool.jsx` |
| `service_line_viewed` | User navigated to a service line tab; includes `service_line_type` | `src/pages/FinancialTool.jsx` |
| `config_load_failed` | Supabase query failed when loading the company config; includes `error_message`, `error_code` | `src/supabase.js` |

User identification: `posthog.identify()` is called with the Supabase user UUID and email on successful login (both in `LoginPage.jsx` and via `onAuthStateChange` in `App.jsx`). `posthog.reset()` is called on sign-out to clear the identity. Exception autocapture is enabled globally via `enable_exception_autocapture: true` in the PostHog init config.

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/471586/dashboard/1715178)
- [Daily sign-ins](https://us.posthog.com/project/471586/insights/dBsWxgsC) — Unique users signing in per day
- [Model saves over time](https://us.posthog.com/project/471586/insights/ePj68Ug7) — Total saves vs failed saves per day
- [Sign-in to model save funnel](https://us.posthog.com/project/471586/insights/VnDX2Yc2) — Conversion from login to saving the financial model
- [Service line adoptions by type](https://us.posthog.com/project/471586/insights/HpIdIv7H) — Which service line types are added most often
- [Sign-in failure rate](https://us.posthog.com/project/471586/insights/01vQtjsq) — Percentage of login attempts that fail over time

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
