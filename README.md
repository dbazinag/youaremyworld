# you are my world 🐈🐈‍⬛

A cozy little corner of the internet for **Lion** (Dominic, Lausanne 🇨🇭) and
**Mimi** (Isabelle, Barrie 🇨🇦) — a countdown to seeing each other, then a private
scrapbook of everything that makes the distance worth it.

## How to look at it right now

No build step, no install. Just open it:

- **Easiest:** double-click `index.html`.
- **Better (so fonts/modules behave exactly like the real site):** run a tiny local server from this folder:
  ```bash
  python3 -m http.server 8000
  ```
  then visit <http://localhost:8000>.

### Try the flow
1. The **countdown** is the public landing page.
2. To preview what happens at zero without waiting, temporarily set `reunionISO`
   in `assets/js/config.js` to a date in the past → you'll see the **"you made it"** screen.
3. Click **open our world** → enter the temporary password (`mimi+lion`, set in
   `config.js`) → you reach the **scrapbook placeholder**.

> ⚠️ The password right now is a **placeholder only** — it lives in the code and is
> not real security. The real shared login arrives with Supabase (next phase).
> Don't put anything truly private in here until then.

## What's built (Phase 1)
- [x] Cozy handmade-scrapbook look (warm paper, washi tape, hand-drawn cats)
- [x] Live countdown to **June 18, 2026, 6:00 PM Eastern**
- [x] Reunion / "you made it" celebration screen
- [x] Walkable flow: countdown → congrats → password gate → app shell
- [x] Decent on mobile

## What's next (roadmap)
- [ ] **Supabase** project + real shared login (replaces placeholder password)
- [ ] **Timeline / scrapbook** with photos (Scrapbook view + Constellation/stars view)
- [ ] **Mimi & Lion mood page** — tap your cat to set a mood, syncs live; cats
      auto-sleep based on each person's local time
- [ ] **Two clocks + "awake together" window**, two-city **weather**, **distance** on a map
- [ ] **Map of places** (been / someday) + **love-notes** + **music playlist**
- [ ] Long-distance extras: reunion-fund jar, watch-together, care-package tracker, sunset relay
- [ ] **Goodnight ritual**, **cat unlockables**
- [ ] Editable **settings** (city/timezone) so it updates when someone moves
- [ ] Deploy to **GitHub Pages**

## Deploying to GitHub Pages (when ready)
1. Create a GitHub repo and push this folder.
2. Repo **Settings → Pages → Build from branch → `main` / root**.
3. It'll be live at `https://<username>.github.io/<repo>/`.

Because there's no build step, pushing is all it takes — the files are the site.

## Project layout
```
index.html              the whole flow (4 screens)
assets/css/main.css     the cozy theme
assets/js/main.js       flow + countdown logic
assets/js/config.js     edit-me values (reunion date, password, people)
```
