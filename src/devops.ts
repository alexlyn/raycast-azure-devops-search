import { getPreferenceValues, LocalStorage } from "@raycast/api";
import * as axios from "axios";
import * as azdev from "azure-devops-node-api";
import * as wit from "azure-devops-node-api/WorkItemTrackingApi";
import * as core from "azure-devops-node-api/CoreApi";
import * as CoreInterfaces from "azure-devops-node-api/interfaces/CoreInterfaces";
import * as WorkItemTrackingInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";
import { PresentableError } from "./exception";

const numWorkItemResults = 25;
const numQueryResults = 25;

const prefs: { domain: string; user: string; token: string; project: string } =
  getPreferenceValues();

// Create the Azure DevOps connection
const authHandler = azdev.getPersonalAccessTokenHandler(prefs.token);
const connection = new azdev.WebApi("https://" + prefs.domain, authHandler);

export async function getRecentlyUpdated(
  top: number,
): Promise<WorkItemTrackingInterfaces.WorkItem[]> {
  try {
    const witClient = await connection.getWorkItemTrackingApi();

    // Execute the query
    const wiql = `SELECT [System.Id], [System.TeamProject], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo]
        FROM WorkItems
        ORDER BY [Changed Date] Desc
        `;
    const wiqlQuery: WorkItemTrackingInterfaces.Wiql = {
      query: wiql,
    };
    const queryResult = await witClient.queryByWiql(
      wiqlQuery,
      undefined,
      undefined,
      top,
    );
    if (
      queryResult.workItems == undefined ||
      queryResult.workItems.length == 0
    ) {
      const empty: WorkItemTrackingInterfaces.WorkItem[] = [];
      return empty;
    }

    // Get work items
    const ids: number[] = [];
    queryResult.workItems?.forEach((wi) => {
      if (wi.id != undefined) ids.push(wi.id);
    });
    const fields: string[] = [];
    queryResult.columns?.forEach((col) => {
      if (col.referenceName != undefined) fields.push(col.referenceName);
    });

    const b: WorkItemTrackingInterfaces.WorkItemBatchGetRequest = {
      ids: ids,
      fields: fields,
    };
    const workItems = await witClient.getWorkItemsBatch(b);

    // Add icons to results
    for (const wi of workItems) {
      if (wi.fields) {
        wi.fields["Local.IconUrl"] = await getWorkItemIcon(
          wi.fields["System.TeamProject"] as string,
          wi.fields["System.WorkItemType"] as string,
        );
      }
    }

    return workItems;
  } catch {
    throw new PresentableError(
      "Error",
      "Cannot connect to Azure DevOps. Check domain and PAT.",
    );
  }
}

export async function workItemSearch(
  wiql: string,
  projectId?: string,
): Promise<WorkItemTrackingInterfaces.WorkItem[]> {
  try {
    // Create the WIT client
    const witClient: wit.WorkItemTrackingApi =
      await connection.getWorkItemTrackingApi();
    const coreClient: core.CoreApi = await connection.getCoreApi();

    // Execute query
    const wiqlQuery: WorkItemTrackingInterfaces.Wiql = {
      query: wiql,
    };
    // Define team context using the selected project
    let teamContext: CoreInterfaces.TeamContext | undefined = undefined;
    if (projectId != undefined) {
      const project: CoreInterfaces.TeamProject =
        await coreClient.getProject(projectId);
      teamContext = {
        project: project.name,
        projectId: projectId,
        team: project.defaultTeam?.name,
        teamId: project.defaultTeam?.id,
      };
    }

    const queryResult = await witClient.queryByWiql(
      wiqlQuery,
      teamContext,
      undefined,
      numWorkItemResults,
    );

    if (
      queryResult.workItems == undefined ||
      queryResult.workItems.length == 0
    ) {
      const empty: WorkItemTrackingInterfaces.WorkItem[] = [];
      return empty;
    }

    // Get work items
    const ids: number[] = [];
    queryResult.workItems?.forEach((wi) => {
      if (wi.id != undefined) ids.push(wi.id);
    });
    const fields: string[] = [];
    queryResult.columns?.forEach((col) => {
      if (col.referenceName != undefined) fields.push(col.referenceName);
    });

    const b: WorkItemTrackingInterfaces.WorkItemBatchGetRequest = {
      ids: ids,
      fields: fields,
    };
    const workItems = await witClient.getWorkItemsBatch(b);

    // Add icons to results
    for (const wi of workItems) {
      if (wi.fields) {
        wi.fields["Local.IconUrl"] = await getWorkItemIcon(
          wi.fields["System.TeamProject"] as string,
          wi.fields["System.WorkItemType"] as string,
        );
      }
    }

    return workItems;
  } catch (error) {
    console.log(error);
    throw new PresentableError(
      "Error",
      "Cannot connect to Azure DevOps. Check domain and PAT.",
    );
  }
}

