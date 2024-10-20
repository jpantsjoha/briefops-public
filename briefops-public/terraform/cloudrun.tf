resource "google_cloud_run_v2_service" "briefops" {
  name     = var.app_name
  location = var.region
  project  = var.project_id

  template {
    containers {
      image = var.container_image

      resources {
        limits = {
          memory = var.memory
          cpu    = "2" # Increased CPU allocation to 2 for better performance during cold starts
        }
        startup_cpu_boost = true # Enables CPU boost during startup for quicker response
      }

      # Environment variables using secrets from Secret Manager
      env {
        name = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name = "SLACK_APP_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.slack_app_token.name
            version = "latest"
          }
        }
      }

      env {
        name = "SLACK_BOT_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.slack_bot_token.name
            version = "latest"
          }
        }
      }

      env {
        name = "SLACK_SIGNING_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.slack_signing_secret.name
            version = "latest"
          }
        }
      }
    }

    service_account = google_service_account.briefops_sa.email

    scaling {
      min_instance_count = 1 # Ensure at least 2 instances are always available
      max_instance_count = var.max_instances
      
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_secret_manager_secret_version.slack_app_token,
    google_secret_manager_secret_version.slack_bot_token,
    google_secret_manager_secret_version.slack_signing_secret
  ]
}

# Secret Manager resources for each SLACK secret

resource "google_secret_manager_secret" "slack_app_token" {
  secret_id = "SLACK_APP_TOKEN"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "slack_app_token" {
  secret      = google_secret_manager_secret.slack_app_token.name
  secret_data = var.SLACK_APP_TOKEN_value
}

resource "google_secret_manager_secret" "slack_bot_token" {
  secret_id = "SLACK_BOT_TOKEN"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "slack_bot_token" {
  secret      = google_secret_manager_secret.slack_bot_token.name
  secret_data = var.SLACK_BOT_TOKEN_value
}

resource "google_secret_manager_secret" "slack_signing_secret" {
  secret_id = "SLACK_SIGNING_SECRET"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "slack_signing_secret" {
  secret      = google_secret_manager_secret.slack_signing_secret.name
  secret_data = var.SLACK_SIGNING_SECRET_value
}
