---
'@backstage/plugin-search': minor
---

Search can now list pages installed in the app above the search results, so users can jump straight to a plugin or page. The pages are found in the browser and show up as you type, without waiting for the search backend. This is opt-in and only works in apps using the new frontend system.

To enable it on the search page, set `includeAppPages` on the search page extension:

```yaml
app:
  extensions:
    - page:search:
        config:
          includeAppPages: true
```

To enable it in the search modal, pass the new `includeAppPages` prop to `SidebarSearchModal` or `SearchModal`.
