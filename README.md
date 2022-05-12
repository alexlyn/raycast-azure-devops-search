# Azure DevOps Search

Search for work items and queries in Azure DevOps.

## Features

- Work item search
  - Searcy by assignee with @. For example @alex.
  - Search by work item type with #. For example #bug
- Query search
- Use the following actions on found entities:
  - Open in browser
  - Copy URL
  - Copy markdown link
  - Copy HTML link

## Setup

To connect the extension to your Azure DevOps instance you need to fill the following preferences:

- **Azure DevOps Domain**: The domain of your instance in the form `dev.azure.com/mycompany`. Do not include `https://` at the beginning.
- **Personal Access Token**: A personal access token is an alternate password to authenticate into Azure DevOps as described in [Use personal access tokens](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops&tabs=Windows)
- **Project**: Name of default project to search for queries.
- **Show Recents**: Configure whether recently updated work items should be shown when Work Item Search is invoked, or results remain blank until search text is typed.
- **Icons**: Choose between solid and outline icons.
