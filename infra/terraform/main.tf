terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }

  # Production state backend should use encrypted S3 + DynamoDB state locking
  # backend "s3" {
  #   bucket         = "medcore-terraform-state-lock"
  #   key            = "emr/core/terraform.tfstate"
  #   region         = "eu-west-1"
  #   encrypt        = true
  #   dynamodb_table = "medcore-tf-state-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "MedCore-EMR"
      Environment = var.environment
      Compliance  = "HIPAA-BAA"
      ManagedBy   = "Terraform"
      Owner       = "Health-Informatics"
    }
  }
}

