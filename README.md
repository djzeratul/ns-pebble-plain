# NS Pebble Plain

Builds a plain html file with the JSON data from your nightscout's pebble endpoint, for display on incredibly old browsers or whatever you want to do with the data.

CAVEATS: This exposes your BG data to the world on a public website, so be sure you're aware of this before moving forward. The code makes it possible to bypass a site in private mode to show BG data on a public site, so be aware of the privacy implications before proceeding.

## 1) Make a public repo, fork this one if you want

Name it something like `ns-pebble-plain`.

## 2) Enable GitHub Pages

Repo → **Settings → Pages**

* Source: **Deploy from a branch**
* Branch: **main** / **/root**
  After you push once, your site will be at:

```
https://<your-username>.github.io/ns-pebble-plain/
```

## 3) Add these files from this repository, if you did not fork:

### `package.json`
### `scripts/build.js`
### `.github/workflows/update.yml`


## 4) Add your Nightscout URL and Token, or Optional Secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

* Name: `NIGHTSCOUT_URL`
* Value: `https://YOUR-NIGHTSCOUT-HOST` (the same host you use for `/pebble`)
* Name: `NIGHTSCOUT_TOKEN`
* Value: Optional, but required for private sites - The token used for read access to your nightscout data, if applicable.
* Make sure to add your token that generally looks like `?token=readonly-token-goes-here` if you have your nightscout set to private... simply add the token after the equal sign.
* Name: `NIGHTSCOUT_TZ`
* Value: Optional: IATA Standard Time Zone for fallback in case it does not pull your profile TZ. EXAMPLE: `America/Los_Angeles`
* Name: `FORCE_MMOL`
* Value: Optional: Boolean `true` or `false`, in case you have MG/DL and you want MMOL, you can force it on here by adding a secret.
* Name: `NIGHTSCOUT_UNITS`
* Value: Optional: `mmol` or `mgdl`, use this if it doesnt give you the right units display.

## 5) Enable workflows

* Go to Actions > Workflows > Build plain pebble page and "go ahead and enable them".
* The workflow can be viewed and edited at /.github/workflows/update.yml
* Make sure the workflow gets set to enabled, otherwise your data will not update.

## 6) Push to main

Commit all files and push. Pages publishes the site; the Action will refresh `index.html` every ~5 minutes.

---

### Use it on the old browser

Open:

```
https://<your-username>.github.io/<your-repo-name>/
FOR EXAMPLE, MINE: https://djzeratul.github.io/ns-pebble-plain/
```

* Pure HTML, no CSS or JS.
* Auto-refreshes every 60s (via `<meta refresh>`). Cache-buster since github likes to cache stuff even if it has changed. The Cache Buster will reload the page with a ?r=####### query string appended to tell github to pull from the page on origin instead of cache. If you refresh the page and expect to see new data, you can change the random numerals at the end of the equal sign to a different string and it will update from origin.
* Works in Opera Mini / very old phones.
