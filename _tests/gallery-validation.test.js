const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { validateGallery } = require("../scripts/validate-gallery.js");

const imageCommand = spawnSync("magick", ["-version"]).status === 0 ? "magick" : "convert";

function command(root, executable, args) {
  const result = spawnSync(executable, args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  return result.stdout;
}

function fixture(t, includeValidator = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gallery-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  command(root, "git", ["init", "-q", "-b", "main"]);
  command(root, "git", ["config", "user.name", "Gallery Test"]);
  command(root, "git", ["config", "user.email", "gallery@example.invalid"]);
  const file = "assets/website/2023/05/IMG_OLD.jpg";
  image(root, file, "100x75");
  const gallery = {
    albums: [{
      key: "2023-04-01", date: "2023-04-01", year: "2023", title: "April 2023",
      description: "Legacy album", photos: [photo(file, { width: 100, height: 75 })],
    }],
  };
  save(root, gallery);
  if (includeValidator) {
    fs.mkdirSync(path.join(root, "scripts"));
    fs.copyFileSync(path.resolve(__dirname, "../scripts/validate-gallery.js"), path.join(root, "scripts/validate-gallery.js"));
  }
  command(root, "git", ["add", "."]);
  command(root, "git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "commit", "-qm", "Baseline"]);
  command(root, "git", ["checkout", "-qb", "photos"]);
  return { root, gallery };
}

function image(root, file, size) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  command(root, imageCommand, ["-size", size, "xc:green", path.join(root, file)]);
}

function photo(file, dimensions = {}) {
  return { thumb: `/${file}`, full: `/${file}`, alt: "Volunteers planting", caption: "", ...dimensions };
}

function save(root, gallery) {
  fs.mkdirSync(path.join(root, "_data"), { recursive: true });
  fs.writeFileSync(path.join(root, "_data/gallery.json"), `${JSON.stringify(gallery, null, 2)}\n`);
}

function add(root, gallery, file = "assets/website/work-party-2026-11-21/planting.jpg", size = "2048x1536", dimensions = {}) {
  image(root, file, size);
  gallery.albums.unshift({
    key: "2026-11-21", date: "2026-11-21", year: "2026", title: "November work party",
    description: "Planting shrubs", photos: [photo(file, dimensions)],
  });
  save(root, gallery);
  return file;
}

test("unchanged legacy photos are accepted without rewriting files", (t) => {
  const { root } = fixture(t);
  const before = fs.readFileSync(path.join(root, "_data/gallery.json"));
  assert.deepEqual(validateGallery({ root, repair: true }), { addedPhotos: 0, repairedFiles: [] });
  assert.deepEqual(fs.readFileSync(path.join(root, "_data/gallery.json")), before);
});

test("new photos can use existing folders or either standard new folder", (t) => {
  for (const folder of ["assets/website/2023/05", "assets/website/work-party-2026-11-21", "assets/website/2026/11/work-party-2026-11-21"]) {
    const { root, gallery } = fixture(t);
    add(root, gallery, `${folder}/planting.jpg`, "100x75", { width: 100, height: 75 });
    assert.equal(validateGallery({ root }).addedPhotos, 1);
    command(root, "git", ["add", "."]);
    assert.equal(validateGallery({ root }).addedPhotos, 1);
    command(root, "git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "commit", "-qm", "Photos"]);
    assert.equal(validateGallery({ root }).addedPhotos, 1);
  }
});

test("invalid names, folders, and unregistered photos give friendly errors", (t) => {
  for (const [file, expected] of [
    ["assets/website/work-party-2026-11-21/IMG_BAD.jpg", /lowercase hyphen-separated/],
    ["assets/website/work-party-2026-02-30/planting.jpg", /existing gallery folder/],
    ["assets/website/2025/11/work-party-2026-11-21/planting.jpg", /existing gallery folder/],
    ["assets/website/random/planting.jpg", /existing gallery folder/],
    ["assets/website/work-party-2026-11-21/planting.gif", /\.jpg, .jpeg, .png, or .webp/],
  ]) {
    const { root, gallery } = fixture(t);
    add(root, gallery, file);
    assert.throws(() => validateGallery({ root, repair: true }), expected);
  }
  const { root } = fixture(t);
  image(root, "assets/website/work-party-2026-11-21/forgotten.jpg", "20x20");
  assert.throws(() => validateGallery({ root }), /add this photo to _data\/gallery.json/);
});

test("validation errors prevent all repairs", (t) => {
  const { root, gallery } = fixture(t);
  const file = add(root, gallery);
  image(root, "assets/website/work-party-2026-11-21/forgotten.jpg", "20x20");
  const beforeImage = fs.readFileSync(path.join(root, file));
  const beforeJson = fs.readFileSync(path.join(root, "_data/gallery.json"));
  assert.throws(() => validateGallery({ root, repair: true }), /Photos were not changed/);
  assert.deepEqual(fs.readFileSync(path.join(root, file)), beforeImage);
  assert.deepEqual(fs.readFileSync(path.join(root, "_data/gallery.json")), beforeJson);
});

test("missing dimensions resize real images without cropping or enlargement", (t) => {
  for (const [size, dimensions, expected] of [
    ["2048x1536", {}, [1024, 768]],
    ["1536x2048", { width: 1536 }, [768, 1024]],
    ["2048x1536", { height: 1536 }, [1024, 768]],
    ["200x150", {}, [200, 150]],
  ]) {
    const { root, gallery } = fixture(t);
    const file = add(root, gallery, undefined, size, dimensions);
    const before = fs.readFileSync(path.join(root, file));
    assert.throws(() => validateGallery({ root }), (error) => error.exitCode === 2 && /--repair/.test(error.message));
    assert.deepEqual(fs.readFileSync(path.join(root, file)), before);
    const result = validateGallery({ root, repair: true });
    assert.deepEqual(new Set(result.repairedFiles), new Set([file, "_data/gallery.json"]));
    const updated = JSON.parse(fs.readFileSync(path.join(root, "_data/gallery.json")));
    assert.deepEqual([updated.albums[0].photos[0].width, updated.albums[0].photos[0].height], expected);
    const actual = command(root, imageCommand, [path.join(root, file), "-format", "%w %h", "info:"]);
    assert.equal(actual, expected.join(" "));
    assert.deepEqual(validateGallery({ root, repair: true }).repairedFiles, []);
  }
});

test("invalid supplied dimensions and image contents fail instead of being repaired", (t) => {
  for (const dimensions of [{ width: 1 }, { width: null }, { width: "2048" }, { width: 0 }, { width: 2048, height: 2 }]) {
    const { root, gallery } = fixture(t);
    add(root, gallery, undefined, "2048x1536", dimensions);
    assert.throws(() => validateGallery({ root, repair: true }), /supplied (width|height)/);
  }
  const { root, gallery } = fixture(t);
  const file = add(root, gallery);
  fs.writeFileSync(path.join(root, file), "not a photo");
  assert.throws(() => validateGallery({ root, repair: true }), /failed/);
});

test("PNG and WebP repairs persist dimensions, while valid large photos stay unchanged", (t) => {
  for (const extension of ["png", "webp"]) {
    const { root, gallery } = fixture(t);
    add(root, gallery, `assets/website/work-party-2026-11-21/planting.${extension}`);
    validateGallery({ root, repair: true });
    const entry = JSON.parse(fs.readFileSync(path.join(root, "_data/gallery.json"))).albums[0].photos[0];
    assert.deepEqual([entry.width, entry.height], [1024, 768]);
    assert.doesNotThrow(() => validateGallery({ root }));
  }
  const { root, gallery } = fixture(t);
  const file = add(root, gallery, undefined, "2048x1536", { width: 2048, height: 1536 });
  const before = fs.readFileSync(path.join(root, file));
  assert.deepEqual(validateGallery({ root, repair: true }).repairedFiles, []);
  assert.deepEqual(fs.readFileSync(path.join(root, file)), before);
});

test("mislabeled image contents and dangling unregistered symlinks are rejected", (t) => {
  const { root, gallery } = fixture(t);
  const file = add(root, gallery);
  const png = "assets/website/work-party-2026-11-21/source.png";
  image(root, png, "100x75");
  fs.copyFileSync(path.join(root, png), path.join(root, file));
  fs.unlinkSync(path.join(root, png));
  assert.throws(() => validateGallery({ root, repair: true }), /failed/);
  fs.unlinkSync(path.join(root, file));
  gallery.albums.shift();
  save(root, gallery);
  fs.symlinkSync("missing.jpg", path.join(root, file));
  assert.throws(() => validateGallery({ root }), /add this photo to _data\/gallery.json/);
});

test("missing files, traversal, symlinks, and invalid albums are rejected", (t) => {
  for (const [alteration, expected] of [
    [(root, gallery, file) => fs.unlinkSync(path.join(root, file)), /ENOENT/],
    [(root, gallery) => { gallery.albums[0].photos[0].full = "/assets/website/../escape.jpg"; }, /Unsafe path/],
    [(root, gallery, file) => {
      fs.unlinkSync(path.join(root, file));
      fs.symlinkSync(path.join(root, "assets/website/2023/05/IMG_OLD.jpg"), path.join(root, file));
    }, /Symlinks/],
    [(root, gallery) => { gallery.albums[0].date = "2026-02-30"; }, /real YYYY-MM-DD date/],
    [(root, gallery) => { gallery.albums[0].year = 2026; }, /year as a string/],
    [(root, gallery) => { gallery.albums[0].photos[0].alt = ""; }, /descriptive alt text/],
    [(root, gallery) => { gallery.albums.reverse(); }, /newest-first/],
    [(root, gallery) => { gallery.albums.push(gallery.albums[0]); }, /duplicate album key/],
  ]) {
    const { root, gallery } = fixture(t);
    const file = add(root, gallery);
    alteration(root, gallery, file);
    save(root, gallery);
    assert.throws(() => validateGallery({ root, repair: true }), expected);
  }
});

test("shared photo paths resize once and update all dependent entries", (t) => {
  const { root, gallery } = fixture(t);
  const file = add(root, gallery);
  gallery.albums[0].photos.push(photo(file, { width: 2048, height: 1536 }));
  save(root, gallery);
  assert.equal(validateGallery({ root, repair: true }).repairedFiles.length, 2);
  const updated = JSON.parse(fs.readFileSync(path.join(root, "_data/gallery.json")));
  for (const entry of updated.albums[0].photos) {
    assert.equal(entry.width, 1024);
    assert.equal(entry.height, 768);
  }
  assert.doesNotThrow(() => validateGallery({ root }));
});

test("incompatible thumbnail and full images fail before either file changes", (t) => {
  const { root, gallery } = fixture(t);
  const full = add(root, gallery);
  const thumb = "assets/website/work-party-2026-11-21/thumbnail.jpg";
  image(root, thumb, "100x100");
  gallery.albums[0].photos[0].thumb = `/${thumb}`;
  save(root, gallery);
  const before = [full, thumb, "_data/gallery.json"].map((file) => fs.readFileSync(path.join(root, file)));
  assert.throws(() => validateGallery({ root }), (error) => error.exitCode !== 2 && /same saved dimensions/.test(error.message));
  assert.throws(() => validateGallery({ root, repair: true }), /same saved dimensions/);
  [full, thumb, "_data/gallery.json"].forEach((file, index) => {
    assert.deepEqual(fs.readFileSync(path.join(root, file)), before[index]);
  });
});

test("orientation is applied before resizing and saving dimensions", (t) => {
  const { root, gallery } = fixture(t);
  const file = add(root, gallery, undefined, "2048x1536");
  const jpeg = fs.readFileSync(path.join(root, file));
  // Minimal EXIF header: orientation 6 rotates the landscape image clockwise.
  const exif = Buffer.from("45786966000049492a0008000000010012010300010000000600000000000000", "hex");
  const marker = Buffer.alloc(4);
  marker.writeUInt16BE(0xffe1);
  marker.writeUInt16BE(exif.length + 2, 2);
  fs.writeFileSync(path.join(root, file), Buffer.concat([jpeg.subarray(0, 2), marker, exif, jpeg.subarray(2)]));
  validateGallery({ root, repair: true });
  const entry = JSON.parse(fs.readFileSync(path.join(root, "_data/gallery.json"))).albums[0].photos[0];
  assert.deepEqual([entry.width, entry.height], [768, 1024]);
  assert.equal(command(root, imageCommand, [path.join(root, file), "-format", "%w %h", "info:"]), "768 1024");
  assert.doesNotThrow(() => validateGallery({ root }));
});

test("CLI reports repairable dimensions with exit 2 and writes a repair manifest", (t) => {
  const { root, gallery } = fixture(t);
  const file = add(root, gallery);
  const script = path.resolve(__dirname, "../scripts/validate-gallery.js");
  const check = spawnSync(process.execPath, [script, "--base", "main"], { cwd: root, encoding: "utf8" });
  assert.equal(check.status, 2);
  assert.match(check.stderr, /Run node scripts\/validate-gallery.js --repair/);
  const report = path.join(root, "report.json");
  command(root, process.execPath, [script, "--base", "main", "--repair", "--report", report]);
  assert.deepEqual(new Set(JSON.parse(fs.readFileSync(report)).repairedFiles), new Set([file, "_data/gallery.json"]));
});

function workflowStep(name) {
  const workflow = fs.readFileSync(path.resolve(__dirname, "../.github/workflows/validate-gallery.yml"), "utf8");
  const section = workflow.split(`      - name: ${name}\n`)[1];
  assert.ok(section, `Missing workflow step: ${name}`);
  const body = section.split("        run: |\n")[1];
  const lines = [];
  for (const line of body.split("\n")) {
    if (line && !line.startsWith("          ")) break;
    lines.push(line.slice(10));
  }
  return lines.join("\n");
}

function workflowEnvironment(root) {
  const temporary = path.join(root, "runner");
  fs.mkdirSync(temporary);
  return {
    ...process.env,
    BASE_SHA: command(root, "git", ["rev-parse", "main"]).trim(),
    HEAD_SHA: command(root, "git", ["rev-parse", "HEAD"]).trim(),
    HEAD_REF: "photos",
    RUNNER_TEMP: temporary,
    GITHUB_STEP_SUMMARY: path.join(temporary, "summary"),
    GITHUB_OUTPUT: path.join(temporary, "output"),
    SAME_REPOSITORY: "true",
    GH_TOKEN: "unused-local-test-token",
  };
}

function runWorkflow(root, name, env) {
  return spawnSync("bash", ["-e", "-o", "pipefail", "-c", workflowStep(name)], { cwd: root, env, encoding: "utf8" });
}

test("workflow repairs with base code and pushes only repaired files to the PR branch", (t) => {
  const { root, gallery } = fixture(t, true);
  const file = add(root, gallery);
  fs.writeFileSync(path.join(root, "scripts/validate-gallery.js"), 'throw new Error("Do not execute PR code in the repair job");\n');
  command(root, "git", ["add", "."]);
  command(root, "git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "commit", "-qm", "New photos and untrusted script"]);
  const remote = path.join(root, "remote.git");
  command(root, "git", ["init", "--bare", "-q", remote]);
  command(root, "git", ["remote", "add", "origin", remote]);
  command(root, "git", ["push", "-q", "origin", "HEAD:refs/heads/photos"]);
  const env = workflowEnvironment(root);
  for (const name of ["Validate new photos", "Repair and recheck photos with trusted code", "Commit and push only repaired files"]) {
    const result = runWorkflow(root, name, env);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  }
  assert.match(fs.readFileSync(env.GITHUB_OUTPUT, "utf8"), /repair=true/);
  const head = command(root, "git", ["rev-parse", "HEAD"]).trim();
  assert.notEqual(head, env.HEAD_SHA);
  assert.equal(command(root, "git", ["--git-dir", remote, "rev-parse", "refs/heads/photos"]).trim(), head);
  assert.deepEqual(new Set(command(root, "git", ["diff", "--name-only", env.HEAD_SHA, head]).trim().split("\n")), new Set([file, "_data/gallery.json"]));
  const published = JSON.parse(command(root, "git", ["--git-dir", remote, "show", "refs/heads/photos:_data/gallery.json"]));
  assert.deepEqual([published.albums[0].photos[0].width, published.albums[0].photos[0].height], [1024, 768]);
  assert.match(command(root, "git", ["log", "-1", "--format=%B"]), /Co-authored-by: Copilot App/);
});

test("workflow gives fork and initial-rollout repair instructions without writing photos", (t) => {
  for (const includeValidator of [false, true]) {
    const { root, gallery } = fixture(t, includeValidator);
    const file = add(root, gallery);
    // Initial rollout needs a PR copy of the script for read-only validation.
    if (!includeValidator) {
      fs.mkdirSync(path.join(root, "scripts"));
      fs.copyFileSync(path.resolve(__dirname, "../scripts/validate-gallery.js"), path.join(root, "scripts/validate-gallery.js"));
    }
    const env = workflowEnvironment(root);
    env.SAME_REPOSITORY = "false";
    const before = fs.readFileSync(path.join(root, file));
    const result = runWorkflow(root, "Validate new photos", env);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Fork pull requests cannot receive automatic repair commits/);
    assert.deepEqual(fs.readFileSync(path.join(root, file)), before);
    if (!includeValidator) {
      const repair = runWorkflow(root, "Repair and recheck photos with trusted code", env);
      assert.equal(repair.status, 1);
      assert.match(repair.stdout, /not available until the validator is on the base branch/);
      assert.deepEqual(fs.readFileSync(path.join(root, file)), before);
    }
  }
});
