/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  AppTreeApi,
  coreExtensionData,
  IconElement,
  RouteResolutionApi,
} from '@backstage/frontend-plugin-api';

const MAX_APP_PAGES = 5;

export type AppPage = {
  title: string;
  location: string;
  icon?: IconElement;
  /** Title of the parent page, set for sub-pages. */
  parentTitle?: string;
  /** Lowercased values matched against the search term, best first. */
  keywords: string[];
};

// Mirrors how the app nav picks pages, their titles and icons.
function getAppPages(
  appTreeApi: AppTreeApi,
  routeResolutionApi: RouteResolutionApi,
): AppPage[] {
  const { tree } = appTreeApi.getTree();
  const pageNodes =
    tree.nodes.get('app/routes')?.edges.attachments.get('routes') ?? [];

  return pageNodes.flatMap(node => {
    if (!node.instance || node.spec.disabled) return [];

    const routeRef = node.instance.getData(coreExtensionData.routeRef);
    if (!routeRef) return [];

    let location: string | undefined;
    try {
      location = routeResolutionApi.resolve(routeRef)?.();
    } catch {
      // Routes that require parameters can't be linked to directly.
    }
    if (!location || location.includes(':')) return [];

    const { pluginId, title: pluginTitle, icon: pluginIcon } = node.spec.plugin;
    const title =
      node.instance.getData(coreExtensionData.title) ?? pluginTitle ?? pluginId;
    const icon = node.instance.getData(coreExtensionData.icon) ?? pluginIcon;
    const page: AppPage = {
      title,
      location,
      icon,
      keywords: [title, pluginId, location].map(k => k.toLowerCase()),
    };

    // Sub-pages are only matched on their own title and path, so that
    // searching for a plugin doesn't list every one of its tabs.
    const subPages = (node.edges.attachments.get('pages') ?? []).flatMap(
      subNode => {
        if (!subNode.instance || subNode.spec.disabled) return [];
        const subTitle = subNode.instance.getData(coreExtensionData.title);
        const subPath = subNode.instance.getData(coreExtensionData.routePath);
        if (!subTitle || !subPath || subPath.includes(':')) return [];
        return [
          {
            title: subTitle,
            location: `${location.replace(/\/$/, '')}/${subPath}`,
            icon,
            parentTitle: title,
            keywords: [subTitle, subPath].map(k => k.toLowerCase()),
          },
        ];
      },
    );

    return [page, ...subPages];
  });
}

/**
 * Finds pages and sub-pages installed in the app whose title, plugin ID or
 * path match the search term, best matches first.
 */
export function findAppPages(options: {
  appTreeApi: AppTreeApi;
  routeResolutionApi: RouteResolutionApi;
  term: string;
}): AppPage[] {
  const term = options.term.trim().toLowerCase();
  if (!term) return [];

  const score = ({ keywords }: AppPage) => {
    if (keywords.some(k => k === term)) return 3;
    if (keywords.some(k => k.startsWith(term))) return 2;
    return 1;
  };

  return getAppPages(options.appTreeApi, options.routeResolutionApi)
    .filter(page => page.keywords.some(k => k.includes(term)))
    .sort((a, b) => score(b) - score(a) || a.title.localeCompare(b.title))
    .slice(0, MAX_APP_PAGES);
}
