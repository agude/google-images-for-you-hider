# Google Images For You Hider

A small Firefox add-on that hides Google Images’ personalized landing gallery
and its **More results** section while keeping the search field and ordinary
image search results available.

Install from [Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/hide-for-you-on-google-images/)
in Firefox 147 or later. Once published, the AMO listing provides installation
and automatic updates.

## Scope

The content script runs on Google `/search` pages for `google.com`,
`www.google.com`, and `images.google.com`. It hides `#center_col #rso` and
`#center_col #botstuff` only when the pathname is `/search`, the URL has
`udm=49` and `udf=257`, and there is no `q` parameter. A typed query has a `q`
parameter, including an empty `q=`, and remains visible. The search field is
never hidden.

`content.js` sets the `data-hide-images-for-you` attribute on the root element
when the URL matches, and `content.css` hides the two sections under that
attribute. The script recomputes the attribute on load, on the Navigation API's
`currententrychange` event (pushState, replaceState, and history traversal),
and on `pageshow`. It uses no DOM observer or injected style element.

Firefox 147 or later is required, because `window.navigation` is not available
to content scripts in earlier releases.

The add-on has no background process, storage, remote code, or network
requests. It checks the current page URL locally and declares that it collects
no data in the Firefox manifest.

## Development

Requires Node.js 24 and `just`. The extension has no runtime dependencies;
`web-ext` 10.7.0 is a pinned development dependency for Mozilla linting and
browser tests.

```sh
npm ci
just check
just build
```

`just check` checks syntax, lints the packaged files with `web-ext lint`
(public AMO mode, warnings as errors), and runs the unit tests.

Browser tests load the extension in headless Firefox through `web-ext` and use
a local fixture server. Set `FIREFOX_BINARY` to test a specific Firefox build.

```sh
node tests/browser/navigation-probe.js   # navigation event delivery
just build && node tests/browser/packaged-fixture.js   # packaged XPI behavior
```

`packaged-fixture.js` unpacks the XPI and changes only the manifest match
pattern to the fixture host. Set `NO_BFCACHE=1` to test page restoration
without the back/forward cache. Tested on Firefox 147.0 and 157.0.1.

`just build` creates an unsigned XPI under `dist/`. For temporary local use,
open `about:debugging` in Firefox, choose **This Firefox → Load Temporary
Add-on**, and select `manifest.json`. Temporary add-ons are removed when Firefox
restarts.

## Distribution

The release target is a public listing on Mozilla Add-ons (AMO), which provides
installation and automatic updates. Firefox release builds require
Mozilla-signed extensions. Signing and publication are manual; GitHub Actions
runs checks but does not upload releases.

Before each submission, increment `version` in `manifest.json`, run
`just check`, then run `just build`. Upload the versioned XPI from `dist/`.
The archive contains only `manifest.json`, `content.js`, and `content.css`.
Development dependencies and browser fixtures are not included.

For the first submission:

1. Sign in to the [AMO Developer Hub](https://addons.mozilla.org/developers/),
   select **Submit a New Add-on**, and choose **On this site**.
2. Upload the XPI and select Firefox for desktop. The minimum version is 147.
3. Select **No** when asked whether a separate source-code submission is
   required. The packaged code is readable and is not compiled or minified.
4. Complete the listing with the name and summary from `manifest.json`, the
   scope described above, the repository's CC0 license, and the GitHub issues
   page as the support website. Declare that the extension collects no data.
5. Submit the version and wait for Mozilla signing and publication. Remove
   any temporary installation, then install from the published AMO page.

Suggested reviewer notes:

> This extension hides the Google Images For You gallery and pagination only
> on `/search?udm=49&udf=257` without a `q` parameter. Ordinary searches,
> including an empty `q=`, remain visible. It runs on google.com,
> www.google.com, and images.google.com, and requires Firefox 147 for Navigation
> API events. It contains only readable JavaScript, CSS, and a manifest, with
> no compilation, remote code, telemetry, storage, or network requests.
> The For You gallery may depend on the user's Google account and region.

For later submissions, upload a higher-version XPI under the existing AMO
listing and keep the same add-on ID. Firefox delivers published updates.
See Mozilla's [submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/).

## Manual behavior check

1. Open `https://www.google.com/search?udm=49&udf=257`; the gallery and More
   results section should stay hidden.
2. Search for images, for example with
   `https://www.google.com/search?q=book+covers&udf=257&udm=2`; results should
   remain visible.
3. Open `https://www.google.com/search?udm=49&udf=257&q=`; the empty query
   counts as a search, so results should remain visible.
4. From the landing page, run a search in the page, then navigate back and
   forward. The sections should be visible on search routes and hidden on the
   landing route without reloading the page.
