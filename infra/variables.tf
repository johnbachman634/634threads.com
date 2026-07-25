variable "domain_name" {
  description = "Apex domain for the site."
  type        = string
  default     = "634threads.com"
}

variable "zone_name" {
  description = "Route53 hosted zone the domain lives in."
  type        = string
  default     = "634threads.com"
}

variable "bucket_name" {
  description = "Private S3 bucket holding the built site."
  type        = string
  default     = "634threads-com-site"
}
