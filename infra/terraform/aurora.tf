# Subnet group for Aurora Serverless v2 (strictly isolated database subnets)
resource "aws_db_subnet_group" "aurora" {
  name        = "${var.project_name}-aurora-subnet-group"
  description = "Subnet group for MedCore Aurora Serverless v2 PostgreSQL cluster"
  subnet_ids  = aws_subnet.database[*].id

  tags = {
    Name = "${var.project_name}-aurora-subnet-group"
  }
}

# Security group for Aurora PostgreSQL cluster
resource "aws_security_group" "aurora" {
  name        = "${var.project_name}-aurora-sg"
  description = "Controls ingress to Aurora PostgreSQL Serverless v2 cluster"
  vpc_id      = aws_vpc.main.id

  # Ingress strictly on port 5432 from private application subnets
  ingress {
    description = "PostgreSQL ingress from private application subnets"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = aws_subnet.private[*].cidr_block
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-aurora-sg"
  }
}

# Master Database Password generated securely in AWS Secrets Manager
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${var.project_name}-db-master-credentials"
  description             = "Master PostgreSQL credentials for MedCore Aurora Serverless v2"
  kms_key_id              = aws_kms_key.emr_cmk.arn
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-db-credentials"
  }
}

resource "random_password" "db_master_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    engine   = "postgres"
    host     = aws_rds_cluster.aurora.endpoint
    port     = 5432
    username = var.database_master_username
    password = random_password.db_master_password.result
    database = var.database_name
  })
}

# Amazon Aurora Serverless v2 PostgreSQL Cluster
resource "aws_rds_cluster" "aurora" {
  cluster_identifier = "${var.project_name}-aurora-cluster"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = "16.1"
  database_name      = var.database_name
  master_username    = var.database_master_username
  master_password    = random_password.db_master_password.result

  db_subnet_group_name   = aws_db_subnet_group.aurora.name
  vpc_security_group_ids = [aws_security_group.aurora.id]

  # HIPAA Compliance: KMS Encryption at rest is mandatory
  storage_encrypted = true
  kms_key_id        = aws_kms_key.emr_cmk.arn

  # Backup & Snapshot configuration
  backup_retention_period   = 35
  preferred_backup_window   = "02:00-03:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"
  deletion_protection       = var.environment == "production" ? true : false
  skip_final_snapshot       = var.environment == "production" ? false : true
  final_snapshot_identifier = "${var.project_name}-aurora-final-snapshot"
  copy_tags_to_snapshot     = true

  # Serverless v2 Scaling Bounds (ACUs)
  serverlessv2_scaling_configuration {
    min_capacity = var.aurora_min_capacity
    max_capacity = var.aurora_max_capacity
  }

  tags = {
    Name = "${var.project_name}-aurora-cluster"
  }
}

# Primary Writer Instance
resource "aws_rds_cluster_instance" "aurora_writer" {
  cluster_identifier   = aws_rds_cluster.aurora.id
  instance_identifier  = "${var.project_name}-aurora-instance-1"
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.aurora.engine
  engine_version       = aws_rds_cluster.aurora.engine_version
  db_subnet_group_name = aws_db_subnet_group.aurora.name
  publicly_accessible  = false

  auto_minor_version_upgrade = true
  performance_insights_enabled = true
  performance_insights_kms_key_id = aws_kms_key.emr_cmk.arn

  tags = {
    Name = "${var.project_name}-aurora-writer"
  }
}

# Multi-AZ Reader Replica for High Availability
resource "aws_rds_cluster_instance" "aurora_reader" {
  cluster_identifier   = aws_rds_cluster.aurora.id
  instance_identifier  = "${var.project_name}-aurora-instance-2"
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.aurora.engine
  engine_version       = aws_rds_cluster.aurora.engine_version
  db_subnet_group_name = aws_db_subnet_group.aurora.name
  publicly_accessible  = false

  auto_minor_version_upgrade = true
  performance_insights_enabled = true
  performance_insights_kms_key_id = aws_kms_key.emr_cmk.arn

  tags = {
    Name = "${var.project_name}-aurora-reader"
  }
}

