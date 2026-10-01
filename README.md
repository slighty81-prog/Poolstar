# PoolStar Smart Care — GitHub-ready functional demo

A plain Node.js prototype for a PoolStar monthly pool-care subscription service. **No Docker is required.**

## What works
- Customer sign-up + sign-in
- Persistent JSON database (`data/db.json`)
- Saved pool profile: pool volume, pool type, filter, usage frequency, bather load, baseline readings
- PoolStar-aligned target bands and rules-based recommendation engine
- Test-strip photo upload flow with prototype image estimate + confirmation step
- Recommended monthly plan based on pool volume and estimated sanitiser demand
- Basic / Standard / Ultra / Premium subscription selection
- PoolStar product catalogue with real PoolStar product names and imagery
- Demo one-off product ordering
- Customer dashboard with current plan, next shipment and pool details
- Responsive phone layout
- No npm dependencies

## Put it on GitHub
1. Create a new GitHub repository, for example `poolstar-smart-care`.
2. Upload **all files and folders in this project** to the root of the repository.
3. Commit to the `main` branch.
4. GitHub Actions will automatically run a basic Node syntax check on each push.

## Run it directly in GitHub Codespaces tonight
This is the fastest way to run the **full backend** from GitHub without Docker setup on your own computer.

1. Open the repo on GitHub.
2. Click **Code** → **Codespaces** → **Create codespace on main**.
3. When the terminal opens, run:

```bash
npm start
```

4. Codespaces should detect port `3000`. Open the forwarded port in the browser.
5. If you need to show somebody else, open the **Ports** tab, right-click port `3000`, change **Port Visibility** to **Public**, then copy the forwarded URL.

The Codespaces URL is suitable for a live demo, but it is not intended to be your permanent production URL.

## Permanent deployment from the GitHub repo
GitHub Pages can only serve static files and **cannot run this Node backend**. Keep the source code in GitHub, then connect the repository to any normal Node host such as Render or Railway.

Use:
- Runtime: Node 20+
- Build command: none required (or `npm install`)
- Start command: `npm start`
- Port: supplied automatically by the host via `PORT`

The server already reads `process.env.PORT`.

## Run locally
With Node 18+ installed:

```bash
npm start
```

Open `http://localhost:3000`.

## Important production note
The JSON database is fine for a stakeholder demo and local/Codespaces use. On a permanent host, use a persistent database such as PostgreSQL before real customer launch. Production should also add payment processing, fulfilment integration, dangerous-goods freight rules, email notifications, and technically validated PoolStar dosing rules.

## Pool chemistry / AI note
This is a functional stakeholder prototype, not a chemically validated automatic dosing service. Before commercial launch:
- Validate every dosing rule and product dose against current PoolStar labels/SDS and Damar technical approval.
- Replace prototype strip-photo estimation with a calibrated vision model trained against the exact PoolStar strip colour chart.
- Add confidence thresholds and manual confirmation before dosing advice is issued.
