import { ActionPanel, Action, List, Icon, showToast, Toast } from "@raycast/api"
import { Detail } from "@raycast/api";
import { getPreferenceValues } from "@raycast/api"
import { useEffect, useState } from "react";
import * as devops from "./devops"
import * as CoreInterfaces from "azure-devops-node-api/interfaces/CoreInterfaces"
import { ErrorText } from "./exception"

export interface WorkItem {
    id: number,
    title: string,
    state: string,
    type: string,
    assignedTo: string
}

interface State {
    isLoading: boolean;
    projects: CoreInterfaces.TeamProject[],
    selectedProjectId: string,
    selectedProjectName: string,
    searchText?: string,
    results?: WorkItem[];
    error?: Error;
}

function getWorkItemTypeIcon(type: string) {
    switch (type) {
        case "Task":
            return "task.svg"
        case "Bug":
            return "bug.svg"
        case "Epic":
            return "epic.svg"
        case "Feature":
            return "feature.svg"
        case "Product Backlog Item":
            return "pbi.svg"
        case "Product Portfolio":
            return "portfolio.svg"
        case "Test Case":
            return "testcase.svg" 
        default:
            return "task.svg"
    }
}

const prefs: { domain: string; user: string; token: string; project: string } = getPreferenceValues()

export default function Command() {
    const [state, setState] = useState<State>({ isLoading: false, projects: [], selectedProjectName: prefs.project, selectedProjectId: ""});

    const markdownLink = (item: WorkItem) => `[${item.title}](${encodeURI(`https://${prefs.domain}/${state.selectedProjectName}/_workitems/edit/${item.id}`)})`
    const htmlLink = (item: WorkItem) => `<a href="${encodeURI(`https://${prefs.domain}/${state.selectedProjectName}/_workitems/edit/${item.id}`)}">${item.title}</a>`
    
    const issueSearch = async (searchText?: string) => {
        if (searchText == undefined) return

        console.log(`search for ${searchText} in ${state.selectedProjectName}`)
        const wiql = buildWiql(searchText)
        if (wiql.length == 0) return

        setState((previous) => ({ ...previous, isLoading: true, searchText: searchText}))

        devops.workItemSearch(wiql, state.selectedProjectId)
            .then((results) => {
                console.log(`got ${results.length} results`)

                let newResults: WorkItem[] = []
                results.map((item) => {
                    if (item.id == undefined || item.fields == undefined) return
        
                    newResults.push({
                        id: item.id,
                        title: item.fields["System.Title"],
                        state: item.fields["System.State"],
                        type: item.fields["System.WorkItemType"],
                        assignedTo: item.fields["System.AssignedTo"] != undefined ? item.fields["System.AssignedTo"]["displayName"] : ""
                    })
                })
                console.log(JSON.stringify(newResults))
                setState((previous) => ({ ...previous, results: newResults}))
            })
            .catch((e) => {
                setState((previous) => ({ ...previous, results: [], error: ErrorText(e.name, e.message)}))
            })
            .finally(() => {
                setState((previous) => ({ ...previous, isLoading: false}))
            })
    }

    const onSearchChange = async (searchText: string) => {
        console.log(`searchText: ${searchText}, selectedProjectId: ${state.selectedProjectId}`)

        await issueSearch(searchText)
    }

    if (state.error) {
        showToast(Toast.Style.Failure, state.error.name, state.error.message)
    }

    return (
    <List 
        searchBarPlaceholder={'Search work items'}
        onSearchTextChange={onSearchChange}
        isLoading={(!state.projects && !state.error) || state.isLoading}
        enableFiltering={false}
        throttle={true}
        >
            { state.results?.map((result) => (
                <List.Item 
                    title={result.id + " " + result.title} 
                    key={result.id}
                    icon={{
                        source: getWorkItemTypeIcon(result.type)
                    }}
                    actions={
                        <ActionPanel>
                            <ActionPanel.Section title="URL">
                                <Action.OpenInBrowser url={encodeURI(`https://${prefs.domain}/${state.selectedProjectName}/_workitems/edit/${result.id}`)}/>
                                <Action.CopyToClipboard content={encodeURI(`https://${prefs.domain}/${state.selectedProjectName}/_workitems/edit/${result.id}`)} />
                            </ActionPanel.Section>
                            <ActionPanel.Section title="Link">
                                <Action.CopyToClipboard content={markdownLink(result)} title="Copy Markdown Link"/>
                                <Action.CopyToClipboard content={htmlLink(result)} title="Copy HTML Link"/>
                            </ActionPanel.Section>                            
                        </ActionPanel>
                    }
                    accessories={[
                        { icon: { source: getIconForState(result.state) }, tooltip: result.state, text: result.assignedTo }
                    ]} />
            ))}

        </List>
    );
}

function getIconForState(state: string): string {
    let icon = "circle-gray.svg"
    switch (state) {
        case "In Progress":
            icon = "circle-blue.svg"
            break
        case "Blocked":
            icon = "circle-red.svg"
            break
        case "Won't Fix":
            icon = "circle-red.svg"
            break
        case "Testing":
            icon = "circle-pink.svg"
            break
        case "Resolved":
            icon = "circle-orange.svg"
            break
        case "Done":
            icon = "circle-green.svg"
            break
    }
    return icon
}

function buildWiql(searchText: string): string {
    const collectPrefixed = (prefix: string, terms: string[]): string[] =>
    terms
        .filter((term) => term.startsWith(prefix) && term.length > prefix.length)
        .map((term) => term.substring(prefix.length))

    const isItemId = (searchText: string): boolean => {
        let intRegex: RegExp = /^\d+$/
        if (searchText.length > 0 && intRegex.test(searchText)) return true
        return false
    }

    // Search string is a number. Search by work item ID
    if (isItemId(searchText)) {
        return `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo]
                FROM WorkItems
                WHERE [System.Id] = ${searchText}`
    }
    console.log('not item search. building query')

    // Build WIQL
    const spaceAndInvalidChars = /[ "]/
    const terms = searchText.split(spaceAndInvalidChars).filter((term) => term.length > 0)

    let whereClauses: string[] = []

    const unwantedTextTermChars = /[-+!*&]/

    const textClauses = terms
        .filter((term) => !"@#".includes(term[0]))
        .flatMap((term) => term.split(unwantedTextTermChars))
        .filter((term) => term.length > 0)
        .map((term) => `[System.Title] Contains Words "${term}"`)
    whereClauses = whereClauses.concat(textClauses)
    console.log(whereClauses)

    const assignedTo = collectPrefixed("@", terms)
        .map((term) => term.toLowerCase() == "me" ? `[System.AssignedTo] = @${term}` : `[System.AssignedTo] Contains "${term}"`)
    whereClauses = whereClauses.concat(assignedTo)

    const wiType = collectPrefixed("#", terms)
        .map((term) => `[System.WorkItemType] Contains "${term}"`)
    whereClauses = whereClauses.concat(wiType)

    if (whereClauses.length == 0) return ""

    const wiql = `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo]
    FROM WorkItems
    ORDER BY [Changed Date] Desc
    WHERE ${whereClauses.join(" AND ")}
    `
    console.log(wiql)
    return wiql
}

export function findProjectIdByName(projects: CoreInterfaces.TeamProject[], defaultProject: string): string {
    projects.forEach((project) => {
        if (project.name == defaultProject) return project.id
    })
    return ""
}

function findProjectNameById(projects: CoreInterfaces.TeamProject[], id: string): string {
    projects.forEach((project) => {
        if (project.id == id) return project.name
    })
    return ""
}