# Jericho Stewardship Group

A Jekyll recreation of the Jericho Stewardship Group website, published with GitHub Pages.

## Files

- `index.md` contains the homepage.
- The other root-level Markdown files contain the site pages.
- `_posts/` contains dated blog posts in Markdown.
- `_layouts/` contains the shared site template.
- `_includes/` contains the newsletter and contact forms and blog index.
- `_data/gallery.json` contains the photo album and caption data used by the Gallery page.
- `assets/website/` contains the local images and documents from the source site.
- `favicon.ico` contains the site favicon.
- `styles.css` contains the responsive site styles.
- `assets/site.js` enhances plant galleries, director cards, and the Gallery photo viewer. It opens external web links in new tabs.
- `_config.yml` contains the Jekyll and GitHub Pages settings.

Edit the relevant Markdown file to update page content. Each page has YAML front matter with a title and permalink. Add blog posts as `_posts/YYYY-MM-DD-title.md`.

Give Markdown images their intrinsic dimensions, for example `![Description](/image.jpg){: width="300" height="200" }`. For gallery photos, `width` and `height` in `_data/gallery.json` are optional but recommended to help the browser reserve space before images load. If supplied, they must match both the thumbnail and full-size image dimensions. A page with a `hero_image` also needs `hero_image_width` and `hero_image_height` in its front matter.

## Add work-party photos to the gallery

Each work party has its own album (an expandable section) on the Gallery page. Add the photos and one album entry; no changes to `gallery.md` are needed.

### Normal usage

Use GitHub in a web browser to add photos and ask a maintainer to publish them. You need a GitHub account, but you do not need to install or run the site.

