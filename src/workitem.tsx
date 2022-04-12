import { ActionPanel, Action, List } from "@raycast/api"
import { Detail } from "@raycast/api";
import { getPreferenceValues } from "@raycast/api"
import { useEffect, useState } from "react";
import * as devops from "./devops"

interface WorkItem {
    id: number,
    title: string,
    state: string,
    type: string
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
        console.log("onSearchChange")
        console.log(`searchText: ${searchText}, selectedProject: ${state.selectedProject}`)

        if (searchText.length == 0) return

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
                type: item.fields["System.WorkItemType"]
            })
            console.log(JSON.stringify(item.fields))
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
                        { text: result.state }
                    ]} />
            ))}

        </List>
    );

}

function buildWiql(searchText: string): string {
    if (!isNaN(Number(searchText))) {
        // Search string is a number. Search by work item ID
        return `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo]
                FROM WorkItems
                WHERE [System.Id] = ${searchText}`
    }
    return `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo]
        FROM WorkItems
        ORDER BY [Changed Date] Desc
        WHERE [System.Title] Contains Words "${searchText}"
    `
}