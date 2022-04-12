import * as azdev from "azure-devops-node-api"
import * as wit from "azure-devops-node-api/WorkItemTrackingApi"
import * as core from "azure-devops-node-api/CoreApi"
import * as WorkItemTrackingInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces"
import { getPreferenceValues } from "@raycast/api"
import fetch, { FetchError, Response } from "node-fetch"

const prefs: { domain: string; user: string; token: string } = getPreferenceValues()

// Create the Azure DevOps connection
let authHandler = azdev.getPersonalAccessTokenHandler(prefs.token)
let connection = new azdev.WebApi('https://'+prefs.domain, authHandler)


export async function workItemSearch(
    wiql: string
): Promise<WorkItemTrackingInterfaces.WorkItem[]> {
    console.log("workItemSearch")

    // Create the WIT client
    let witClient: wit.WorkItemTrackingApi = await connection.getWorkItemTrackingApi()
 
    // Execute query
    let wiqlQuery : WorkItemTrackingInterfaces.Wiql = {
        query: wiql
    }    
    let queryResult = await witClient.queryByWiql(wiqlQuery, undefined, undefined, 20)

    if (queryResult.workItems == undefined || queryResult.workItems.length == 0) {
        const empty: WorkItemTrackingInterfaces.WorkItem[] = []
        return empty
    }

    // Get work items
    let ids: number[] = []
    queryResult.workItems?.forEach((wi) => {if (wi.id != undefined) ids.push(wi.id)})
    let fields: string[] = []
    queryResult.columns?.forEach((col) => {if (col.referenceName != undefined) fields.push(col.referenceName)})
    console.log(fields)
    let b: WorkItemTrackingInterfaces.WorkItemBatchGetRequest = {
        ids: ids,
        fields: fields
    }
    let workItems = await witClient.getWorkItemsBatch(b)
    return workItems
}

export async function getProjects(): Promise<string[]> {
    let coreClient: core.CoreApi = await connection.getCoreApi()

    let projects = coreClient.getProjects();
    let projectList: string[] = [];
    (await projects).forEach((project) => {
        if (project.name != undefined) {
            projectList.push(project.name)
        }
    })

    return projectList
}