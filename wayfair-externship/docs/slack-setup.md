# Slack setup for Rug Intel (about 10 minutes)

Everything is free tier. You enter every secret yourself; nothing secret goes in git.

## 1. Workspace and channel
1. Create a free Slack workspace (or use one you own), e.g. "Rug Intel Demo".
2. Create a public channel named **#rug-intel**.

## 2. Create the app from this manifest
api.slack.com/apps → **Create New App** → **From a manifest** → pick the workspace → paste:

```yaml
display_information:
  name: Rug Intel
  description: Competitor intelligence agents for Wayfair Rugs (prototype)
features:
  bot_user:
    display_name: Rug Intel
    always_online: false
  slash_commands:
    - command: /rug-intel
      url: https://n8n.builtbydhruv.com/webhook/rug-intel/slack
      description: Deep dives, quick answers and agent status for Rugs
      usage_hint: "deep-dive outdoor rug focus: washable | ask <question> | status"
      should_escape: false
oauth_config:
  scopes:
    bot:
      - commands
      - chat:write
      - chat:write.public
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

Then **Install to Workspace** and allow.

## 3. Put the two secrets into n8n
1. **Signing Secret** (Basic Information → App Credentials): open workflow **Rug Intel Slack Command** → node **Sign Request** → paste it into **Secret** (replace `PASTE_SLACK_SIGNING_SECRET_HERE`). Save.
2. **Bot User OAuth Token** (OAuth & Permissions, starts with `xoxb-`): in n8n create a credential of type **Slack API**, name it exactly **Slack Bot (Rug Intel)**, paste the token. Then open **Rug Intel Weekly Digest → Post to Slack** and **Rug Intel Error Handler → Alert Slack** and select that credential. Save both.
3. In Slack, type `/invite @Rug Intel` in #rug-intel.

## 4. Publish (Claude asks first)
These need to be published (active) to receive real traffic:
- **Rug Intel Slack Command** (the `/rug-intel` URL)
- **Rug Intel Web** (dashboard and report links)
- **Rug Intel Error Handler** (then it is attached to every Rug Intel workflow)
- **Rug Intel Weekly Digest** (Mondays 8am ET), optional; for the demo you can run it by hand.

## 5. Test in Slack
- `/rug-intel status` → last runs, instantly
- `/rug-intel ask which Walmart area rugs under $50 rate best?` → answer in ~10 s
- `/rug-intel deep-dive outdoor rug focus: weather resistant` → summary + report link in ~7 min

If `/rug-intel` says "dispatch_failed" or nothing happens, the Slack Command workflow is not published. If you get "Request could not be verified", the signing secret in **Sign Request** is wrong; open the latest execution and check `Really From Slack?`.
