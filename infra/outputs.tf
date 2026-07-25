output "bucket" {
  description = "Static-site bucket name (deploy target for `aws s3 sync`)."
  value       = aws_s3_bucket.site.bucket
}

output "distribution_id" {
  description = "CloudFront distribution ID (for cache invalidations)."
  value       = aws_cloudfront_distribution.site.id
}

output "distribution_domain_name" {
  description = "CloudFront domain. The dns root's alias records point here."
  value       = aws_cloudfront_distribution.site.domain_name
}
