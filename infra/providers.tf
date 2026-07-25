# Prereqs, once, before the first apply:
#   1. Register 634threads.com.
#   2. Create its public hosted zone (kept in a separate private repo) and point the
#      registrar's NS records at it. The zone must exist before this applies.
#   3. Copy backend.hcl.example to backend.hcl (gitignored), fill in the state
#      bucket, then `terraform init -backend-config=backend.hcl`.
# The same private repo owns the live A/AAAA alias records at apex + www, pointing
# at the distribution_domain_name output here.

terraform {
  required_version = ">= 1.10"

  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# CloudFront and its ACM certificate must live in us-east-1.
provider "aws" {
  region = "us-east-1"
}
