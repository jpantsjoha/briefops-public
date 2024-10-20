# iam.tf

# Create a service account
resource "google_service_account" "briefops_sa" {
  account_id   = var.service_account_name
  display_name = "BriefOps Service Account"
}

# Grant necessary roles to the service account
resource "google_project_iam_member" "briefops_sa_roles" {
  for_each = toset([
    "roles/run.invoker",
    "roles/storage.objectAdmin",
    "roles/secretmanager.secretAccessor",
    "roles/aiplatform.user",
    "roles/aiplatform.viewer",
    "roles/aiplatform.endpointUser",
    "roles/datastore.user",          # For Firestore access
    "roles/logging.logWriter",       # For Cloud Logging
    "roles/monitoring.metricWriter", # For Cloud Monitoring
  ])
  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.briefops_sa.email}"
}

# Create a custom AI Platform role
resource "google_project_iam_custom_role" "aiplatform_publisher_model_user_custom" {
  role_id     = "aiplatform_publisher_model_user_custom"
  title       = "AI Platform Publisher Model User Custom"
  description = "Custom role for accessing publisher models in AI Platform"
  project     = var.project_id
  permissions = [
    "aiplatform.endpoints.predict",
    "aiplatform.models.list", # Example: Use valid permissions, like listing models.
  ]
}

# Assign the custom role to the service account
resource "google_project_iam_member" "briefops_sa_custom_role" {
  project = var.project_id
  role    = google_project_iam_custom_role.aiplatform_publisher_model_user_custom.name
  member  = "serviceAccount:${google_service_account.briefops_sa.email}"
}

# Grant Cloud Run Service Account Access to Container Registry
resource "google_project_iam_member" "container_registry_access" {
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.briefops_sa.email}"
  project = var.project_id
}