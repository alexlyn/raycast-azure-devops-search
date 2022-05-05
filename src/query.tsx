import { ActionPanel, Action, List, Icon, showToast, Toast } from "@raycast/api"
import { Detail } from "@raycast/api";
import { getPreferenceValues } from "@raycast/api"
import { useEffect, useState } from "react";
import * as devops from "./devops"
import * as workitem from "./workitem"
import * as CoreInterfaces from "azure-devops-node-api/interfaces/CoreInterfaces"
import { QueryType } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";
import { ErrorText, PresentableError } from "./exception"

const prefs: { domain: string; user: string; token: string; project: string; icons: string } = getPreferenceValues()

interface Query {
    id: string,
    name: string,
    type?: QueryType
}

interface State {
    isLoading: boolean;
    projects: CoreInterfaces.TeamProject[],
    selectedProjectId: string,
    selectedProjectName: string,
    searchText?: string,
    queryResults?: Query[],
    results?: workitem.WorkItem[];
    error?: Error;
}

export default function Command() {
    const [state, setState] = useState<State>({ isLoading: false, projects: [], selectedProjectName: prefs.project, selectedProjectId: ""});

    const querySearch = async (searchText?: string, projectId?: string) => {
        if (state.projects.length == 0 || searchText == undefined || searchText.length == 0) return

        console.log(`search for ${searchText} in ${state.selectedProjectName}`)

        setState((previous) => ({ ...previous, isLoading: true, searchText: searchText}))

        devops.querySearch(searchText, projectId ? projectId : state.selectedProjectId)
            .then((results) => {
                console.log(`got ${results.value?.length} results`)
                if (!results.value) return

                let newResults: Query[] = []
                results.value.map((item) => {
                    if (item.id == undefined || item.name == undefined) return

                    newResults.push({
                        id: item.id,
                        name: item.name,
                        type: item.queryType
                    })
                })
                console.log(JSON.stringify(newResults))
                setState((previous) => ({ ...previous, queryResults: newResults}))                
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

        await querySearch(searchText)
    }

    useEffect(() => {
        async function fetchProjects() {
            try {
                const projects = await devops.getProjects()
                console.log(`fetched ${projects.length} projects.`)
                const defaultProject = workitem.findProjectIdByName(projects, prefs.project)
                console.log(`default project: ${defaultProject}`)
                setState((previous) => ({
                    ...previous,
                    isLoading: false,
                    selectedProjectId: defaultProject,
                    projects: projects
                }))
            } catch (error) {
                setState((previous) => ({
                    ...previous,
                    error: new PresentableError("Error", "Cannot connect to Azure DevOps. Check domain and PAT."),
                    isLoading: false,
                    projects: []
                }))
            }
        }

        fetchProjects();
    }, [])
    
    if (state.error) {
        showToast(Toast.Style.Failure, state.error.name, state.error.message)
    }

    return (
        <List 
            searchBarPlaceholder={'Search queries'} 
            onSearchTextChange={onSearchChange} 
            isLoading={(!state.projects && !state.error) || state.isLoading}
            enableFiltering={false}
            throttle={true}
            searchBarAccessory={
                <List.Dropdown
                    tooltip="Select Project"
                    storeValue={true}
                    onChange={(newProject) => {
                        setState((previous) => ({ ...previous, selectedProjectId: newProject}))
                        querySearch(state.searchText, newProject)
                    }}
                >
                    { state.projects?.map((project) => (
                        <List.Dropdown.Item 
                            key={project.id} 
                            title={project.name || ""} value={project.id || ""}   
                        /> 
                    )) }
                </List.Dropdown>
            }
            >
                { state.queryResults?.map((result) => (
                    <List.Item 
                        title={result.name} 
                        key={result.id}
                        icon={{
                            source: getQueryTypeIcon(result.type)
                        }}                        
                        actions={
                            <ActionPanel>
                                <ActionPanel.Section title="URL">
                                    <Action.OpenInBrowser url={encodeURI(`https://${prefs.domain}/${state.selectedProjectName}/_queries/query/${result.id}`)}/>
                                    <Action.CopyToClipboard content={encodeURI(`https://${prefs.domain}/${state.selectedProjectName}/_queries/query/${result.id}`)} />
                                </ActionPanel.Section>
                    
                            </ActionPanel>
                        } 
                    />
                ))}
    
            </List>
        );
}

function getQueryTypeIcon(type?: QueryType): string {
    const iconTypeModifier = prefs.icons == "solid" ? "-solid" : ""

    switch (type) {
        case QueryType.Flat:
            return "query-flat" + iconTypeModifier + ".svg"
        case QueryType.Tree:
            return "query-tree" + iconTypeModifier + ".svg"
        case QueryType.OneHop:
            return "query-onehop" + iconTypeModifier + ".svg"
    }
    return "query-flat.svg"
}