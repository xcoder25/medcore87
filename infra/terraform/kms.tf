data "aws_caller_identity" "current" {}

# Customer Managed Key (CMK) for HIPAA-compliant encryption at rest across all MedCore assets
resource "aws_kms_key" "emr_cmk" {
  description             = "MedCore EMR Customer Managed Key for HIPAA at-rest encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "medcore-emr-key-policy"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow CloudWatch Logs Encryption"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow EventBridge and S3 Service Encryption"
        Effect = "Allow"
        Principal = {
          Service = [
            "events.amazonaws.com",
            "s3.amazonaws.com",
            "rds.amazonaws.com"
          ]
        }
        Action = [
          "kms:GenerateDataKey",
          "kms:Decrypt"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_kms_alias" "emr_cmk_alias" {
  name          = "alias/${var.project_name}-cmk"
  target_key_id = aws_kms_key.emr_cmk.key_id
}

