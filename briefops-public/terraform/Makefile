.PHONY: deploy delete

deployapp: deleteapp ## Delete and re-create the Cloud Run service
	terraform apply -auto-approve -target=google_cloud_run_service.briefops

deleteapp: ## Delete the Cloud Run service
	terraform destroy -auto-approve -target=google_cloud_run_service.briefops

deployall:  
	terraform apply -auto-approve 
