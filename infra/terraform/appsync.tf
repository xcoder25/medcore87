# Pillar 3: Real-Time UI / Dashboard Sync
# AWS AppSync Managed GraphQL & WebSocket Engine

resource "aws_appsync_graphql_api" "emr_realtime" {
  name                = "${var.project_name}-realtime-api"
  authentication_type = "API_KEY"

  additional_authentication_provider {
    authentication_type = "OPENID_CONNECT"

    openid_connect_config {
      issuer    = "https://securetoken.google.com/${var.firebase_project_id}"
      client_id = var.firebase_project_id
    }
  }

  schema = <<-EOF
    type MedCoreEvent {
      eventId: ID!
      source: String!
      detailType: String!
      facilityId: String!
      payload: String!
      timestamp: String!
    }

    type Query {
      getHealth: String
    }

    type Mutation {
      publishMedCoreEvent(
        source: String!
        detailType: String!
        facilityId: String!
        payload: String!
      ): MedCoreEvent
    }

    type Subscription {
      onMedCoreEvent(facilityId: String!): MedCoreEvent
        @aws_subscribe(mutations: ["publishMedCoreEvent"])
    }
  EOF

  tags = {
    Name = "${var.project_name}-appsync-realtime"
  }
}

resource "aws_appsync_api_key" "emr_realtime_key" {
  api_id  = aws_appsync_graphql_api.emr_realtime.id
  expires = timeadd(timestamp(), "8760h") # 1 year validity
}

# Local None Data Source for immediate WebSocket pub/sub fan-out
resource "aws_appsync_datasource" "none" {
  api_id = aws_appsync_graphql_api.emr_realtime.id
  name   = "LocalPubSubDataSource"
  type   = "NONE"
}

# Mutation Resolver that fans out events to active subscriptions
resource "aws_appsync_resolver" "publish_event" {
  api_id      = aws_appsync_graphql_api.emr_realtime.id
  type        = "Mutation"
  field       = "publishMedCoreEvent"
  data_source = aws_appsync_datasource.none.name

  request_template = <<-EOF
    {
      "version": "2018-05-29",
      "payload": {
        "eventId": "$util.autoId()",
        "source": "$context.arguments.source",
        "detailType": "$context.arguments.detailType",
        "facilityId": "$context.arguments.facilityId",
        "payload": "$context.arguments.payload",
        "timestamp": "$util.time.nowISO8601()"
      }
    }
  EOF

  response_template = "$util.toJson($context.result)"
}

