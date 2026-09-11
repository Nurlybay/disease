# Guided case authoring

Teacher home now shows only description, portrait selection and scenario review. Legacy constructor controls are under Advanced case settings; journal/manual navigation is removed from the page. Existing stored cases are not deleted.

`teacher-case` validates confirmed teacher/admin roles through Auth, reserves a request from the existing atomic patient-chat budget and calls Gemini 2.5 Flash-Lite through OpenRouter with a JSON schema. No provider key is sent to the browser. Text is a fictional teaching draft, not guideline retrieval or clinical validation. Output shape/length and aliases are validated; medical accuracy still requires teacher review. Image/video generation is separate and uses the existing reviewed media workflow. No automatic paid retries or publication.

Case generation and patient chat currently share their user/global request budgets. Drafts save to existing local browser storage; cross-device publication remains in advanced settings through the existing Sync service. Trial launch asks for review confirmation. This is a UX check, not a backend medical approval system. Custom cases use existing scripted dialogue and keyword matching; this change does not add them to the server's built-in AI patient catalog. Audio findings are not fabricated from text.

Deploy `teacher-case` and regenerated `learning-content`, then publish the frontend. Rebuild `site/vendor/learning-access.js` with `npm --prefix tools/auth-build run build`. No new environment variables: OPENROUTER_API_KEY and existing Supabase defaults are used. No database migration required.

Tests: `node tools/test-teacher-case.js`, `node tools/test-learning-access.js`, browser `tools/test-teacher-wizard.js` with CHROME_PATH and bundled Playwright NODE_PATH. They use mocked AI, so prove flow and contracts, not actual provider latency or medical quality.
