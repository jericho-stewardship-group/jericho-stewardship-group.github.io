#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const galleryPath = "_data/gallery.json";
const imageExtension = /\.(?:jpe?g|png|webp|gif|heic|heif|tiff?|bmp|avif|svg|raw|cr[23]|nef|arw|dng|psd|ico|jxl)$/i;
const filenamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpg|jpeg|png|webp)$/;
const imageFormats = { ".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP" };

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed: ${result.error?.message || result.stderr.trim()}`);
  }
  return result.stdout;
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function safeFile(root, relative) {
  if (!/^[A-Za-z0-9_./-]+$/.test(relative) ||
      relative.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Unsafe path "${relative}". Use a plain repository-relative file path.`);
  }
  let current = root;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`Symlinks are not allowed: ${relative}`);
    }
  }
  if (!fs.statSync(current).isFile()) throw new Error(`Not a file: ${relative}`);
  return current;
}

function photoPath(value) {
  if (typeof value !== "string" || !value.startsWith("/assets/website/") ||
      !/\.(?:jpe?g|png|webp)$/i.test(value)) {
    throw new Error(`Invalid photo path "${value}". Use /assets/website/... with .jpg, .jpeg, .png, or .webp.`);
  }
  return value.slice(1);
}

function standardFolder(folder, existingFolders) {
  if (existingFolders.has(folder)) return true;
  const match = /^assets\/website\/(?:(\d{4})\/(\d{2})\/)?work-party-(\d{4}-\d{2}-\d{2})$/.exec(folder);
  return Boolean(match && validDate(match[3]) &&
    (!match[1] || (match[1] === match[3].slice(0, 4) && match[2] === match[3].slice(5, 7))));
}

