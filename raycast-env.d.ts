/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Azure DevOps Domain - Your Azure DevOps domain (e.g. 'dev.azure.com/mycompany') */
  "domain": string,
  /** Personal Access Token - Your Personal Access Token */
  "token": string,
  /** Default Project - Default project for query searches */
  "project": string,
  /** undefined - Show recently updated work items in the search results */
  "showRecent": boolean,
  /** Query Icons - Icons to use for queries */
  "icons": "solid" | "outline"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `workitem` command */
  export type Workitem = ExtensionPreferences & {}
  /** Preferences accessible in the `query` command */
  export type Query = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `workitem` command */
  export type Workitem = {}
  /** Arguments passed to the `query` command */
  export type Query = {}
}

