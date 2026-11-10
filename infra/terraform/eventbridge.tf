# Pillar 2: Workflow Synchronization & Event Brokerage
# Amazon EventBridge Custom Bus for MedCore EMR Domain Events

resource "aws_cloudwatch_event_bus" "emr_bus" {
  name       = "medcore-emr-bus"
  kms_key_identifier = aws_kms_key.emr_cmk.arn

  tags = {
    Name = "${var.project_name}-event-bus"
  }
}

# Dead Letter Queue (DLQ) for unhandled domain events
resource "aws_sqs_queue" "event_dlq" {
  name                      = "${var.project_name}-eventbridge-dlq"
  kms_master_key_id         = aws_kms_key.emr_cmk.arn
  message_retention_seconds = 1209600 # 14 days retention
}

# -------------------------------------------------------------
# RULE 1: Front Desk Registration -> Instant Triage & Billing Queue
# -------------------------------------------------------------
resource "aws_cloudwatch_event_rule" "patient_registered" {
  name           = "${var.project_name}-patient-registered-rule"
  description    = "Routes new patient registrations to Triage, Front Desk billing, and queue management"
  event_bus_name = aws_cloudwatch_event_bus.emr_bus.name

  event_pattern = jsonencode({
    source      = ["medcore.emr.reception"]
    detail-type = ["PatientRegistered"]
  })
}

# SQS Queue for Triage & Clinical Intake department
resource "aws_sqs_queue" "triage_queue" {
  name              = "${var.project_name}-triage-intake-queue"
  kms_master_key_id = aws_kms_key.emr_cmk.arn
}

resource "aws_cloudwatch_event_target" "target_triage" {
  rule           = aws_cloudwatch_event_rule.patient_registered.name
  event_bus_name = aws_cloudwatch_event_bus.emr_bus.name
  target_id      = "TriageDepartmentQueue"
  arn            = aws_sqs_queue.triage_queue.arn

  dead_letter_config {
    arn = aws_sqs_queue.event_dlq.arn
  }
}

# -------------------------------------------------------------
# RULE 2: Cashier/TSA Payment Cleared -> Release Orders to Pharmacy & Lab
# -------------------------------------------------------------
resource "aws_cloudwatch_event_rule" "payment_confirmed" {
  name           = "${var.project_name}-payment-confirmed-rule"
  description    = "Unlocks lab worklists and pharmacy dispensing once cashier settles invoices"
  event_bus_name = aws_cloudwatch_event_bus.emr_bus.name

  event_pattern = jsonencode({
    source      = ["medcore.emr.billing"]
    detail-type = ["PaymentConfirmed"]
  })
}

resource "aws_sqs_queue" "pharmacy_release_queue" {
  name              = "${var.project_name}-pharmacy-release-queue"
  kms_master_key_id = aws_kms_key.emr_cmk.arn
}

resource "aws_cloudwatch_event_target" "target_pharmacy" {
  rule           = aws_cloudwatch_event_rule.payment_confirmed.name
  event_bus_name = aws_cloudwatch_event_bus.emr_bus.name
  target_id      = "PharmacyDispensingQueue"
  arn            = aws_sqs_queue.pharmacy_release_queue.arn

  dead_letter_config {
    arn = aws_sqs_queue.event_dlq.arn
  }
}

# -------------------------------------------------------------
# RULE 3: Doctor CPOE Order Created -> Route Invoices to Cashier Desk
# -------------------------------------------------------------
resource "aws_cloudwatch_event_rule" "order_created" {
  name           = "${var.project_name}-clinical-order-rule"
  description    = "Generates pending billing line items whenever doctor prescribes or orders tests"
  event_bus_name = aws_cloudwatch_event_bus.emr_bus.name

  event_pattern = jsonencode({
    source      = ["medcore.emr.clinical"]
    detail-type = ["ClinicalOrderCreated"]
  })
}

resource "aws_sqs_queue" "billing_invoicing_queue" {
  name              = "${var.project_name}-billing-invoicing-queue"
  kms_master_key_id = aws_kms_key.emr_cmk.arn
}

resource "aws_cloudwatch_event_target" "target_billing" {
  rule           = aws_cloudwatch_event_rule.order_created.name
  event_bus_name = aws_cloudwatch_event_bus.emr_bus.name
  target_id      = "BillingInvoicingQueue"
  arn            = aws_sqs_queue.billing_invoicing_queue.arn

  dead_letter_config {
    arn = aws_sqs_queue.event_dlq.arn
  }
}

# Allow EventBridge to publish to SQS queues
resource "aws_sqs_queue_policy" "allow_eventbridge_to_queues" {
  for_each = {
    triage   = aws_sqs_queue.triage_queue
    pharmacy = aws_sqs_queue.pharmacy_release_queue
    billing  = aws_sqs_queue.billing_invoicing_queue
  }

  queue_url = each.value.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowEventBridgePublish"
        Effect    = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = each.value.arn
      }
    ]
  })
}

