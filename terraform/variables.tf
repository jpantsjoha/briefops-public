# variables.tf


variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
  default     = "briefops"
}

variable "region" {
  description = "Google Cloud Region"
  type        = string
  default     = "us-central1"
}

variable "agent_display_name" {
  description = "The display name of the Dialogflow CX agent"
  type        = string
  default     = "BriefOps Agent"
}

variable "service_account_name" {
  description = "Service account name"
  type        = string
  default     = "briefops-service-account"
}

variable "deletion_protection" {
  description = "deletion protection"
  type        = string
  default     = "false"
}

variable "app_name" {
  description = "Name of the Cloud Run service"
  type        = string
  default     = "briefops"
}

variable "container_image" {
  description = "Container image URL for Cloud Run"
  type        = string
}

variable "memory" {
  description = "Memory allocated to Cloud Run service"
  type        = string
  default     = "2Gi"
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 5
}

variable "create_firestore" {
  description = "Flag to determine whether to create Firestore database"
  type        = bool
  default     = false
}

variable "SLACK_BOT_TOKEN_value" {
  description = "Slack Bot Token"
  type        = string
  sensitive   = true
}

variable "SLACK_SIGNING_SECRET_value" {
  description = "Slack Signing Secret"
  type        = string
  sensitive   = true
}

variable "SLACK_APP_TOKEN_value" {
  description = "Slack App Token"
  type        = string
  sensitive   = true
}

variable "github_repository" {
  description = "github_repository referencen"
  type        = string
  default     = "https://github.com/jpantsjoha/briefops-public"
}
