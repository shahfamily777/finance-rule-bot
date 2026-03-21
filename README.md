# finance-rule-bot

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

This app is not tied to any Vercel account until you connect it. Next.js is built by Vercel and deploys with no extra config in this repo.

### One-time setup

1. Push this repo to GitHub (or GitLab / Bitbucket).
2. Sign in at [vercel.com](https://vercel.com) and click **Add New… → Project**.
3. Import the repository. Vercel will detect **Next.js** and use `npm run build` / `next start` automatically.
4. Under **Environment Variables**, add:
   - **`OPENAI_API_KEY`** — your OpenAI API key (required for `/api/chat` to work). Apply to **Production** (and Preview if you want previews to call the API).
5. Deploy. You get a URL like `https://<project>.vercel.app`.

Local development: copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`.

### Deploy from your machine (Cursor terminal is fine)

You do not have to use the Vercel website for every deploy. From the project folder:

```bash
npm run deploy        # preview deployment
npm run deploy:prod   # production
```

The first run will open the browser (or show a link) so you can **log in to Vercel** and link the project. After that, deploys can stay in the terminal. Set **`OPENAI_API_KEY`** in the [Vercel dashboard](https://vercel.com/dashboard) under your project → **Settings → Environment Variables** (the CLI does not replace that step for secrets).

More detail: [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs) and [environment variables](https://vercel.com/docs/projects/environment-variables).
