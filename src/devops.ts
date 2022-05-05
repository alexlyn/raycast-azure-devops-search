import { getPreferenceValues } from "@raycast/api"
import * as azdev from "azure-devops-node-api"
import * as wit from "azure-devops-node-api/WorkItemTrackingApi"
import * as core from "azure-devops-node-api/CoreApi"
import * as CoreInterfaces from "azure-devops-node-api/interfaces/CoreInterfaces"
import * as WorkItemTrackingInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces"
import { PresentableError } from "./exception"

const prefs: { domain: string; user: string; token: string; project: string } = getPreferenceValues()

// Create the Azure DevOps connection
let authHandler = azdev.getPersonalAccessTokenHandler(prefs.token)
let connection = new azdev.WebApi('https://'+prefs.domain, authHandler)

export async function getRecentlyUpdated(
    top: number,
): Promise<WorkItemTrackingInterfaces.WorkItem[]> {
    try {
        let witClient = await connection.getWorkItemTrackingApi()

        // Execute the query
        const wiql = `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo]
        FROM WorkItems
        ORDER BY [Changed Date] Desc
        `
        let wiqlQuery : WorkItemTrackingInterfaces.Wiql = {
            query: wiql
        }
        let queryResult = await witClient.queryByWiql(wiqlQuery, undefined, undefined, top)
        if (queryResult.workItems == undefined || queryResult.workItems.length == 0) {
            const empty: WorkItemTrackingInterfaces.WorkItem[] = []
            return empty
        }

        // Get work items
        let ids: number[] = []
        queryResult.workItems?.forEach((wi) => {if (wi.id != undefined) ids.push(wi.id)})
        let fields: string[] = []
        queryResult.columns?.forEach((col) => {if (col.referenceName != undefined) fields.push(col.referenceName)})

        let b: WorkItemTrackingInterfaces.WorkItemBatchGetRequest = {
            ids: ids,
            fields: fields
        }
        let workItems = await witClient.getWorkItemsBatch(b)
        return workItems
    } catch (error) {
        throw new PresentableError("Error", "Cannot connect to Azure DevOps. Check domain and PAT.");
    }
}

export async function workItemSearch(
    wiql: string,
    projectId?: string
): Promise<WorkItemTrackingInterfaces.WorkItem[]> {
    try {
        // Create the WIT client
        let witClient: wit.WorkItemTrackingApi = await connection.getWorkItemTrackingApi()
        let coreClient: core.CoreApi = await connection.getCoreApi()

        // Execute query
        let wiqlQuery : WorkItemTrackingInterfaces.Wiql = {
            query: wiql
        }
        // Define team context using the selected project
        let teamContext: CoreInterfaces.TeamContext | undefined = undefined
        if (projectId != undefined) {
            const project: CoreInterfaces.TeamProject = await coreClient.getProject(projectId)
            teamContext = {
                project: project.name,
                projectId: projectId,
                team: project.defaultTeam?.name,
                teamId: project.defaultTeam?.id
            }
        }

        let queryResult = await witClient.queryByWiql(wiqlQuery, teamContext, undefined, 20)

        if (queryResult.workItems == undefined || queryResult.workItems.length == 0) {
            const empty: WorkItemTrackingInterfaces.WorkItem[] = []
            return empty
        }

        // Get work items
        let ids: number[] = []
        queryResult.workItems?.forEach((wi) => {if (wi.id != undefined) ids.push(wi.id)})
        let fields: string[] = []
        queryResult.columns?.forEach((col) => {if (col.referenceName != undefined) fields.push(col.referenceName)})

        let b: WorkItemTrackingInterfaces.WorkItemBatchGetRequest = {
            ids: ids,
            fields: fields
        }
        let workItems = await witClient.getWorkItemsBatch(b)
        return workItems
    } catch (error) {
        console.log(error);
        throw new PresentableError("Error", "Cannot connect to Azure DevOps. Check domain and PAT.");
    }
}

export async function querySearch(
    search: string,
    projectId?: string
): Promise<WorkItemTrackingInterfaces.QueryHierarchyItemsResult> {
    try {
        // Create the WIT client
        let witClient: wit.WorkItemTrackingApi = await connection.getWorkItemTrackingApi()
        let coreClient: core.CoreApi = await connection.getCoreApi()

        // Execute query

        // Define team context using the selected project
        let teamContext: CoreInterfaces.TeamContext | undefined = undefined
        if (projectId != undefined) {
            const project: CoreInterfaces.TeamProject = await coreClient.getProject(projectId)
            teamContext = {
                project: project.name,
                projectId: projectId,
                team: project.defaultTeam?.name,
                teamId: project.defaultTeam?.id
            }
        }
        witClient.getRecentActivityData()
        let queryResult = await witClient.searchQueries(teamContext && teamContext.project ? teamContext.project : prefs.project, search, 20)

        return queryResult
    } catch (error) {
        console.log(error);
        throw new PresentableError("Error", "Cannot connect to Azure DevOps. Check domain and PAT.");
    }

}

export async function getProjects(): Promise<CoreInterfaces.TeamProject[]> {
    let coreClient: core.CoreApi = await connection.getCoreApi()

    let projects = await coreClient.getProjects();

    return projects
}