function validateGallery({ root = process.cwd(), base = "main", repair = false, report } = {}) {
  root = path.resolve(root);
  const comparison = run("git", ["merge-base", base, "HEAD"], root).trim();
  const baseGallery = JSON.parse(run("git", ["show", `${comparison}:${galleryPath}`], root));
  const existingFolders = new Set(baseGallery.albums.flatMap((album) =>
    album.photos.flatMap((photo) => [path.posix.dirname(photo.thumb.slice(1)), path.posix.dirname(photo.full.slice(1))])));
  const tracked = run("git", ["diff", "--no-ext-diff", "--no-renames", "--name-only", "-z", comparison, "--", "assets/website"], root);
  const untracked = run("git", ["ls-files", "--others", "--exclude-standard", "-z", "--", "assets/website"], root);
  const changed = new Set((tracked + untracked).split("\0").filter((file) => imageExtension.test(file)));
  const baseFiles = new Set(run("git", ["ls-tree", "-r", "--name-only", "-z", comparison, "--", "assets/website"], root).split("\0"));
  const added = [...changed].filter((file) =>
    !baseFiles.has(file) && fs.lstatSync(path.join(root, file), { throwIfNoEntry: false }));
  const galleryFile = safeFile(root, galleryPath);
  const originalJson = fs.readFileSync(galleryFile, "utf8");
  const gallery = JSON.parse(originalJson);
  if (!Array.isArray(gallery.albums)) throw new Error(`${galleryPath}: "albums" must be an array.`);

  const errors = [];
  const entries = [];
  const registered = new Set();
  const keys = new Set();
  const basePhotos = new Set(baseGallery.albums.flatMap((album) => album.photos.map((photo) => JSON.stringify(photo))));
  const missing = [];
  let imageCommand;
  const imageInfo = new Map();
  function inspect(relative, absolute = safeFile(root, relative)) {
    if (!imageCommand) {
      imageCommand = spawnSync("magick", ["-version"], { encoding: "utf8" }).status === 0 ? "magick" : "convert";
    }
    const expected = imageFormats[path.extname(relative).toLowerCase()];
    const output = run(imageCommand, [
      `${expected}:${absolute}`, "-auto-orient", "-format", "%w %h %m\n", "info:",
    ], root).trim();
    const match = /^(\d+) (\d+) (JPEG|PNG|WEBP)$/.exec(output);
    if (!match || match[3] !== expected || +match[1] < 1 || +match[2] < 1) {
      throw new Error(`${relative}: use a single-frame image whose contents match its extension.`);
    }
    return { width: +match[1], height: +match[2] };
  }

  for (const [index, album] of gallery.albums.entries()) {
    if (!album || typeof album !== "object" || Array.isArray(album)) {
      errors.push(`Album ${index + 1}: must be an object.`);
      continue;
    }
    const label = `Album ${album.key || index + 1}`;
    if (!validDate(album.date) || album.key !== album.date || album.year !== album.date?.slice(0, 4)) {
      errors.push(`${label}: use a real YYYY-MM-DD date, the same key, and its year as a string.`);
    }
    if (keys.has(album.key)) errors.push(`${label}: duplicate album key.`);
    keys.add(album.key);
    if (index && gallery.albums[index - 1]?.date < album.date) errors.push(`${label}: place albums in newest-first order.`);
    for (const field of ["title", "description"]) {
      if (typeof album[field] !== "string" || !album[field].trim()) errors.push(`${label}: provide ${field} text.`);
    }
    if (!Array.isArray(album.photos) || !album.photos.length) {
      errors.push(`${label}: add at least one photo.`);
      continue;
    }
    for (const [photoIndex, photo] of album.photos.entries()) {
      const context = `${label}, photo ${photoIndex + 1}`;
      if (!photo || typeof photo !== "object" || Array.isArray(photo)) {
        errors.push(`${context}: must be an object.`);
        continue;
      }
      const files = [];
      for (const field of ["thumb", "full"]) {
        try {
          const relative = photoPath(photo[field]);
          registered.add(relative);
          safeFile(root, relative);
          files.push(relative);
        } catch (error) {
          errors.push(`${context}, ${field}: ${error.message}`);
        }
      }
      const affected = !basePhotos.has(JSON.stringify(photo)) || files.some((file) => changed.has(file));
      const entry = { photo, files, context };
      entries.push(entry);
      if (!affected || files.length !== 2) continue;
      for (const field of ["alt", "caption"]) {
        if (typeof photo[field] !== "string" || (field === "alt" && !photo[field].trim())) {
          errors.push(`${context}: provide ${field === "alt" ? "descriptive alt text" : 'a caption string ("" is allowed)'}.`);
        }
      }
      for (const file of new Set(files)) {
        if (!imageInfo.has(file)) {
          try {
            imageInfo.set(file, inspect(file));
          } catch (error) {
            errors.push(`${context}: ${error.message}`);
          }
        }
      }
      for (const field of ["width", "height"]) {
        if (photo[field] !== undefined &&
            (!Number.isInteger(photo[field]) || photo[field] <= 0 ||
             files.some((file) => imageInfo.has(file) && imageInfo.get(file)[field] !== photo[field]))) {
          errors.push(`${context}: supplied ${field} must be a positive integer matching both saved images.`);
        }
      }
      if (photo.width === undefined || photo.height === undefined) missing.push(entry);
    }
  }
  for (const file of added) {
    if (!filenamePattern.test(path.posix.basename(file))) errors.push(`${file}: use a lowercase hyphen-separated filename and .jpg, .jpeg, .png, or .webp.`);
    if (!standardFolder(path.posix.dirname(file), existingFolders)) errors.push(`${file}: use an existing gallery folder or a work-party-YYYY-MM-DD folder under assets/website/ (optionally YYYY/MM/).`);
    if (!registered.has(file)) errors.push(`${file}: add this photo to ${galleryPath} as thumb or full.`);
  }
  if (errors.length) throw new Error(`Photos were not changed. Fix these issues:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  const repairedFiles = new Set();
  if (missing.length) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "gallery-repair-"));
    try {
      const pending = new Map();
      for (const entry of missing) {
        for (const file of new Set(entry.files)) {
          if (pending.has(file)) continue;
          const target = path.join(temporary, `${pending.size}${path.extname(file).toLowerCase()}`);
          const format = imageFormats[path.extname(file).toLowerCase()];
          run(imageCommand, [`${format}:${safeFile(root, file)}`, "-auto-orient", "-resize", "1024x1024>", target], root);
          pending.set(file, { target, dimensions: inspect(file, target) });
        }
      }
      for (const entry of entries.filter((entry) => entry.files.some((file) => pending.has(file)))) {
        const sizes = entry.files.map((file) => pending.get(file)?.dimensions || imageInfo.get(file) || inspect(file));
        if (sizes.some((size) => size.width !== sizes[0].width || size.height !== sizes[0].height)) {
          throw new Error(`${entry.context}: thumbnail and full image must have the same saved dimensions. Photos were not changed.`);
        }
        entry.photo.width = sizes[0].width;
        entry.photo.height = sizes[0].height;
      }
      if (!repair) {
        const error = new Error(`Missing dimensions in ${missing.map((entry) => entry.context).join("; ")}.\nRun node scripts/validate-gallery.js --repair --base ${base}, then commit the photos and ${galleryPath}.`);
        error.exitCode = 2;
        throw error;
      }
      const updatedJson = `${JSON.stringify(gallery, null, 2)}\n`;
      // Keep originals available so a failed replacement can be rolled back.
      const backups = new Map([...pending.keys()].map((file) => [file, fs.readFileSync(safeFile(root, file))]));
      try {
        for (const [file, { target }] of pending) {
          fs.copyFileSync(target, safeFile(root, file));
          repairedFiles.add(file);
        }
        fs.writeFileSync(galleryFile, updatedJson);
        repairedFiles.add(galleryPath);
      } catch (error) {
        for (const [file, contents] of backups) fs.writeFileSync(path.join(root, file), contents);
        fs.writeFileSync(galleryFile, originalJson);
        throw error;
      }
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
  const result = { repairedFiles: [...repairedFiles], addedPhotos: added.length };
  if (report) fs.writeFileSync(report, JSON.stringify(result));
  return result;
}

if (require.main === module) {
  try {
    const options = {};
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index++) {
      if (args[index] === "--repair") options.repair = true;
      else if (["--base", "--report"].includes(args[index]) && args[index + 1]) options[args[index].slice(2)] = args[++index];
      else throw new Error("Usage: node scripts/validate-gallery.js [--base REVISION] [--repair] [--report FILE]");
    }
    const result = validateGallery(options);
    console.log(`Gallery photos are valid. ${result.addedPhotos} new photo(s); ${result.repairedFiles.length} repaired file(s).`);
  } catch (error) {
    console.error(`Gallery photo check failed:\n${error.message}`);
    process.exitCode = error.exitCode || 1;
  }
}

module.exports = { validateGallery };
