const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "../assets/site.js"), "utf8");
const baseUrl = "https://jericho.example/native-plants/";

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
