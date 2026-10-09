# Google Images For You Hider

A small Firefox add-on that hides Google Images’ personalized landing gallery
and its **More results** section while keeping the search field and ordinary
image search results available.

## Scope

The content script runs on Google `/search` pages for `google.com`,
`www.google.com`, and `images.google.com`. It hides `#center_col #rso` and
`#center_col #botstuff` only when the URL has `udm=49`, `udf=257`, and no `q`
parameter. A typed query has a `q` parameter and remains visible.

The add-on has no background process, storage, remote code, or network
requests. It checks the current page URL locally and declares that it collects
no data in the Firefox manifest.

## Development

Requires Node.js 24 and `just`. There are no npm dependencies.

```sh
just check
just build
```

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
