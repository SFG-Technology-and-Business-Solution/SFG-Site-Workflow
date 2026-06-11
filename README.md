# VSM Buddy

A standalone Value Stream Mapping web app. Guides you through learning what to
collect, entering measured process data, drawing the value stream map, and
building an improvement action plan. Maps are stored in the browser via
localStorage — no backend required.

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
