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

import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiRegistry } from '@backstage/test-utils';
import { ApiProvider, ConfigReader } from '@backstage/core-app-api';
import { configApiRef } from '@backstage/core-plugin-api';
import {
  AppTreeApi,
  appTreeApiRef,
  coreExtensionData,
  createRouteRef,
  RouteResolutionApi,
  routeResolutionApiRef,
} from '@backstage/frontend-plugin-api';
import {
  searchApiRef,
  SearchContextProvider,
} from '@backstage/plugin-search-react';

import { SearchResultSet } from '@backstage/plugin-search-common';

import { rootRouteRef } from '../../plugin';
import { SearchModal } from '../SearchModal';
import { findAppPages } from './findAppPages';

function createPageNode(options: {
  pluginId: string;
  pluginTitle?: string;
  title?: string;
  path?: string;
  disabled?: boolean;
}) {
  const routeRef = createRouteRef();
  const data = new Map<string, unknown>([
    [coreExtensionData.routeRef.id, routeRef],
    [coreExtensionData.title.id, options.title],
  ]);
  return {
    node: {
      spec: {
        disabled: options.disabled ?? false,
        plugin: { pluginId: options.pluginId, title: options.pluginTitle },
      },
      instance: { getData: (ref: { id: string }) => data.get(ref.id) },
    },
    routeRef,
    path: options.path ?? `/${options.pluginId}`,
  };
}

const pages = [
  createPageNode({ pluginId: 'catalog', title: 'Catalog' }),
  createPageNode({ pluginId: 'tech-radar', pluginTitle: 'Tech Radar' }),
  createPageNode({ pluginId: 'techdocs', title: 'Docs', path: '/docs' }),
  createPageNode({ pluginId: 'entity', path: '/catalog/:kind/:name' }),
  createPageNode({ pluginId: 'hidden-tech', disabled: true }),
];

const appTreeApi = {
  getTree: () => ({
    tree: {
      nodes: new Map([
        [
          'app/routes',
          {
            edges: {
              attachments: new Map([['routes', pages.map(p => p.node)]]),
            },
          },
        ],
      ]),
    },
  }),
} as unknown as AppTreeApi;

const routeResolutionApi = {
  resolve: (routeRef: unknown) => {
    if (routeRef === rootRouteRef) return () => '/search';
    const page = pages.find(p => p.routeRef === routeRef);
    return page && (() => page.path);
  },
} as unknown as RouteResolutionApi;

describe('findAppPages', () => {
  it('matches and ranks linkable app pages', () => {
    const find = (term: string) =>
      findAppPages({ appTreeApi, routeResolutionApi, term }).map(
        page => `${page.title} ${page.location}`,
      );

    // Disabled pages and routes with parameters are skipped
    expect(find(' TECH ')).toEqual(['Docs /docs', 'Tech Radar /tech-radar']);
    // Exact title matches rank first
    expect(find('docs')).toEqual(['Docs /docs']);
    expect(find('catalog')).toEqual(['Catalog /catalog']);
    expect(find('')).toEqual([]);
    expect(find('nothing-matches')).toEqual([]);
  });
});

describe('AppPageResults', () => {
  const toggleModal = jest.fn();
  // The backend never responds, so any results shown come from the app
  const searchApi = {
    query: jest.fn(() => new Promise<SearchResultSet>(() => {})),
  };

  const renderModal = (
    options: { includeAppPages?: boolean; types?: string[] } = {},
  ) =>
    renderInTestApp(
      <ApiProvider
        apis={TestApiRegistry.from(
          [configApiRef, new ConfigReader({})],
          [searchApiRef, searchApi],
          [appTreeApiRef, appTreeApi],
          [routeResolutionApiRef, routeResolutionApi],
        )}
      >
        <SearchContextProvider
          initialState={{
            term: 'tech',
            types: options.types ?? [],
            filters: {},
          }}
        >
          <SearchModal
            open
            toggleModal={toggleModal}
            includeAppPages={options.includeAppPages}
          />
        </SearchContextProvider>
      </ApiProvider>,
      { mountedRoutes: { '/search': rootRouteRef } },
    );

  it('lists matching pages without waiting for the search backend', async () => {
    await renderModal({ includeAppPages: true });

    expect(await screen.findByRole('list', { name: 'Pages' })).toBeVisible();
    const link = screen.getByRole('link', { name: 'Tech Radar' });
    expect(link).toHaveAttribute('href', '/tech-radar');
    expect(screen.getByRole('link', { name: 'Docs' })).toBeVisible();
  });

  it('lists no pages unless enabled and unfiltered', async () => {
    const { unmount } = await renderModal();
    expect(screen.queryByRole('list', { name: 'Pages' })).toBeNull();
    unmount();

    await renderModal({ includeAppPages: true, types: ['techdocs'] });
    expect(screen.queryByRole('list', { name: 'Pages' })).toBeNull();
  });
});
