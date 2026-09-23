# Rant to X

Speak (or paste) a rant. Speech-to-text captures it in the browser. An LLM rewrites it into a polished **X Article** (title + body). You edit the draft, then **Post on X** copies it and opens X’s Articles composer so you can paste once.

No accounts, no database, no X OAuth.

## How publish works

X does **not** expose a public Articles compose deep link that prefills title and body (no `intent`-style query params for Articles). Tweet intents such as `https://x.com/intent/post?text=` only prefill a short post, which is the wrong shape for a long-form article.

**Post on X** therefore:

1. Copies `title` + blank line + `body` to the clipboard
2. Opens [x.com/compose/articles](https://x.com/compose/articles) in a new tab

Paste the first line into the Articles headline, then the rest into the body. X Articles typically requires a Premium account. If the popup is blocked, the app copies anyway and navigates the current tab.

A separate **Copy** button copies the same payload without opening X.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

Chrome, Edge, and Safari support the Web Speech API. Firefox does not — use the transcript box to paste or type.

```bash
npm run build
```

## Environment variables

Copy `.env.example` to `.env.local`. **None are required** for the UI or the publish button.

| Variable | Purpose |
| --- | --- |
| `AI_GATEWAY_API_KEY` | Preferred. Routes rewrite through [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). |
| `OPENAI_API_KEY` | Used when the Gateway key is unset. Direct OpenAI via `@ai-sdk/openai`. |

If **neither** key is set, `POST /api/rewrite` returns a deterministic local transform and marks the draft as **demo**. The rest of the product still works.

There are **no X API credentials**. Do not create a developer app for this MVP.

## Rewrite API

`POST /api/rewrite`

```json
{ "rant": "the raw rant…" }
```

Success:

```json
{ "title": "…", "body": "…", "demo": false }
```

`demo` is `true` when the local fallback ran.

## Deploy on Vercel

Import the repo, set `AI_GATEWAY_API_KEY` or `OPENAI_API_KEY` if you want model rewrites, and deploy. Microphone capture requires HTTPS (Vercel provides that).
