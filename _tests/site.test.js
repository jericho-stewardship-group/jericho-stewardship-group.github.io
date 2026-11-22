const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "../assets/site.js"), "utf8");
const albums = require("../_data/gallery.json").albums;
const baseUrl = "https://jericho.example/native-plants/";

function buildSite(t) {
  const root = path.resolve(__dirname, "..");
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "jsg-site-test-"));
  t.after(() => fs.rmSync(destination, { recursive: true, force: true }));
  const build = spawnSync("bundle", [
    "exec", "jekyll", "build", "--baseurl", "/preview", "--destination", destination,
  ], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, BUNDLE_PATH: path.join(root, "vendor/bundle"), BUNDLE_FROZEN: "true" },
  });
  assert.equal(build.status, 0, build.error?.message || `${build.stdout}\n${build.stderr}`);
  return destination;
}

function makeLink(href, target = "", relations = []) {
  const url = new URL(href, baseUrl);
  const rels = new Set(relations);
  return {
    protocol: url.protocol,
    origin: url.origin,
    target,
    rels,
    relList: { add: (...tokens) => tokens.forEach((token) => rels.add(token)) },
  };
}

function runSiteScript(links) {
  const document = {
    querySelector: () => null,
    querySelectorAll: (selector) => {
      assert.equal(selector, "a[href]");
      return links;
    },
  };
  vm.runInNewContext(script, { document, window: { location: new URL(baseUrl) } });
}

test("external web links open in new tabs and retain existing relationships", () => {
  const links = [
    makeLink("https://example.org/", "_self", ["nofollow"]),
    makeLink("http://example.org/"),
    makeLink("//example.org/plants"),
    makeLink("https://jericho.example:8443/"),
  ];

  runSiteScript(links);

  for (const link of links) {
    assert.equal(link.target, "_blank");
    assert.ok(link.rels.has("noopener"));
  }
  assert.ok(links[0].rels.has("nofollow"));
});

test("internal and non-web links keep their existing targets", () => {
  const links = [
    makeLink("/volunteer/"),
    makeLink("#main"),
    makeLink("https://jericho.example/gallery/", "_self"),
    makeLink("mailto:jerichostewardship@gmail.com"),
    makeLink("tel:+15555550123"),
  ];

  runSiteScript(links);

  assert.deepEqual(links.map((link) => link.target), ["", "", "_self", "", ""]);
  assert.ok(links.every((link) => link.rels.size === 0));
});

test("gallery viewer updates image dimensions when changing photos", () => {
  const image = {};
  const caption = {};
  const listeners = {};
  const previous = { addEventListener: (event, handler) => { listeners.previous = handler; } };
  const next = { addEventListener: (event, handler) => { listeners.next = handler; } };
  const photos = [
    { dataset: { fullSrc: "/wide.jpg", width: "1200", height: "800", alt: "Wide" } },
    { dataset: { fullSrc: "/tall.jpg", width: "600", height: "900", alt: "Tall" } },
  ];
  const album = { querySelectorAll: () => photos };
  photos.forEach((photo) => { photo.closest = () => album; });
  const list = {
    querySelectorAll: () => [album],
    addEventListener: (event, handler) => { listeners.open = handler; },
  };
  const dialog = {
    querySelector: (selector) => ({
      ".viewer-image": image,
      ".viewer-caption": caption,
      ".viewer-prev": previous,
      ".viewer-next": next,
    })[selector],
    showModal: () => {
      assert.equal(image.width, 1200);
      assert.equal(image.height, 800);
      assert.equal(image.src, "/wide.jpg");
    },
    addEventListener: () => {},
  };
  const document = {
    querySelector: (selector) => ({
      "#album-list": list,
      "#photo-viewer": dialog,
    })[selector] || null,
    querySelectorAll: () => [],
  };
  vm.runInNewContext(script, { document, window: { location: new URL(baseUrl) } });

  listeners.open({ target: { closest: () => photos[0] } });
  listeners.next();

  assert.equal(image.width, 600);
  assert.equal(image.height, 900);
  assert.equal(image.src, "/tall.jpg");
  assert.equal(previous.disabled, false);
  assert.equal(next.disabled, true);
});

