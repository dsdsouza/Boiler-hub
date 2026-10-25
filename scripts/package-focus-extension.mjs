import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const FILES = ["manifest.json", "background.js", "bridge.js", "rules.mjs", "tabs.mjs", "reminders.mjs", "notifications.js", "imports.mjs", "popup.html", "popup.css", "popup.js", "imports/scan.js", "imports/protocol.js", "icon128.png", "focus.html", "focus.js", "focus.css", "fonts/bebas.woff2", "fonts/inter.woff2", "fonts/mono.woff2"];
const IMPORTS = ["scan.js", "protocol.js"];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** A deterministic, single-folder ZIP with no third-party packaging dependency. */
export function buildArchive(root) {
  const local = [], central = [];
  let offset = 0;
  for (const file of FILES) {
    const bytes = readFileSync(resolve(root, file.startsWith("imports/") ? "browser-helper" : "focus-extension", file.startsWith("imports/") ? file.slice(8) : file));
    // ZIP's stored method is byte-identical across Node/zlib versions. The
    // helper is small; keeping its source uncompressed avoids platform-specific
    // deflate output changing the reviewed download in Linux CI.
    const packed = bytes;
    const name = Buffer.from(file);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0, 8);
    header.writeUInt16LE(33, 12); header.writeUInt32LE(crc32(bytes), 14);
    header.writeUInt32LE(packed.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, packed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(33, 14); entry.writeUInt32LE(crc32(bytes), 16); entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(bytes.length, 24); entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, name); offset += header.length + name.length + packed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(FILES.length, 8); end.writeUInt16LE(FILES.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  mkdirSync(resolve(root, "focus-extension/imports"), { recursive: true });
  for (const file of IMPORTS) copyFileSync(resolve(root, "browser-helper", file), resolve(root, "focus-extension/imports", file));
  const target = resolve(root, "public/downloads/boilerplate-focus-extension.zip");
  mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, buildArchive(root));
  process.stdout.write("Packaged public/downloads/boilerplate-focus-extension.zip\n");
}
