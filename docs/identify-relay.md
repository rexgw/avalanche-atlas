# Running Identify outside Claude

Inside Claude, the Identify tab asks Claude directly. On any other website it needs a small relay: a free
Cloudflare Worker that holds your Anthropic API key and passes each photo to Claude. The key stays on the
relay and never appears in the page, so visitors cannot copy it.

Cost, cheapest setup:

| Part | Service | Cost |
|---|---|---|
| Website | GitHub Pages | Free |
| Relay | Cloudflare Workers, free plan (100,000 requests a day) | Free |
| Photo analysis | Anthropic API with Claude Haiku 5.5 (`claude-haiku-5-5`) | Pay per use, roughly a tenth of a cent per identification |

One identification is two requests (identify, then measure for the 3D model). The page shrinks each photo to
about 1 megapixel first, which keeps each request to a few thousand tokens. Check current prices on Anthropic's
pricing page before relying on the estimate.

## 1. Get an API key (Anthropic Console)

1. Sign in at console.anthropic.com and add a small amount of credit under Billing.
2. Under Limits, set a low monthly spend limit (for example $5) so a mistake can never cost more.
3. Under API Keys, create a key and copy it. Treat it like a password.

## 2. Create the relay (Cloudflare)

1. Sign up at cloudflare.com (free plan).
2. Go to Workers & Pages, choose Create, then Create Worker. Name it, for example `strobilus-identify`, and deploy
   the starter.
3. Choose Edit code, replace everything with the contents of `relay/worker.js`, and deploy.
4. Open the worker's Settings, then Variables and Secrets, and add:
   - `ANTHROPIC_API_KEY`, type Secret: the key from step 1.
   - `ALLOWED_ORIGINS`, type Text: the address of your website, with no slash at the end, for example
     `https://rexgw.github.io`. Add more sites separated by commas. For testing on your own computer, add
     `http://localhost:8000`.
   - `MODEL` (optional): leave unset for Claude Haiku 5.5, the cheapest. Set a Sonnet model id for better accuracy
     at a higher price.
   - `MAX_PER_10_MIN` (optional): requests allowed per visitor every 10 minutes, default 30.
5. Copy the worker's address, shown as something like `https://strobilus-identify.yourname.workers.dev`.

## 3. Point the page at the relay

Open `index.html` in a text editor and find this line near the bottom:

```html
window.STROBILUS_ID_ENDPOINT = window.STROBILUS_ID_ENDPOINT || '';
```

Put the worker's address between the last two quotes:

```html
window.STROBILUS_ID_ENDPOINT = window.STROBILUS_ID_ENDPOINT || 'https://strobilus-identify.yourname.workers.dev';
```

(Editing `src/page.html` and running `python3 build.py` does the same and keeps the change on future builds.)

## 4. Publish the website (GitHub Pages)

1. Create a public repository on GitHub, for example `strobilus-atlas`.
2. Upload `index.html` and the whole `img` folder, keeping the folder name.
3. In the repository, open Settings, then Pages, and set the source to the `main` branch, root folder.
4. After a minute the site is live at `https://<your-username>.github.io/strobilus-atlas/`. Its origin, the part
   before `/strobilus-atlas/`, is what goes in `ALLOWED_ORIGINS`.

## Presenting

- Present from the GitHub Pages address in a normal browser. Everything works there, Identify included, and no
  Claude sign-in or permission prompt appears.
- Run one identification before the session to check the relay end to end.
- Keep a screenshot of a result as a backup in case the venue's network blocks the relay.
- To test on your own computer, serve the folder (`python3 -m http.server 8000`) and open
  `http://localhost:8000`. Opening the file directly (`file://`) will not work, because the relay only answers
  the sites in `ALLOWED_ORIGINS`.

## Notes

- The allowed-sites check stops other websites from using your relay from a browser, but it is not a lock: a
  determined person could still call the relay directly. The per-visitor limit and the Anthropic spend limit cap
  the damage. To turn the relay off, delete the worker or remove the API key secret.
- Photos are sent to Anthropic for analysis and are not stored by the relay or the page.
