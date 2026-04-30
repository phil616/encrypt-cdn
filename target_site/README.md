# Demo Target Site

This source site is intentionally small but covers common encrypted static-site cases:

- top-level HTML: `/index.html`
- nested HTML: `/pages/about.html`, `/pages/deep/nested.html`
- URL-encoded path: `/pages/space%20page.html`
- CSS with an encrypted SVG background
- JavaScript loaded with `defer`
- JSON fetched at runtime
- SVG loaded as image and favicon
- missing-resource request to verify normal 404 behavior

The encrypted output is generated into `decryptor/public/enc` and is intentionally ignored by git.
