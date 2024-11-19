// secrets.tf

resource "google_secret_manager_secret_version" "google_api_key_version" {
  secret      = google_secret_manager_secret.google_api_key.name
  secret_data = var.GOOGLE_API_KEY_value
}

resource "google_secret_manager_secret" "google_api_key" {
  secret_id = "GOOGLE_API_KEY"
  project   = var.project_id

  replication {
    auto {}
  }
}