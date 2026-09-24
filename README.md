# Rant to X

Speak, upload audio, or paste a rant. Whisper transcribes audio on the server. You can lightly paraphrase the draft, then turn it into a polished **X Article** (title + body). You edit the draft, then **Post on X** takes you to a confirmation page. One more tap copies the article and opens X’s Articles composer so you can paste.

No accounts, no database, no X OAuth.

## How capture works

1. **Record** captures microphone audio in the browser (up to 5 minutes). **Stop** uploads the clip to `POST /api/transcribe`.
2. **Upload** sends an audio file (mp3, wav, webm, m4a, ogg, flac; max 25 MB) the same way.
3. OpenRouter transcribes with `openai/whisper-large-v3-turbo`. The text is appended to the rant transcript.
4. **Paraphrase** sends the current rant (or the article body) to `POST /api/paraphrase`, which uses `deepseek/deepseek-v4-flash-0731` for a light edit. The cleaned text replaces the field you started from.
5. **Turn into article** still rewrites the rant into a title + body (see Rewrite API below).
6. **Post on X** is unchanged: it stores the article in this tab and opens Copy & continue.

Typing or pasting into the transcript still works if you skip audio.

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

Recording needs a microphone and a secure origin. You can always upload a file or type.

```bash
npm run build
```

## Environment variables

Copy `.env.example` to `.env.local`. **Do not** put secrets in `NEXT_PUBLIC_*` variables. The OpenRouter key stays on the server.

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Server-only. Required for speech-to-text and paraphrase. |
| `AI_GATEWAY_API_KEY` | Optional. Routes **Turn into article** through [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). |
| `OPENAI_API_KEY` | Optional. Used for rewrite when the Gateway key is unset. Direct OpenAI via `@ai-sdk/openai`. |

If `OPENROUTER_API_KEY` is missing, transcribe and paraphrase return a short UI error. They do not fall back to a demo transform.

If **neither** rewrite key is set, `POST /api/rewrite` returns a deterministic local transform and marks the draft as **demo**. Copy & continue still works.

There are **no X API credentials**. Do not create a developer app for this MVP.

## Transcribe API

`POST /api/transcribe` (multipart form data)

Field: `file` — audio clip, max 25 MB.

Success:

```json
{ "text": "…" }
```

Uses OpenRouter `https://openrouter.ai/api/v1/audio/transcriptions` with model `openai/whisper-large-v3-turbo`.

## Paraphrase API

`POST /api/paraphrase`

```json
{ "text": "the current draft…" }
```

Success:

```json
{ "text": "…" }
```

Uses OpenRouter `https://openrouter.ai/api/v1/chat/completions` with model `deepseek/deepseek-v4-flash-0731`.

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

Import the repo, set `OPENROUTER_API_KEY` for transcription and paraphrase, set `AI_GATEWAY_API_KEY` or `OPENAI_API_KEY` if you want model rewrites, and deploy. Microphone capture requires HTTPS (Vercel provides that).
