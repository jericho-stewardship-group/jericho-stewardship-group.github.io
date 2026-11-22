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
- `styles.css` contains the responsive site styles.
- `assets/site.js` enhances plant galleries, director cards, and the Gallery photo viewer. It opens external web links in new tabs.
- `_config.yml` contains the Jekyll and GitHub Pages settings.

Edit the relevant Markdown file to update page content. Each page has YAML front matter with a title and permalink. Add blog posts as `_posts/YYYY-MM-DD-title.md`.

Give Markdown images their intrinsic dimensions, for example `![Description](/image.jpg){: width="300" height="200" }`. Gallery photos use `width` and `height` in `_data/gallery.json`; the thumbnail and full-size image must have those same dimensions. A page with a `hero_image` also needs `hero_image_width` and `hero_image_height` in its front matter.

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

Run the link behavior and preview-script checks with Node.js 18 or later:

```bash
node --test _tests/*.test.js
```

## GitHub Pages

Set the repository's Pages source to **GitHub Actions**. The existing `.github/workflows/jekyll-gh-pages.yml` builds and deploys Jekyll after a push to `main`.

The site uses the `github-pages` gem for local compatibility with the deployment environment. Internal links and assets use Jekyll's `relative_url` filter, including for sites with a `baseurl`.
