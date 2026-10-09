# Google Images For You Hider

A small Firefox add-on that hides Google Images’ personalized landing gallery
and its **More results** section while keeping the search field and ordinary
image search results available.

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
(self-hosted mode, warnings as errors), and runs the unit tests.

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

Firefox release builds require Mozilla-signed extensions. Submit the XPI to
AMO as an unlisted add-on for personal or limited distribution, or list it on
AMO for public installation and automatic updates. An unlisted self-hosted
release needs an update manifest for automatic updates; otherwise, install each
new signed XPI manually.

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
