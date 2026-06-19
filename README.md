# FileManager Pagination

A FeatherPanel v2 plugin that replaces the 250-file hard limit in the file manager with configurable pagination. Files are fetched from the Wings daemon with no artificial cap and split across pages.

## Features

- Removes the 250-file ceiling — lists everything Wings has
- Configurable page size: 10–500 items per page (default: 50)
- Page number buttons with smart windowing (no dropdown, just click)
- First / Previous / Next / Last icon buttons
- Shows current range out of total ("Showing 1–50 of 247")
- Works with all existing file operations: upload, delete, rename, move, copy, compress, search, etc.
- Survives SPA navigation — switch between Console and Files without refresh
- Light and dark mode — picks up FeatherPanel's theme automatically
- No core file modifications

![FileManager Pagination](pagination.png)

## Requirements

- FeatherPanel v2.x
- PHP 8.1+
- JSON PHP extension (php-ext=json)

## Installation

1. Download the `.fpa` file from the [Releases](https://github.com/ArchiveTanvir/FileManagerPagination/releases) page.
2. Go to **Admin Area** → **Plugins** → **Upload Plugin** and upload the `.fpa`.
3. Enable the plugin from the Plugins list.
4. Click **Settings** next to the plugin and set your preferred page size.

### Manual installation

Extract the `.fpa` (it's a ZIP) into FeatherPanel's `plugins/` directory and rename the folder to `filemanagerpagination`. Then enable it from the admin panel.

## Configuration

| Setting | Default | Range | Description |
|---|---|---|---|
| Files per page | 50 | 10–500 | How many files or folders to show on each page |

The setting is in **Admin Area** → **Plugins** → **FileManager Pagination** → **Configure**.

## How it works

1. A new API endpoint — `GET /api/user/servers/{uuidShort}/files/paginated` — fetches the full directory listing from the Wings daemon (no 250 cap) and returns a sliced page.
2. The plugin's frontend JavaScript patches `XMLHttpRequest.prototype.open` to intercept file listing requests and rewrite them to the paginated endpoint with the current page and path.
3. A pagination bar is injected below the file list. It's rebuilt automatically when the page changes or when React re-renders the file manager (SPA navigation, directory change, etc.).

The backend controller mirrors FeatherPanel's own `ServerFilesController` — same auth checks, same Wings API calls — but without the `array_slice($contents, 0, 250)` truncation.

## Versioning

This project uses [SemVer](https://semver.org/). Versions are tagged in Git and published as GitHub Releases.

Given a version `MAJOR.MINOR.PATCH`:

- **MAJOR** — breaking changes to the plugin API or storage format
- **MINOR** — new features or endpoints, backward compatible
- **PATCH** — bug fixes and small tweaks, backward compatible

## Changelog

### 1.0.0 (2026-06-19)

- Initial release
- Pagination controls injected into the file manager
- Configurable page size via plugin settings
- XHR interception for seamless integration
- SPA navigation support (pushState, popstate, polling)
- Dark mode support

## Building from source

```bash
cd FileManagerPagination
zip -r FileManagerPagination.fpa . \
  -x '*/node_modules/*' \
  -x '/demo/*' \
  -x 'banner.png' \
  -x 'README.md' \
  -x '.git/*' \
  -x '.github/*' \
  -x 'build-release.sh'
```

The `.featherexport` file in the root defines the same exclusions for FeatherPanel's export tool.

## Updating

Watch the [Releases](https://github.com/ArchiveTanvir/FileManagerPagination/releases) page or use the FeatherPanel admin panel's addon update check (if available). To update:

1. Download the new `.fpa`.
2. Upload it via **Admin Area** → **Plugins** → **Upload Plugin** (overwrites the previous version).
3. Settings are preserved in the database.

## License

AGPL-3.0