test("gallery albums have valid dates in newest-first order", () => {
  for (const [index, album] of albums.entries()) {
    assert.match(album.date, /^\d{4}-\d{2}-\d{2}$/, album.title);
    const date = new Date(`${album.date}T00:00:00Z`);
    assert.ok(Number.isFinite(date.getTime()), album.title);
    assert.equal(date.toISOString().slice(0, 10), album.date, album.title);
    assert.equal(album.key, album.date, album.title);
    assert.equal(album.year, album.date.slice(0, 4), album.title);
    if (index > 0) {
      assert.ok(albums[index - 1].date >= album.date, `${album.title} is out of order`);
    }
  }

  for (const [title, date] of [["May 8, 2022", "2022-05-08"], ["May 9, 2021", "2021-05-09"]]) {
    assert.equal(albums.find((album) => album.title === title)?.date, date);
  }
});

test("gallery photos do not inherit the following album's heading", () => {
  for (const [title, filename] of [
    ["April 2023", "IMG_3085-768x1024.jpg"],
    ["March 2023", "IMG_2950-768x1024.jpg"],
    ["February 2023", "IMG_2844-768x1024.jpg"],
  ]) {
    const photo = albums.find((album) => album.title === title)?.photos.find((item) => item.thumb.endsWith(filename));
    assert.ok(photo, `Missing photo ${filename}`);
    assert.equal(photo.alt, title);
    assert.equal(photo.caption, "");
  }
});

test("rendered gallery names photos distinctly and retains the homepage photos", (t) => {
  const destination = buildSite(t);
  const gallery = fs.readFileSync(path.join(destination, "gallery/index.html"), "utf8");
  const cards = [...gallery.matchAll(/<details class="album-card"[^>]*>([\s\S]*?)<\/details>/g)];
  assert.equal(cards.length, albums.length);

  for (const [index, card] of cards.entries()) {
    const labels = [...card[1].matchAll(/<button class="photo-button"[^>]*\baria-label="([^"]*)"/g)]
      .map((match) => match[1]);
    assert.equal(labels.length, albums[index].photos.length, albums[index].title);
    assert.equal(new Set(labels).size, labels.length, albums[index].title);
    labels.forEach((label, position) => {
      assert.match(label, new RegExp(`^View photo ${position + 1} of ${labels.length}: `));
    });
  }

  const homepage = fs.readFileSync(path.join(destination, "index.html"), "utf8");
  const images = [...homepage.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
  for (const source of [
    "/assets/website/2026/01/jsg-1024x768.jpg",
    "/assets/website/2026/09/IMG_1050-1024x768.jpg",
  ]) {
    const image = images.find((tag) => tag.includes(`/preview${source}`));
    assert.ok(image, `Missing homepage photo ${source}`);
    assert.match(image, /\bwidth="1024"/);
    assert.match(image, /\bheight="768"/);
    assert.match(image, /\balt="[^"]+"/);
    assert.ok(fs.existsSync(path.join(destination, source.slice(1))), `Missing asset ${source}`);
  }
});

test("the favicon is available on site pages under a base URL", (t) => {
  const destination = buildSite(t);

  let faviconUrl;
  for (const page of ["index.html", "wildlife/index.html"]) {
    const html = fs.readFileSync(path.join(destination, page), "utf8");
    const link = html.match(/<link\b(?=[^>]*\brel=["']icon["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
    assert.ok(link, `Missing favicon on ${page}`);
    assert.ok(link[1].startsWith("/preview/"), `Favicon does not use the base URL on ${page}`);
    if (faviconUrl) assert.equal(link[1], faviconUrl);
    faviconUrl = link[1];
  }

  const icon = fs.readFileSync(path.join(destination, faviconUrl.slice("/preview/".length)));
  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  const sizes = new Set(Array.from({ length: icon.readUInt16LE(4) }, (_, index) =>
    `${icon.readUInt8(6 + index * 16)}x${icon.readUInt8(7 + index * 16)}`));
  assert.ok(sizes.has("16x16"));
  assert.ok(sizes.has("32x32"));
});