1. Prepare the photos on your computer. Rotate or resize them as needed, and put them in a folder with a unique name, such as `work-party-2026-11-21`. Give each photo a simple filename, such as `planting.jpg`. GitHub allows up to 100 files per upload and 25 MiB per file in the browser.
2. Sign in to GitHub and open the [website repository](https://github.com/jericho-stewardship-group/jericho-stewardship-group.github.io). If you cannot create a branch in the repository, use **Fork** to create your own copy and complete the following steps in that copy. If you already have a fork, use **Sync fork** first to bring it up to date.
3. Use the branch selector (which says **main**) to create a new branch named for the work party, such as `work-party-2026-11-21`. Select that branch for all the following changes. A branch keeps the changes separate from the published site.
4. Open `assets`, then `website`. Select **Add file** > **Upload files**, and drag the photo folder into the upload area. Check that the folder name and filenames are correct. Add a short message such as `Add work party photos` and commit the files to your new branch, not `main`. If you have more than 100 photos, repeat the upload on the same branch.
5. On the same branch, open `_data/gallery.json` and select the pencil icon to edit it. Find `"albums": [` near the top. Paste the example below immediately after that line, before the existing first album. Replace the date, title, description, folder name, filenames, descriptions, and captions with your own. The first photo is the cover. For more photos, copy a photo object and separate it from the previous one with a comma. Keep the comma after the new album to separate it from the existing album.

   ```json
   {
     "key": "2026-11-21",
     "date": "2026-11-21",
     "title": "November 21, 2026 work party",
     "year": "2026",
     "description": "Removing ivy and planting native shrubs.",
     "photos": [
       {
         "thumb": "/assets/website/work-party-2026-11-21/planting.jpg",
         "full": "/assets/website/work-party-2026-11-21/planting.jpg",
         "alt": "Volunteers planting shrubs beside a park path",
         "caption": "Planting native shrubs."
       },
       {
         "thumb": "/assets/website/work-party-2026-11-21/ivy.jpg",
         "full": "/assets/website/work-party-2026-11-21/ivy.jpg",
         "alt": "Volunteers removing ivy from a tree",
         "caption": "Removing ivy."
       }
     ]
   },
   ```

   Use the work-party date in `YYYY-MM-DD` format for both `key` and `date`, and use the year as a string. Each `thumb` and `full` path must match an uploaded file exactly; both can point to the same photo. Describe each image in `alt`; use `""` if you do not want a visible caption. Image `width` and `height` are optional but recommended. If included, use the actual saved photo dimensions in pixels. Put a backslash before any double quote within your text, for example `\"`.

   Keep albums in newest-first date order. For an older event, insert the new album before the first album with an earlier date. If it belongs at the very end, add a comma after the previous album and remove the comma after the new one.
6. Select **Commit changes** and commit the edit to the same branch as the photos. Check that the branch contains both the uploaded photos and the gallery edit.
7. Open a pull request from your branch to `main` in the website repository. Select **Compare & pull request**, or go to **Pull requests** > **New pull request** and choose your branch. If you used a fork, select the website repository as the base and your fork and branch as the head. Give the pull request a title and describe the work party, then select **Create pull request**.
8. Send the pull request link to a maintainer and ask them to review and merge it, then check the deployment. Merging into `main` starts the GitHub Pages deployment; the photos are not published just by opening the pull request.

### Advanced usage

Use these steps if you have a local checkout of the repository.

1. Choose the photos to share. Rotate, resize, and compress them before adding them to the repository. Save them with clear filenames in a new folder such as `assets/website/2026/11/work-party-2026-11-21/`.
2. Open `_data/gallery.json`. Add a new object at the start of the `albums` array for the latest work party. Keep all albums in newest-first order by `date`. Use the work-party date in `YYYY-MM-DD` format for both `key` and `date`, and its four-digit year as a string for `year`. Give the album a readable `title` and a short `description` of the work.
3. Add one object to the album's `photos` array for each photo. Use a site-root path starting with `/assets/website/` for `thumb` and `full`. The same image can serve both purposes, as in the example below. The `width` and `height` fields are optional but recommended; if included, use the saved image's actual pixel dimensions, not the original camera image's dimensions. Add descriptive `alt` text and a visible `caption`, or use `""` for no caption. Put the cover photo first.
4. Preview the site with `./scripts/preview.sh` (see [Local preview](#local-preview)). Open <http://localhost:4000/gallery/>. Check the new section, its cover, captions, and year filter. Open each photo and check the full-size viewer and next/previous controls.
5. Include the new image files and `_data/gallery.json` together when publishing the update. The GitHub Pages deployment runs after the changes reach `main`.

Example album object to insert inside the existing `albums` array:

```json
{
  "key": "2026-11-21",
  "date": "2026-11-21",
  "title": "November 21, 2026 work party",
  "year": "2026",
  "description": "Removing ivy and planting native shrubs.",
  "photos": [
    {
      "thumb": "/assets/website/2026/11/work-party-2026-11-21/planting-shrubs.jpg",
      "full": "/assets/website/2026/11/work-party-2026-11-21/planting-shrubs.jpg",
      "alt": "Volunteers planting native shrubs beside a park path",
      "caption": "Planting native shrubs after clearing ivy.",
      "width": 1024,
      "height": 768
    }
  ]
}
```

Replace the example values with the event details and, if included, the saved photo dimensions. Separate album objects and photo objects with commas, but do not add a trailing comma after the last object. The gallery reads albums in file order, uses the first photo as the cover, and adds the year to the filter automatically.

## Local preview

Install Ruby 3.3 or 3.4 and Bundler.

On macOS with Homebrew:

```bash
brew install ruby@3.3
export PATH="$(brew --prefix ruby@3.3)/bin:$PATH"
gem install bundler -v 2.6.9
```

Add the Ruby `PATH` setting to your shell configuration to use it in new terminals. If development tools are missing, run `xcode-select --install`. On Linux, install Ruby and your distribution's compiler, Ruby development headers, and `make`.

From the repository directory, run:

```bash
./scripts/preview.sh
```

Open <http://localhost:4000> when Jekyll reports that the server is running. Use **HTTP**, not HTTPS. The script installs missing locked GitHub Pages dependencies into `vendor/bundle/` on the first run and reuses them on later runs. It does not change globally installed gems.

Jekyll watches the repository for changes. Refresh the browser to see them. Restart the preview after changing `_config.yml`. Press Ctrl+C to stop the server.

If port 4000 is in use, choose another port:

```bash
PREVIEW_PORT=4001 ./scripts/preview.sh
```

Then open <http://localhost:4001>.

After the preview has installed the dependencies, build without a server:

```bash
BUNDLE_PATH=vendor/bundle bundle exec jekyll build
```

Jekyll writes the generated HTML to `_site/`. The generated site and local dependencies are ignored by Git. Do not edit or commit them.

After installing the Jekyll dependencies, run the site and preview-script checks with Node.js 18 or later:

```bash
node --test _tests/*.test.js
```

## GitHub Pages

Set the repository's Pages source to **GitHub Actions**. The existing `.github/workflows/jekyll-gh-pages.yml` builds and deploys Jekyll after a push to `main`.

The site uses the `github-pages` gem for local compatibility with the deployment environment. Internal links and assets use Jekyll's `relative_url` filter, including for sites with a `baseurl`.
