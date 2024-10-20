# terraform.tfvars

project_id           = "briefops"
region               = "us-central1"
service_account_name = "briefops-service-account"
app_name             = "briefops"
container_image      = "gcr.io/briefops/briefops@sha256:d26471d96a5c3db908b6709d6f4a61022f18f8ba941e07340ae60c554a818df0"
memory               = "2Gi"
max_instances        = 5
create_firestore     = false

