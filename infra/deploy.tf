# CI deploy: GitHub Actions on this repo's main branch assumes a least-privilege
# role via OIDC, syncs dist/ to the bucket, and invalidates the distribution.
# The role ARN, bucket, and distribution id go into the repo's Actions secrets
# (AWS_ROLE_ARN, BUCKET, DISTRIBUTION_ID) by hand; the workflow file carries no
# account-shaped values.
#
# The account-level GitHub OIDC provider is shared infrastructure: leave
# manage_oidc_provider = false to read an existing provider, or set it true in
# exactly one stack per account to create it.

variable "manage_oidc_provider" {
  description = "Create the account's GitHub Actions OIDC provider here (true) or read the existing one (false)."
  type        = bool
  default     = false
}

# GitHub's OIDC subject claim embeds durable numeric IDs (login@id/repo@id) for
# accounts on the 2026 claim format. The owner ID is immutable and pins the
# trust to this exact account; the repo ID is wildcarded because repo names are
# unique per owner, so the pattern stays exact-equivalent while surviving a
# repo delete/recreate. Verify a live token's sub in CloudTrail
# (userIdentity.userName on the AssumeRoleWithWebIdentity event) if this ever
# mismatches again.
variable "deploy_subject_pattern" {
  description = "OIDC subject pattern allowed to assume the deploy role (repo main branch)."
  type        = string
  default     = "repo:johnbachman634@309223962/634threads.com@*:ref:refs/heads/main"
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.manage_oidc_provider ? 0 : 1
  url   = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  count           = var.manage_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

locals {
  github_oidc_provider_arn = var.manage_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : data.aws_iam_openid_connect_provider.github[0].arn
}

data "aws_iam_policy_document" "deploy_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.github_oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [var.deploy_subject_pattern]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "634threads-site-deploy"
  description        = "Deploys the built site from GitHub Actions (OIDC, main branch only)."
  assume_role_policy = data.aws_iam_policy_document.deploy_assume.json
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "SyncList"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = [aws_s3_bucket.site.arn]
  }

  statement {
    sid       = "SyncWrite"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }

  statement {
    sid       = "Invalidate"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}

output "deploy_role_arn" {
  description = "IAM role the deploy workflow assumes (value for the AWS_ROLE_ARN repo secret)."
  value       = aws_iam_role.deploy.arn
}
