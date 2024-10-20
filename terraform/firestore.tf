# firestore.tf

resource "google_firestore_database" "default" {
  count       = var.create_firestore ? 1 : 0
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
}