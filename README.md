# 634threads.com

The serial home of *Just You, Me, and Your Sysadmins*, a love story in 634 threads. Chapters post one at a time; the table of contents only ever shows what's published, plus the next chapter as a tease.

## How it works

- `chapters/NN-slug.md` holds published chapters only (format documented in `chapters/README.md`).
- `site.json` holds the title, tease, colophon, and the coming-next entry.
- `node build.mjs` builds the entire site into `dist/`: index, one page per chapter, `rss.xml`, `sitemap.xml`, `robots.txt`, `404.html`. Zero dependencies; the build script is the whole CMS.
- `style.css` is the one stylesheet. The site ships no JavaScript, no trackers, no cookies.
- Chapter URLs are `/{slug}.html` on purpose. The `.html` is load-bearing nostalgia.

## Publish a chapter

1. Drop the finished chapter into `chapters/` as `NN-slug.md` with front matter (`date:`, `teaser:`).
2. Bump `comingNext` in `site.json` to the next chapter.
3. `node build.mjs`, then eyeball `dist/index.html` and the new chapter page.
4. Commit and push to `main` — the deploy workflow builds, syncs the bucket, and invalidates the distribution. `./deploy.sh` is the manual fallback.

## Social card

`og-source.html` is the source for `static/og.png`. Regenerate after any title-treatment change:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot=static/og.png --window-size=1200,630 og-source.html
```

## Infra

Terraform in `infra/`: private S3 + CloudFront + ACM (apex and www on the cert, www 301s to apex via a CloudFront function), plus the OIDC deploy role in `deploy.tf` — after applying, set the repo Actions secrets `AWS_ROLE_ARN` (the `deploy_role_arn` output), `BUCKET`, and `DISTRIBUTION_ID` so pushes to `main` deploy themselves. One-time prereqs are documented at the top of `infra/providers.tf`: register the domain, create its hosted zone, copy `infra/backend.hcl.example` to `infra/backend.hcl` and fill in the state bucket, then `terraform -chdir=infra init -backend-config=backend.hcl` and `terraform -chdir=infra apply`.
