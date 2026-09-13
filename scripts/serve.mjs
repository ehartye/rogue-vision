import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (path === "/") {
      res.writeHead(302, { Location: "/rogue-vision/" });
      res.end();
      return;
    }
    if (!path.startsWith("/rogue-vision/")) throw Error("outside app");
    path = path.slice("/rogue-vision/".length) || "index.html";
    const file = resolve(root, path);
    if (!file.startsWith(root + sep)) throw Error("outside root");
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(4173, "127.0.0.1", () =>
  console.log("FOGFALL preview: http://127.0.0.1:4173/rogue-vision/"),
);
