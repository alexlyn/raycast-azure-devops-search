import * as azdev from "azure-devops-node-api"
import * as wit from "azure-devops-node-api/WorkItemTrackingApi"
import * as core from "azure-devops-node-api/CoreApi"
import * as CoreInterfaces from "azure-devops-node-api/interfaces/CoreInterfaces"
import * as WorkItemTrackingInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces"
import { getPreferenceValues } from "@raycast/api"
import fetch, { FetchError, Response } from "node-fetch"

const prefs: { domain: string; user: string; token: string } = getPreferenceValues()

// Create the Azure DevOps connection
let authHandler = azdev.getPersonalAccessTokenHandler(prefs.token)
let connection = new azdev.WebApi('https://'+prefs.domain, authHandler)


export async function workItemSearch(
    wiql: string,
    projectId?: string
): Promise<WorkItemTrackingInterfaces.WorkItem[]> {
    console.log("workItemSearch")
    console.log(`project: ${projectId}`)

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
    //console.log(JSON.stringify(workItems))
    return workItems
}

export async function getProjects(): Promise<CoreInterfaces.TeamProject[]> {
    let coreClient: core.CoreApi = await connection.getCoreApi()

    let projects = await coreClient.getProjects();

    return projects
}
