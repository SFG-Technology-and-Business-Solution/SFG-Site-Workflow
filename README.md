# VSM Buddy

A standalone Value Stream Mapping web app. Guides you through learning what to
collect, entering measured process data, drawing the value stream map, and
building an improvement action plan.

Includes an **AI Capture Agent** (floating "Capture with AI" button in the map
workspace): a guided interview that asks for the data step by step, answers
questions about any step, accepts voice input (tap the mic once to talk, tap
again to stop) and speaks its replies. Powered by Google Gemini server-side —
set the `GEMINI_API_KEY` environment variable on the Netlify site (optional
`GEMINI_MODEL`, default `gemini-2.5-flash`).

Maps are saved in the browser (localStorage) and synced to a **shared team
library** stored in Netlify Blobs — everyone using the site sees the same
saved maps. Without Netlify (e.g. local dev) the app falls back to
local-only storage.

Built with [Next.js](https://nextjs.org), Tailwind CSS, and lucide-react.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

The app deploys to Netlify (configuration in `netlify.toml`).

`standalone/vsm-buddy-lite/` contains a separate single-file lite version of
the page, deployed independently to the vsm-buddyv1 Netlify site.
