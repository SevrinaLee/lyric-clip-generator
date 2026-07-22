# TikTok Content Posting API — app-review kit (S6.2)

> Goal: let a signed-in user post a finished clip straight to their own TikTok.
> This needs TikTok's **Content Posting API** with the **`video.publish`** scope,
> which requires an **app audit**. Until the audit passes, every post is forced
> to **private (`SELF_ONLY`)** — so the feature is only publicly useful *after*
> approval. That audit is the long pole; everything else here is prep.

**What only you can do** (account/consent actions — I can't perform these):
register the app, agree to TikTok's developer terms, and submit for audit.
**What's already done in the repo:** a flag-gated Login-Kit OAuth + Direct-Post
integration that stays completely dark until you set the credentials below, so
it's safe in production and ready to demo the moment the app is registered.

---

## 0. Prerequisites you must have ready before submitting
- A **published, reachable Privacy Policy URL** and **Terms of Service URL** —
  these now exist at `https://lyric-clip-generator.vercel.app/privacy` and
  `/terms`. Before submitting, set the real contact email + jurisdiction in
  `app/legal/content.ts` (currently placeholders).
- The **production domain** verified (TikTok requires URL/domain verification for
  `PULL_FROM_URL`; the scaffold uses `FILE_UPLOAD` to avoid that dependency for
  the demo — see §4).
- A **screen-recording** of the full flow (login → pick a clip → post → it
  appears on a TikTok account) for the audit submission.
- A TikTok account you control to demo with (posts will be private until audited).

## 1. Register the app (TikTok for Developers portal)
1. Sign in at **developers.tiktok.com** with your TikTok account and complete
   developer registration (accept their terms — your action).
2. **Create an app**. Fill in name, description, icon, category, and the
   **Privacy Policy** + **Terms of Service** URLs from §0.
3. Note the **Client Key** and **Client Secret** — these become
   `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` (§5).

## 2. Add products + scopes
- Add the **Login Kit** product.
- Add the **Content Posting API** product and enable **Direct Post**.
- Request scopes: **`user.info.basic`** (identify the account) and
  **`video.publish`** (Direct Post). `video.publish` is the one that needs audit.

## 3. Configure the redirect URI
Register this exact callback (HTTPS, absolute, static, no query/fragment, <512 chars):

```
https://lyric-clip-generator.vercel.app/api/tiktok/callback
```

TikTok allows up to 10 redirect URIs. Add a preview/staging one too if you test
there. The scaffold reads the URI from the request origin, so it works on any
registered host.

## 4. Posting method — FILE_UPLOAD vs PULL_FROM_URL
- **`FILE_UPLOAD`** (what the scaffold uses): we send the clip bytes directly to
  TikTok's upload URL. **No domain verification needed** — best for the audit demo.
- **`PULL_FROM_URL`**: TikTok fetches the clip from a URL you host, but that URL's
  **domain must be verified** in the portal first. Consider switching to this
  later for efficiency (avoids proxying bytes), after verifying the Supabase
  storage domain (or a custom domain in front of it).

## 5. Set the credentials (makes the feature go live in the app)
Add to the Vercel project env (and `.env.local` for dev):

```
TIKTOK_CLIENT_KEY=xxxxxxxx
TIKTOK_CLIENT_SECRET=xxxxxxxx
```

While these are **unset**, the integration is completely dark: the
`/api/tiktok/*` routes return 404 and no TikTok UI renders. Setting them turns on
the "Post to TikTok" affordance. (No code change or redeploy of logic needed —
just the env vars + a redeploy to pick them up.)

## 6. Test the flow end-to-end (still pre-audit → posts are private)
1. Set the env vars, redeploy.
2. On a rendered clip, use **Post to TikTok** → authorize on TikTok → the clip
   uploads and posts to your account as **private** (expected pre-audit).
3. Confirm it appears (privately) on the account. Screen-record this for §7.

## 7. Submit for audit
In the portal, submit the app / `video.publish` scope for review. Provide:
- The **use-case description**: "Users create captioned lyric video clips in
  Lyric Clip Generator and publish their own clip to their own TikTok account."
- The **demo video** from §6.
- Privacy Policy + Terms URLs.
- Any questionnaire TikTok presents about data use and content.

Typical review turnaround is on the order of days to a couple of weeks; they may
come back with change requests. Until it passes, keep the default privacy at
`SELF_ONLY` (the scaffold does this).

## 8. After approval — flip to public posting
Once audited, relax the default privacy from `SELF_ONLY` to the user's choice
(TikTok returns the account's allowed privacy levels via the
`/publish/creator_info/query/` endpoint; surface those as a picker). This is a
one-line default change plus a small UI — tracked as a follow-up, not needed to
start the review.

---

## Technical reference (what the scaffold implements)
- **Auth URL**: `https://www.tiktok.com/v2/auth/authorize/` with `client_key`,
  `scope`, `redirect_uri`, `state` (CSRF, stored in an httpOnly cookie),
  `response_type=code`.
- **Token exchange**: `POST https://open.tiktokapis.com/v2/oauth/token/`
  (`grant_type=authorization_code`).
- **Direct Post (FILE_UPLOAD)**:
  `POST https://open.tiktokapis.com/v2/post/publish/video/init/` with
  `post_info.privacy_level = SELF_ONLY` and `source_info.source = FILE_UPLOAD`,
  then `PUT` the clip bytes to the returned `upload_url`.
- **State/CSRF**: `state` + optional target `exportId` are signed into a cookie
  and verified on callback.
- **Files**: `lib/tiktok.ts` (config flag + auth URL + token exchange + post),
  `app/api/tiktok/start/route.ts`, `app/api/tiktok/callback/route.ts`. All
  return 404 when `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` are unset.

## Status
- [x] Integration scaffold (flag-gated, dark until configured) — in repo
- [ ] Register app + get Client Key/Secret — **you**
- [ ] Host Privacy Policy + Terms URLs — **you**
- [ ] Set env vars + redeploy — **you**
- [ ] Record demo video — **you**
- [ ] Submit for audit — **you**
- [ ] Post-approval: privacy-level picker — follow-up
