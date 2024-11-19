// dialogflowcx.tf

resource "google_storage_bucket" "bucket" {
  name                        = "dialogflowcx-bucket-${var.project_id}"
  location                    = var.region
  uniform_bucket_level_access = true
}

resource "google_dialogflow_cx_agent" "agent" {
  display_name          = var.agent_display_name
  location              = var.region
  project               = var.project_id
  default_language_code = "en"
  time_zone             = "Etc/UTC"
  description           = "Dialogflow CX agent for handling future conversations."

  #   advanced_settings {
  #     logging_settings {
  #       enable_stackdriver_logging = true
  #       enable_interaction_logging = true
  #     }
  #   }

  # Optional: Remove or adjust the lifecycle block
  # lifecycle {
  #   ignore_changes = [
  #     advanced_settings
  #   ]
  # }
}

# Include flows, intents, and pages as before...

# Outputs
output "dialogflow_agent_id" {
  value = google_dialogflow_cx_agent.agent.name
}