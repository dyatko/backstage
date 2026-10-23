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

import { useApiHolder } from '@backstage/core-plugin-api';
import { useTranslationRef } from '@backstage/core-plugin-api/alpha';
import {
  appTreeApiRef,
  routeResolutionApiRef,
} from '@backstage/frontend-plugin-api';
import {
  DefaultResultListItem,
  useSearch,
} from '@backstage/plugin-search-react';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListSubheader from '@material-ui/core/ListSubheader';
import { useMemo } from 'react';

import { searchTranslationRef } from '../../translation';
import { findAppPages } from './findAppPages';

/**
 * Lists pages installed in the app that match the current search term. The
 * pages are found client-side, so they show up without waiting for the search
 * backend. Renders nothing in apps that don't use the new frontend system.
 */
export const AppPageResults = (props: { onClick?: () => void }) => {
  const apis = useApiHolder();
  const appTreeApi = apis.get(appTreeApiRef);
  const routeResolutionApi = apis.get(routeResolutionApiRef);
  const { term, types, pageCursor } = useSearch();
  const { t } = useTranslationRef(searchTranslationRef);

  const pages = useMemo(() => {
    // Only on the first page of unfiltered results
    if (!appTreeApi || !routeResolutionApi || types.length || pageCursor) {
      return [];
    }
    return findAppPages({ appTreeApi, routeResolutionApi, term });
  }, [appTreeApi, routeResolutionApi, term, types, pageCursor]);

  if (!pages.length) {
    return null;
  }

  return (
    <List
      aria-label={t('appPageResults.title')}
      subheader={
        <ListSubheader disableSticky>{t('appPageResults.title')}</ListSubheader>
      }
    >
      {pages.map(page => (
        <ListItem
          key={page.location}
          alignItems="flex-start"
          divider
          onClick={props.onClick}
        >
          <DefaultResultListItem
            icon={page.icon}
            result={{
              title: page.title,
              text: page.parentTitle ?? '',
              location: page.location,
            }}
          />
        </ListItem>
      ))}
    </List>
  );
};
