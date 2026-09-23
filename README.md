# Raree Show Admin

A separate editorial application for Raree Show. It manages works, reading routes, characters, locations, and story frames on the same Supabase data the reader app uses.

It is not a public reading experience. Sign-in is required.

## Access

[https://raree-show-admin.vercel.app](https://raree-show-admin.vercel.app)

Unauthenticated requests are redirected to `/login`. There is no public demo account.

The reader application is [Raree Show](https://raree-show-web.vercel.app).

## What it manages

Operators work from a work list. Each work opens into the editorial surfaces below.

- **Works.** Create, edit, and delete works, including cover images and the description shown to readers.
- **Reading routes and frames.** Author the story units and frame captions the reader moves through, including chapter and order metadata.
- **Characters and locations.** Maintain the catalogs attached to a work. Locations store map coordinates. Character portraits and frame images can be uploaded or drafted, then written into the work by a person.
- **Discovery.** Paste source text, review proposed characters, locations, stories, and frames, and accept or reject them before anything is saved as work content.
- **Rollout.** Write accepted discovery material into the work, then open the reader app to check the result.
- **Production.** Track portrait and frame draft jobs for a work. A generated candidate stays a draft until it is written into the work.

Search-index backfill for a work is available as an operator action. It is a maintenance tool, not part of the reader.

## Engineering

Next.js 16 (App Router), TypeScript, Tailwind CSS, and shadcn/ui. Data and sign-in go through Supabase. `middleware.ts` sends anonymous visitors to `/login` and signed-in visitors away from that page.

Forms use React Hook Form and Zod. Entity access lives under `lib/`. Discovery proposals and rollout writes are separate from the reader runtime: accepting a proposal or a generated image is an editorial step, and the reader only sees content after it has been written into the work.

Shared rules are pulled in as a `governance/` submodule. `npm run dev` bootstraps that submodule before the dev server starts. `npm test` runs Vitest.

Images are uploaded through Cloudinary. Provider API keys and the Supabase service-role key are read from the environment at runtime. They are not stored in this repository.

## Repository

```text
app/            App Router pages, sign-in, and admin route handlers
components/     Work, route, character, location, discovery, and production UI
lib/            Supabase access, discovery, rollout, and image handling
hooks/          Client data hooks
docs/           ADRs, specs, and spikes for this app
scripts/        Governance bootstrap and local operator scripts
__tests__/      Vitest
middleware.ts   Supabase session check and route protection
governance/     Shared governance submodule (raree-governance)
```

## Local development

This repository does not ship an `.env.example`. Create `.env.local` with the public Supabase values for the project you are using:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

```bash
git clone https://github.com/yoghourt/raree-show-admin.git
cd raree-show-admin
npm install
npm run dev
```

The first `npm run dev` needs network access so it can fetch `governance/`. Open [http://localhost:3000](http://localhost:3000). You will land on the sign-in page.

```bash
npm test
npm run lint
npm run check:governance
```

Server-only keys used by discovery text calls, image draft jobs, or maintenance scripts also belong in `.env.local`. Do not commit that file.

## Related repositories

| Repository | Role |
| --- | --- |
| [Raree-show-web](https://github.com/yoghourt/Raree-show-web) | Public reader application |
| [raree-governance](https://github.com/yoghourt/raree-governance) | Shared constitution, architecture decisions, specifications, and runtime vocabulary |

Admin and the reader app are separate Next.js applications. They share Supabase data. Governance is a document repository, mounted here as a submodule, and is not the product runtime.
