variable "aws_region" {
  description = "AWS deployment region for all HIPAA-compliant medical infrastructure"
  type        = string
  default     = "eu-west-1"
}

variable "environment" {
  description = "Deployment tier (production, staging, dev)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Base identifier for MedCore infrastructure"
  type        = string
  default     = "medcore-emr"
}

variable "vpc_cidr" {
  description = "CIDR block for the encrypted EMR VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Target availability zones for Multi-AZ durability"
  type        = list(string)
  default     = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
}

variable "s3_bucket_name" {
  description = "Globally unique name for the unstructured clinical media S3 bucket"
  type        = string
  default     = "medcore-clinical-media-vault"
}

variable "aurora_min_capacity" {
  description = "Minimum Aurora Serverless v2 ACUs (0.5 ACU = 1GB RAM)"
  type        = number
  default     = 0.5
}

variable "aurora_max_capacity" {
  description = "Maximum Aurora Serverless v2 ACUs (16 ACUs = 32GB RAM)"
  type        = number
  default     = 16.0
}

variable "database_name" {
  description = "Name of the default PostgreSQL database"
  type        = string
  default     = "medcore_emr"
}

variable "database_master_username" {
  description = "Master administrative username for Aurora cluster"
  type        = string
  default     = "medcore_admin"
}

variable "vercel_project_id" {
  description = "Vercel Project ID used in OIDC Subject claim"
  type        = string
  default     = "*"
}

variable "firebase_project_id" {
  description = "Firebase Project ID for OIDC authentication on AppSync"
  type        = string
  default     = "medcore-health"
}

