import { ActionPanel, Action, List, Icon } from "@raycast/api"
import { Detail } from "@raycast/api";
import { getPreferenceValues } from "@raycast/api"
import { useEffect, useState } from "react";
import * as devops from "./devops"

interface WorkItem {
    id: number,
    title: string,
    state: string,
    type: string,
    assignedTo: string
}

interface State {
    isLoading: boolean;
    projects?: string[];
    selectedProject: string,
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
    const [state, setState] = useState<State>({ isLoading: false, projects: ["Main"], selectedProject: prefs.project});

    const markdownLink = (item: WorkItem) => `[${item.title}](${`https://${prefs.domain}/${state.selectedProject}/_workitems/edit/${item.id}`})`
    const htmlLink = (item: WorkItem) => `<a href="${`https://${prefs.domain}/${state.selectedProject}/_workitems/edit/${item.id}`}">${item.title}</a>`
    

    const onSearchChange = async (searchText: string) => {
        console.log(`searchText: ${searchText}, selectedProject: ${state.selectedProject}`)

        if (searchText.length == 0) return

        setState((previous) => ({ ...previous, isLoading: true}))
        const wiql = buildWiql(searchText)

        const results = await devops.workItemSearch(wiql)
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
        setState((previous) => ({ ...previous, isLoading: false, results: newResults}))
    }

    useEffect(() => {
        async function fetchProjects() {
            try {
                const projects = await devops.getProjects()
                console.log(`fetched ${projects.length} projects.`)
                setState((previous) => ({
                    ...previous,
                    isLoading: false,
                    projects: projects
                }))
            } catch (error) {
                setState((previous) => ({
                    ...previous,
                    error: error instanceof Error ? error : new Error("Something went wrong"),
                    isLoading: false,
                    projects: []
                }))
            }
    
        }

        fetchProjects();
    }, [])

    return (
    <List 
        searchBarPlaceholder={'Search work items'} 
        onSearchTextChange={onSearchChange} 
        isLoading={(!state.projects && !state.error) || state.isLoading}
        enableFiltering={false}
        throttle={true}
        searchBarAccessory={
            <List.Dropdown
                tooltip="Select Project"
                storeValue={true}
                onChange={(newProject) => setState((previous) => ({ ...previous, selectedProject: newProject}))}
            >
                { state.projects?.map((project) => (
                    <List.Dropdown.Item key={project} title={project} value={project} /> 
                )) }
            </List.Dropdown>
        }
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
                                <Action.OpenInBrowser url={`https://${prefs.domain}/${state.selectedProject}/_workitems/edit/${result.id}`}/>
                                <Action.CopyToClipboard content={`https://${prefs.domain}/${state.selectedProject}/_workitems/edit/${result.id}`} />
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
    console.log(`icon: ${icon} for ${state}`)
    return icon
}

function buildWiql(searchText: string): string {
    if (!isNaN(Number(searchText))) {
        // Search string is a number. Search by work item ID
        return `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo]
                FROM WorkItems
                WHERE [System.Id] = ${searchText}`
    }

    const words = searchText.split(" ")
    let whereClauses: string[] = []
    words.map((word) => { if (word.length > 0) whereClauses.push(`[System.Title] Contains Words "${word}"`) })
    return `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo]
        FROM WorkItems
        ORDER BY [Changed Date] Desc
        WHERE ${whereClauses.join(" AND ")}
    `
}