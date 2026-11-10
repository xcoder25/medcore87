# Unstructured Clinical Media & Imaging Vault (Amazon S3)
resource "aws_s3_bucket" "clinical_media" {
  bucket        = var.s3_bucket_name
  force_destroy = var.environment == "production" ? false : true

  tags = {
    Name        = "${var.project_name}-media-vault"
    ContentType = "Clinical-Photography-Scans-DICOM"
  }
}

# Pillar 1 Requirement: Object Versioning MUST be enabled for medical audit durability
resource "aws_s3_bucket_versioning" "clinical_media_versioning" {
  bucket = aws_s3_bucket.clinical_media.id

  versioning_configuration {
    status = "Enabled"
  }
}

# HIPAA Compliance: Default SSE-KMS encryption using Customer Managed Key (CMK)
resource "aws_s3_bucket_server_side_encryption_configuration" "clinical_media_encryption" {
  bucket = aws_s3_bucket.clinical_media.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.emr_cmk.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# HIPAA Compliance: Block all public access completely (only pre-signed URLs or IAM access allowed)
resource "aws_s3_bucket_public_access_block" "clinical_media_block_public" {
  bucket = aws_s3_bucket.clinical_media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket Policy: Enforce in-transit TLS 1.2+ encryption (Deny non-HTTPS requests)
resource "aws_s3_bucket_policy" "enforce_tls" {
  bucket = aws_s3_bucket.clinical_media.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyNonSecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.clinical_media.arn,
          "${aws_s3_bucket.clinical_media.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# CORS configuration to support direct browser PUT streaming via pre-signed URLs
resource "aws_s3_bucket_cors_configuration" "clinical_media_cors" {
  bucket = aws_s3_bucket.clinical_media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "HEAD", "POST"]
    allowed_origins = ["*"] # In production, restrict to your verified hospital domains
    expose_headers  = ["ETag", "x-amz-server-side-encryption"]
    max_age_seconds = 3600
  }
}

# Lifecycle management for cost optimization while retaining medical compliance
resource "aws_s3_bucket_lifecycle_configuration" "clinical_media_lifecycle" {
  bucket = aws_s3_bucket.clinical_media.id

  rule {
    id     = "archive-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_transition {
      noncurrent_days = 365
      storage_class   = "GLACIER"
    }
  }
}

