# Setting Up the Slack App for BriefOps

This guide walks you through setting up a Slack app that integrates with **BriefOps**. You will create a custom Slack app, configure OAuth tokens, set up the necessary slash command (`/briefops`), and link the app to your Google Cloud deployment.

## Prerequisites

Before starting, make sure you have:

- A **Slack workspace** where you have permission to create and install apps.
- Access to the **Slack API** at [https://api.slack.com](https://api.slack.com).
- Your **Google Cloud project** set up with **BriefOps** deployment (using the Terraform steps in the main README).

## Step 1: Create a New Slack App

1. Visit [https://api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**.
   
2. Choose **From Scratch** and provide a name for your app (e.g., `BriefOps`) and select the Slack workspace where you want to install it.

3. Click **Create App**.

## Step 2: Configure OAuth & Permissions

1. In your newly created app, go to the **OAuth & Permissions** section in the sidebar.

2. Scroll to **Scopes** and add the following **Bot Token Scopes**:
   - `commands` – To enable the use of the `/briefops` command.
   - `chat:write` – To allow the app to post messages in Slack.
   - `channels:history` – To allow the app to read messages in public channels.
   - `groups:history` – To allow the app to read messages in private channels.
   - `im:history` – To allow the app to read messages in direct messages.
   - `mpim:history` – To allow the app to read messages in group direct messages.

3. After adding the scopes, click **Install App to Workspace**.

4. You will be redirected to authorize the app for your workspace. Click **Allow**.

5. Once installed, copy the **Bot User OAuth Token** and **App-Level Token**. These tokens will be used in your Google Cloud environment as environment variables.

## Step 3: Set Up the Slash Command `/briefops`

1. In the Slack app dashboard, navigate to the **Slash Commands** section.

2. Click **Create New Command** and configure the command as follows:
   - **Command**: `/briefops`
   - **Request URL**: This is the URL of your deployed **BriefOps** app on **Google Cloud Run**. It should look something like this:
     ```
     https://<your-cloud-run-service-url>/slack/events
     ```
   - **Short Description**: `Summarize Slack channel conversations`
   - **Usage Hint**: `[days]`
   - **Escape channels, users, and links sent to your app**: Check this box.

3. Click **Save**.

## Step 4: Set Up Event Subscriptions (Optional for Future Features)

If you plan to extend the functionality of **BriefOps** beyond slash commands (e.g., real-time event handling for channel activities), you'll need to enable **Event Subscriptions**.

1. Go to **Event Subscriptions** in the Slack app dashboard.

2. Toggle the **Enable Events** switch to **On**.

3. Set the **Request URL** to the URL of your deployed **BriefOps** app on **Google Cloud Run**:
`https://<your-cloud-run-service-url>/slack/events`

4. Scroll down to **Subscribe to Bot Events** and add the following events:
- `message.channels` – To listen to messages posted in channels.
- `message.groups` – To listen to messages posted in private channels.
- `message.im` – To listen to messages posted in direct messages.

5. Click **Save Changes**.

## Step 5: Set Environment Variables in Google Cloud

Now that you have the necessary tokens from Slack, update your Google Cloud environment by providing the values in **Google Secret Manager** via Terraform or setting the environment variables directly.

In your `terraform.tfvars` or Google Secret Manager, set the following:

```bash
# Slack tokens (replace these with your own Slack app credentials)
SLACK_APP_TOKEN      = "replace-this-token-with-your-own-slack-app-token"
SLACK_BOT_TOKEN      = "replace-this-token-with-your-own-slack-bot-token"
SLACK_SIGNING_SECRET = "replace-this-token-with-your-own-slack-signing-secret"
```

Make sure these tokens are securely stored in Google Secret Manager or as part of your environment variables within Google Cloud Run.

## Step 6: Test the App
Once the deployment is complete and the app is installed, you can start using the /briefops command in your Slack workspace:

```
/briefops [days]
```
For example, `/briefops 7d` will summarise the last 7 days of messages in the current channel.

If everything is set up correctly, the BriefOps app will respond with a summary of messages from the specified period in the channel where the command was executed.
