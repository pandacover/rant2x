# Rant to X

Speak (or paste) a rant. Speech-to-text captures it in the browser. An LLM rewrites it into a polished **X Article** (title + body). You edit the draft, then **Post on X** takes you to a confirmation page. One more tap copies the article and opens X’s Articles composer so you can paste.

No accounts, no database, no X OAuth.

## How publish works

X does **not** expose a public Articles compose deep link that prefills title and body (no `intent`-style query params for Articles). Tweet intents such as `https://x.com/intent/post?text=` only prefill a short post, which is the wrong shape for a long-form article.

Browsers also block clipboard writes that are not tied to a clear user gesture (especially on mobile, or when `window.open` races a popup blocker). **Post on X** therefore does not copy and redirect in the same click from the studio.

1. **Post on X** writes the current title + body to **sessionStorage** (this tab only) and navigates to `/publish`
2. `/publish` shows destination hostname `x.com`, a clipboard preview, and **Copy & continue**
3. That click copies `title` + blank line + `body` (`formatArticleForClipboard`) and then goes to [x.com/compose/articles](https://x.com/compose/articles) in the **same tab**
4. Paste in the Articles editor, then publish on X

The draft is **not** put in the URL. sessionStorage is tab-scoped and can hold long articles; if it is missing (new tab, storage blocked, or a cold visit to `/publish`), the page asks you to go back to the studio. There is no query/hash fallback. Returning to the studio in the same tab restores the last title, body, and rant from that snapshot.

If the clipboard write fails on **Copy & continue**, the full article stays on the page so you can copy it manually, and **Open Articles** still goes to the composer.

A separate **Copy** button on the studio copies the same payload without leaving the page. There are no X developer credentials and no OAuth. X Articles typically requires a Premium account.

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
