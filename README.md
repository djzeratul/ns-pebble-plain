# 1) Make a public repo, fork this one if you want

Name it something like `ns-pebble-plain`.

# 2) Enable GitHub Pages

Repo → **Settings → Pages**

* Source: **Deploy from a branch**
* Branch: **main** / **/root**
  After you push once, your site will be at:

```
https://<your-username>.github.io/ns-pebble-plain/
```

# 3) Add these files from this repository:

### `package.json`
### `scripts/build.js`
### `.github/workflows/update.yml`


# 4) Add your Nightscout URL and Token as Secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

* Name: `NIGHTSCOUT_URL`
* Value: `https://YOUR-NIGHTSCOUT-HOST` (the same host you use for `/pebble`)
* Name: `NIGHTSCOUT_TOKEN`
* Value: The token used for read access to your nightscout data, if applicable
* Make sure to add your token that generally looks like `?token=readonly-token-goes-here` if you have your nightscout set to private... simply add the token after the equal sign.
* Name: `NIGHTSCOUT_TZ`
* Value: IATA Standard Time Zone for fallback in case it pulls UTC for you. EXAMPLE: `America/Los_Angeles`
* Name: `FORCE_MMOL`
* Value: Boolean `true` or `false`, in case you have MG/DL and you want MMOL, you can force it on here by adding a secret.
* Name: NIGHTSCOUT_UNITS
* Value: (optional: `mmol` or `mgdl`) use this if it doesnt give you the right units display.

# 5) Enable workflows

* Go to Actions > Workflows > Build plain pebble page and "go ahead and enable them".
* The workflow can be viewed and edited at /.github/workflows/update.yml
* Make sure the workflow gets set to enabled, otherwise your data will not update.

# 6) Push to main

Commit all files and push. Pages publishes the site; the Action will refresh `index.html` every ~5 minutes.

---

## Use it on the old browser

Open:

```
https://<your-username>.github.io/ns-pebble-plain/
```

* Pure HTML, no CSS or JS.
* Auto-refreshes every 60s (via `<meta refresh>`).
* Works in Opera Mini / very old phones.
