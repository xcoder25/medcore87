# Vercel OpenID Connect (OIDC) Identity Provider
resource "aws_iam_openid_connect_provider" "vercel" {
  url             = "https://oidc.vercel.com"
  client_id_list  = ["https://vercel.com"]
  thumbprint_list = ["9e99a48a9960b14926cc7f3b02e22da2b0ab7280"]

  tags = {
    Name = "${var.project_name}-vercel-oidc"
  }
}

# IAM Role assumed by Vercel Functions via OIDC
resource "aws_iam_role" "vercel_app_role" {
  name = "${var.project_name}-vercel-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.vercel.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "oidc.vercel.com:aud" = "https://vercel.com"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-vercel-app-role"
  }
}

# Policy granting least-privilege access to S3, EventBridge, AppSync, and KMS
resource "aws_iam_role_policy" "vercel_app_policy" {
  name = "${var.project_name}-vercel-app-policy"
  role = aws_iam_role.vercel_app_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3MediaStorageAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:AbortMultipartUpload",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.clinical_media.arn,
          "${aws_s3_bucket.clinical_media.arn}/*"
        ]
      },
      {
        Sid    = "EventBridgePublishAccess"
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = [
          aws_cloudwatch_event_bus.emr_bus.arn
        ]
      },
      {
        Sid    = "KmsEncryptionDecryptionAccess"
        Effect = "Allow"
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [
          aws_kms_key.emr_cmk.arn
        ]
      },
      {
        Sid    = "SecretsManagerReadAccess"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.db_credentials.arn
        ]
      }
    ]
  })
}

