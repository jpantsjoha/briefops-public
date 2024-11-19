# terraform.tfvars

project_id           = "briefops"
region               = "us-central1"
service_account_name = "briefops-service-account"
app_name             = "briefops"
container_image      = "gcr.io/briefops/briefops:containerID" #bootstap. change it to your CICD CloudBuild Version, once you CICD
memory               = "1Gi"
max_instances        = 5
create_firestore     = false

