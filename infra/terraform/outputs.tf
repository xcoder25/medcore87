output "aurora_cluster_endpoint" {
  description = "PostgreSQL connection endpoint for MedCore Aurora Serverless v2 cluster"
  value       = aws_rds_cluster.aurora.endpoint
}

output "aurora_reader_endpoint" {
  description = "Read-only replica endpoint for reporting and analytics queries"
  value       = aws_rds_cluster.aurora.reader_endpoint
}

output "aurora_master_user_secret_arn" {
  description = "Secrets Manager ARN for Aurora managed master credentials"
  value       = aws_rds_cluster.aurora.master_user_secret[0].secret_arn
}

output "s3_media_bucket_name" {
  description = "Bucket name for unstructured clinical media, photos, and DICOM imaging"
  value       = aws_s3_bucket.clinical_media.id
}

output "eventbridge_bus_name" {
  description = "Custom EventBridge bus name for domain event orchestration"
  value       = aws_cloudwatch_event_bus.emr_bus.name
}

output "eventbridge_bus_arn" {
  description = "ARN of custom EventBridge bus"
  value       = aws_cloudwatch_event_bus.emr_bus.arn
}

output "appsync_graphql_url" {
  description = "AWS AppSync GraphQL endpoint for real-time dashboard UI sync"
  value       = aws_appsync_graphql_api.emr_realtime.uris["GRAPHQL"]
}

output "appsync_realtime_url" {
  description = "AWS AppSync WebSocket Real-time URI"
  value       = aws_appsync_graphql_api.emr_realtime.uris["REALTIME"]
}

output "appsync_api_key" {
  description = "API Key for AppSync GraphQL subscriptions"
  value       = aws_appsync_api_key.emr_realtime_key.key
  sensitive   = true
}

output "kms_cmk_arn" {
  description = "Customer Managed Key ARN used for HIPAA at-rest encryption"
  value       = aws_kms_key.emr_cmk.arn
}

output "vercel_role_arn" {
  description = "IAM Role ARN to be configured as AWS_ROLE_ARN in Vercel for OIDC auth"
  value       = aws_iam_role.vercel_app_role.arn
}
