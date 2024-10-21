# BriefOps

**BriefOps** is a Slack app that helps teams stay on top of important conversations by summarising Slack channels over specific periods. Built on **Google Cloud**, it leverages **Vertex AI** for summarisation, offering a fully secure, private deployment in your own Google Cloud environment.

## Published Blog

The actualy hands-on Experience writing up this App/Integration is published on the [Google Cloud Medium Publication here.](https://medium.com/google-cloud/slack-googlecloud-briefops-streamlining-slack-comms-with-gcp-ai-powered-summarisation-ec2151672731)

![BriefOps is powered by Google Cloud](images/medium_bannerimage_blogpost.png "Slack+GCP_Vertex_AI powers BriefOps")
 
# About BriefOps

It's A Slack Channel Summarisation App, hosted on Google Cloud, uses Gemini generative AI/LLM to summarise long Channel Conversaions (and uploaded Documents - due shortly)

`This is Beta1 Release: Slack Channel Summarisation capability only`

![About BriefOps](images/about-briefops-slack-app.png "About BriefOps")

## Features

- **Channel Summarisation**: Use `/briefops` to summarise conversations over a set period, helping users catch up on important updates. _(default over last 7 days)_
- **Secure and Private**: Fully deployed within your own Google Cloud project, ensuring enterprise-level privacy and security.
- **Customisable Deployments**: Choose the Google Cloud region and adjust configurations to meet your operational needs.

## Getting Started

### Prerequisites

Before starting, ensure you have the following:

- A **Google Cloud project** with billing enabled.
- A **Slack workspace** where you have permission to install apps.
- **Terraform** installed to provision Google Cloud resources.

## User-Centric Journey Architecture (Here is your HLD/C4 if you wondered)

![BriefOps Solution HLD](images/architecture-HLD.png "BriefOps Solution HLD C4")


This user-centric view better shows how Slack commands directly lead to Google Cloud components interacting and how the Slack User remains the main stakeholder throughout the summarisation process. This also emphasises privacy and clarity, indicating where processing occurs and how responses come back to the initiating user or thread.




### Step 1: Enable Required Google Cloud APIs

export GOOGLE_CLOUD_PROJECT="Your-ProjectID"
Run the following command to enable all necessary Google Cloud services:

```bash
gcloud services enable \
  firestore.googleapis.com \
  aiplatform.googleapis.com \
  secretmanager.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  --project=$GOOGLE_CLOUD_PROJECT
```

### Step 2: Clone the Repository
Clone the public BriefOps repository:

```
git clone https://github.com/YOUR_USERNAME/briefops-public.git
cd briefops-public
```

### Step 3: Configure Additional Environment Variables
Ensure that you have the necessary environment variables for your Google Cloud project and Slack tokens. These values will be set in Google Secret Manager via Terraform.

In your terraform.tfvars, provide the following values:

```
# Terraform variables
project_id           = "your-google-cloud-project-id" #Change this to $GOOGLE_CLOUD_PROJECT
region               = "us-central1"  # Change to your preferred region
service_account_name = "briefops-service-account"
app_name             = "briefops"
container_image      = "gcr.io/your-google-cloud-project-id/briefops:latest"
memory               = "2Gi"
max_instances        = 5

# For bootstrap-only.
# Slack tokens (replace these with your own Slack app credentials on Cloud Secrets instead)
SLACK_APP_TOKEN      = "Replace-on-Google-Cloud-Secrets-with-your-app-token"
SLACK_BOT_TOKEN      = "Replace-on-Google-Cloud-Secrets-bot-token"
SLACK_SIGNING_SECRET = "Replace-on-Google-Cloud-Secrets-signing-secret"
```

### Step 4: Deploy with Terraform
To deploy BriefOps on Google Cloud using Terraform, navigate to the root of the project directory and run:

```
terraform init
terraform apply
```

This will provision the following Google Cloud resources:

- Cloud Run to run the app.
- Vertex AI for model inference and summarisation tasks.
- Secret Manager to securely store Slack tokens.
- Firestore for usage data storage. (TBD)


### Step 5: Install the App in Slack

Go to the Slack API website and create a new app for your workspace.
Set up the OAuth tokens and install the app to your workspace.
Copy the Slack Bot Token, App Token, and Signing Secret to your Terraform variables (terraform.tfvars).


To enable the /briefops command functionality, a minimal set of `Slack OAuth scopes` is required to ensure the command can be processed properly and the bot can respond to user requests within Slack. These scopes are specifically focused on allowing the bot to read necessary messages and send summarised responses based on user input. Below is a list of the essential scopes required for the /briefops command:

Required Scopes for /briefops Command:

- `commands` - To register and listen for /briefops.
- `channels:read` - To read channel metadata and check availability.
- `channels:history` - To read messages from public channels for summarisation.
- `chat:write` - To send the summary response back to the user in the channel.
- `conversations:read` - To get metadata about conversations the bot can access.
- `conversations:history` - To read messages in private channels or threads.

Optional Scopes (Depending on Usage)
- `groups:read` and groups:history - These are optional but needed if /briefops is expected to work in private channels.
- `im:history` and `im:write` - These are necessary if you intend to allow the bot to respond to direct messages or if /briefops will be used in DMs.

## Usage

Once the deployment is complete and the app is installed, you can start using /briefops in your Slack workspace to summarise conversations in any channel:


```
/briefops [days]
For example, /briefops 7 will summarise the last 7 days of messages in the current channel.
```

With a simple command, `briefops` extracts and summarizes key points from recent conversations, providing your team with a quick overview of decisions, updates, and key topics. briefops keeps your information safe, leveraging Google's robust cloud infrastructure, while ensuring your team never misses an important conversation.

Before
![Before BriefOps](images/Slack-news-feed-channel.png "Before BriefOps")

After
![After BriefOps](images/News-feed-Channel-Summarised.png "After BriefOps")


## Secure SDLC with GCP - You'd want to set this up on your own

When developing and deploying applications in Google Cloud, it’s essential to follow a secure Software Development Lifecycle (SDLC). For BriefOps, using Google Cloud Build allows for the automated building, scanning, and deploying of Docker images in a secure and controlled environment.

Here’s an example Cloud Build configuration that ensures secure practices throughout the deployment process:

See the example `cloudbuild.yaml` file, as this is configured in my repo, to ensure my fresh-baked changeset are pushed right out to cloudRun, for testing.

```
steps:
  # Step 1: Build the Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/briefops:$COMMIT_SHA', '.']
    id: 'Build Image'

  # Step 2: Push the Docker image to Google Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/briefops:$COMMIT_SHA']
    id: 'Push Image'

  # Step 3: Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - '${_SERVICE}'
      - '--image'
      - 'gcr.io/$PROJECT_ID/briefops:$COMMIT_SHA'
      - '--region'
      - '${_REGION}'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--set-secrets'
      - 'SLACK_APP_TOKEN=SLACK_APP_TOKEN:latest'
      - '--set-secrets'
      - 'SLACK_BOT_TOKEN=SLACK_BOT_TOKEN:latest'
      - '--set-secrets'
      - 'SLACK_SIGNING_SECRET=SLACK_SIGNING_SECRET:latest'
      - '--service-account'
      - 'briefops-service-account@briefops.iam.gserviceaccount.com'  
    id: 'Deploy to Cloud Run'

# Logging options set to CLOUD_LOGGING_ONLY
options:
  logging: CLOUD_LOGGING_ONLY

substitutions:
  _REGION: us-central1
  _SERVICE: briefops

```

Benefits of your own independent CICD Setup
- Automated Build & Deploy: Ensures consistency in every release by automating the build and deployment steps.
- Container Scanning: Integrating container scanning tools with Cloud Build helps detect vulnerabilities early in the SDLC process.
- Secret Management: Sensitive information such as Slack Tokens is managed securely with Google Secret Manager, ensuring they are not exposed during builds or in source code.
- IAM Policies: Cloud Build steps are executed using IAM service accounts with least privilege access, ensuring that only necessary permissions are granted.
- Logging and Monitoring: Using Cloud Logging and Monitoring ensures that all actions within the build pipeline and the deployed application are tracked and auditable.

(Use Cloud Logging to evaluate your own instance of this app as/when you add any more features)

## Security and Privacy Considerations

BriefOps is designed with privacy and security in mind:

Deployed entirely within your own Google Cloud environment for full control.
No data is shared with third-party services, and content is not used for model training.
Adheres to Google Cloud's best practices for least privilege and secure access using IAM roles and Secret Manager.
Required IAM Roles:

The service account will be configured with the following roles:

```
roles/aiplatform.user: Vertex AI access for summarisation models.
roles/datastore.user: Access to Firestore for data storage.
roles/secretmanager.secretAccessor: Access to secrets like Slack tokens stored in Secret Manager.
roles/logging.logWriter: Write logs to Cloud Logging for monitoring.
roles/monitoring.viewer: View monitoring metrics for the deployed service.
```

## License
This project is licensed under the MIT License. See the LICENSE file for details.


### Key Updates:
- Replaced placeholders for Slack tokens with `"replace-this-token-with-your-own..."` to make it clear that users need to provide their own Slack credentials.
- Simplified instructions to ensure users know where to input their Slack app tokens.This is the public repository for BriefOps. It contains the necessary code and configuration for the deployment.
