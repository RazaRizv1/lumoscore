# Release process

Two repositories, on purpose:

| Repo | Visibility | Holds | Feeds |
|---|---|---|---|
| `RazaRizv1/lumoscore` | **public**, open source | `main` only | lumoscore.com |
| `RazaRizv1/lumoscore-staging` | **private** | `testing-lumoscore` | the gated staging site |

Work happens on `testing-lumoscore` in the **private** repo. Nothing work-in-progress is ever
pushed to the public one — no half-finished commits, no broken intermediate states, no reverts.

## Promoting to production

Every few days, once staging has been audited and is genuinely good:

```
git checkout main
git merge --squash testing-lumoscore     # one clean commit, WIP history stays private
git commit -m "<what changed, in plain terms>"
git push origin main                     # public repo -> lumoscore.com
```

**Squash, never a plain merge.** A normal merge replays every staging commit onto public `main`,
which would publish exactly the messy middle the private repo exists to hide.

After promoting, bring `testing-lumoscore` back in line so the next cycle starts clean:

```
git checkout testing-lumoscore
git merge main
git push staging testing-lumoscore
```

`main` is what lumoscore.com serves. **Nothing lands on `main` without going through
`testing-lumoscore` first.**

This exists because on 2026-08-14 a transform deleted 83 unrelated scripts, every automated gate
passed, the page rendered perfectly in the browser it was checked in, and the site shipped broken to
real users handling real funds. The gates were not the problem. The verification was.

---

## Deploying to staging

The Pages project **is git-connected**, and `testing-lumoscore` is its **production** branch. Pushing
builds and deploys automatically — confirmed against `wrangler pages deployment list`, which shows one
Production deployment per pushed commit.

So the normal path is just:

```
git push staging testing-lumoscore
```

### Checking a deploy actually landed

`lumoscore-staging.pages.dev` is behind Cloudflare Access, so fetching it returns the LOGIN page — a
grep there reports every change as missing, whether it shipped or not. Never judge a deploy that way.

The per-deployment hash URL is NOT gated, so read that instead:

```
npx wrangler pages deployment list --project-name=lumoscore-staging
# take the newest Production row, open its https://<hash>.lumoscore-staging.pages.dev
```

### Manual upload (fallback only)

```
npm run deploy:staging
```

Do NOT add `--branch`: wrangler takes the branch from git, and `testing-lumoscore` is the production
branch. Passing `--branch=main` publishes a PREVIEW that the main URL never serves.

`npm run deploy` is the PRODUCTION project (lumoscore.com). Do not reach for it by reflex.
## The flow

1. Work on `testing-lumoscore`.
2. Build, run the gates below, push.
3. Check it on the preview URL — **on a real phone**, against the list under "Before merging".
4. Only then merge to `main`.

---

## Gates (necessary, nowhere near sufficient)

```
node _tools/<transform>.js
node _tools/extract_site.js aptos --root
node _tools/predeploy_check.js
```

Plus the inline-script parse check over every built page (0 failures).

**What these actually prove: the build is not corrupt. That is all.** Every one of the broken
deploys on 2026-08-14 passed all of them. A green gate is not evidence that a feature works.

---

## Before merging to `main`

Check on the **preview URL**, not localhost. The local file-swap harness has misreported twice and
sent two fixes at causes that did not exist.

- [ ] **Desktop and mobile.** Mobile has its own markup and its own transforms (`_mobdex`,
      `_mobwallet`, `_mobbar`, …). A fix written against a desktop selector like `.br-table` or
      `#dexMoverGrid` silently does nothing on the phone. This has caused at least five separate
      bugs — ticks, the transaction list, the nav bar, the font weight, the link colour.
- [ ] **Motion enabled.** Cards are held at `opacity:0` until a reveal script runs
      (`html.lcm-ready .quick-card:not([data-lcm-done])`). Under `prefers-reduced-motion: reduce`
      that gate never applies, so a broken page looks perfect. That is exactly how the outage
      shipped.
- [ ] **A real phone.** Not device-mode alone. `100vh`, tap-vs-click, and iOS link colour all behave
      differently on hardware.
- [ ] **Connected and disconnected.** The browser pane injects no wallet extension, so the connected
      path cannot be checked from the agent side at all. This one is on the human.
- [ ] **Reload once more.** Flash-of-old-data appears on the second load, not the first.

---

## Containers: the thing branching does NOT protect

`lumoscore-*-{desktop,mobile}.html` are **gitignored**, so they are shared across every branch.
`git checkout` does not switch them and `git revert` does not restore them.

A destructive transform run on `testing-lumoscore` damages the source for `main` too. That is
precisely how the 83-script deletion survived a revert: git restored `dist/`, the containers kept the
damage, and only the last good build in git made recovery possible.

**So:** snapshot the two aptos containers before running any transform that deletes rather than adds.

```
cp lumoscore-aptos-desktop.html _BACKUP_$(date +%Y%m%d)/
cp lumoscore-aptos-mobile.html  _BACKUP_$(date +%Y%m%d)/
```

Transforms that remove content should assert what they removed and refuse to write on a mismatch —
see the guard in `_tools/_langoff.js`, which is the only thing that would have caught the outage
before a human looked at it.

---

## Reporting

Say what was checked and under what conditions. "Deployed, and the bytes are live" is not "the
behaviour is confirmed" — name which one it is, and name the conditions the check did not cover.
