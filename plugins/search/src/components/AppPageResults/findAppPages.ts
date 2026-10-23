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
  pluginId: string;
  location: string;
  icon?: IconElement;
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

    return [{ title, pluginId, location, icon }];
  });
}

/**
 * Finds pages installed in the app whose title, plugin ID or path match the
 * search term, best matches first.
 */
export function findAppPages(options: {
  appTreeApi: AppTreeApi;
  routeResolutionApi: RouteResolutionApi;
  term: string;
}): AppPage[] {
  const term = options.term.trim().toLowerCase();
  if (!term) return [];

  const score = (page: AppPage) => {
    const title = page.title.toLowerCase();
    const pluginId = page.pluginId.toLowerCase();
    if (title === term || pluginId === term) return 3;
    if (title.startsWith(term) || pluginId.startsWith(term)) return 2;
    return 1;
  };

  return getAppPages(options.appTreeApi, options.routeResolutionApi)
    .filter(page =>
      [page.title, page.pluginId, page.location].some(field =>
        field.toLowerCase().includes(term),
      ),
    )
    .sort((a, b) => score(b) - score(a) || a.title.localeCompare(b.title))
    .slice(0, MAX_APP_PAGES);
}
