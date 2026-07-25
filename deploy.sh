#!/usr/bin/env bash
# Publish 634threads.com: build dist/, sync, invalidate.
# Requires AWS credentials for the site account and `terraform -chdir=infra init` already run.
# If the aws CLI hangs on a macOS proxy: NO_PROXY="amazonaws.com,cloudfront.net" ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

node build.mjs

BUCKET=$(terraform -chdir=infra output -raw bucket)
DIST_ID=$(terraform -chdir=infra output -raw distribution_id)

aws s3 sync dist/ "s3://$BUCKET" --delete
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