export async function querySearch(
  search: string,
  projectId?: string,
): Promise<WorkItemTrackingInterfaces.QueryHierarchyItemsResult> {
  try {
    // Create the WIT client
    const witClient: wit.WorkItemTrackingApi =
      await connection.getWorkItemTrackingApi();
    const coreClient: core.CoreApi = await connection.getCoreApi();

    // Execute query

    // Define team context using the selected project
    let teamContext: CoreInterfaces.TeamContext | undefined = undefined;
    if (projectId != undefined) {
      const project: CoreInterfaces.TeamProject =
        await coreClient.getProject(projectId);
      teamContext = {
        project: project.name,
        projectId: projectId,
        team: project.defaultTeam?.name,
        teamId: project.defaultTeam?.id,
      };
    }
    witClient.getRecentActivityData();
    const queryResult = await witClient.searchQueries(
      teamContext && teamContext.project ? teamContext.project : prefs.project,
      search,
      numQueryResults,
    );

    return queryResult;
  } catch (error) {
    console.log(error);
    throw new PresentableError(
      "Error",
      "Cannot connect to Azure DevOps. Check domain and PAT.",
    );
  }
}

export async function getProjects(): Promise<CoreInterfaces.TeamProject[]> {
  const coreClient: core.CoreApi = await connection.getCoreApi();

  const projects = await coreClient.getProjects();

  return projects;
}

// Get icons for all work item types in a project
export async function getWorkItemIcons(
  project: string,
): Promise<{ [key: string]: string }> {
  const iconMap: { [key: string]: string } = {};

  const url = `https://${prefs.domain}/${project}/_apis/wit/workitemtypes?api-version=6.0`;

  const response = await axios.default.get(url, {
    auth: {
      username: "",
      password: prefs.token,
    },
  });

  for (const wi of response.data.value) {
    const commonHeaders = axios.default.defaults.headers.common;
    axios.default.defaults.headers.common = {};
    const iconResponse = await axios.default.get(wi.icon.url);
    axios.default.defaults.headers.common = commonHeaders;

    iconMap[`${project}!!${wi.name}`] =
      `data:image/svg+xml;utf8,${iconResponse.data}`;
  }

  return iconMap;
}

// Get icon for a work item type
// TODO: Reload icons periodically (e.g. every 5 days)
async function getWorkItemIcon(project: string, type: string): Promise<string> {
  // If the icon URL is already in the cache, return it
  let iconUrl = await LocalStorage.getItem<string>(`${project}!!${type}`);
  if (iconUrl != undefined) return iconUrl;

  console.log(`Can't find icon for ${type} in ${project}. Fetching icons.`);

  // Gather icons
  const results = await getWorkItemIcons(project);

  // Enumerate the results and cache the icon URL
  for (const key in results) {
    await LocalStorage.setItem(`${key}`, results[key]);
    if (key == `${project}!!${type}`) {
      iconUrl = results[key];
    }
  }

  return iconUrl != undefined ? iconUrl : "";
}
