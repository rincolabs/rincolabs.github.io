#!/usr/bin/env node
// Build the served site into dist/ with minified CSS and JS.
// Only files that should be published to the prod branch are copied.

import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transform as transformCss, browserslistToTargets } from "lightningcss";
import { transform as transformJs } from "esbuild";
import { minify as minifyHtml } from "html-minifier-terser";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

// Files/dirs copied verbatim (relative to root), preserving structure.
// CNAME is versioned on main (source of truth for the custom domain) and copied
// so GitHub Pages keeps rincolabs.org on the served prod branch.
const copyPaths = [
  "assets/images",
  "robots.txt",
  "sitemap.xml",
  "CNAME",
];

// HTML files that get minified (paths relative to root, preserved in dist/).
const htmlPaths = ["index.html", "projects/hazor-studio/index.html"];

// Modern-browser targets for lightningcss (Chrome/Firefox/Safari/Edge, recent).
const cssTargets = browserslistToTargets([
  "last 2 Chrome versions",
  "last 2 Firefox versions",
  "last 2 Safari versions",
  "last 2 Edge versions",
]);

const kb = (n) => `${(n / 1024).toFixed(1)}K`;

async function copyStatic() {
  for (const rel of copyPaths) {
    const src = join(root, rel);
    if (!existsSync(src)) {
      throw new Error(`Missing expected path: ${rel}`);
    }
    const dest = join(dist, rel);
    await mkdir(dirname(dest), { recursive: true });
    await cp(src, dest, { recursive: true });
  }
}

async function buildCss() {
  const relIn = "assets/css/styles.css";
  const src = join(root, relIn);
  const source = await readFile(src);
  const { code } = transformCss({
    filename: relIn,
    code: source,
    minify: true,
    targets: cssTargets,
  });
  const dest = join(dist, relIn);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, code);
  console.log(`  CSS  ${kb(source.length)} -> ${kb(code.length)}`);
}

async function buildJs() {
  const relIn = "assets/js/app.js";
  const src = join(root, relIn);
  const source = await readFile(src, "utf8");
  const { code } = await transformJs(source, {
    loader: "js",
    format: "iife", // keep classic script semantics
    minify: true,
    target: ["chrome100", "firefox100", "safari15", "edge100"],
  });
  const dest = join(dist, relIn);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, code);
  console.log(`  JS   ${kb(Buffer.byteLength(source))} -> ${kb(Buffer.byteLength(code))}`);
}

async function buildHtml() {
  for (const rel of htmlPaths) {
    const src = join(root, rel);
    if (!existsSync(src)) {
      throw new Error(`Missing expected path: ${rel}`);
    }
    const source = await readFile(src, "utf8");
    const code = await minifyHtml(source, {
      collapseWhitespace: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: false, // keep application/ld+json intact
      removeStyleLinkTypeAttributes: true,
      minifyCSS: true,
      minifyJS: true,
      useShortDoctype: true,
      sortAttributes: true,
      sortClassName: true,
    });
    const dest = join(dist, rel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, code);
    console.log(
      `  HTML ${kb(Buffer.byteLength(source))} -> ${kb(Buffer.byteLength(code))}  ${rel}`,
    );
  }
}

async function writeExtras() {
  // .nojekyll stops GitHub Pages from running Jekyll over the built assets.
  await writeFile(join(dist, ".nojekyll"), "");
}

async function main() {
  console.log("Building dist/ ...");
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  await copyStatic();
  await buildHtml();
  await buildCss();
  await buildJs();
  await writeExtras();

  console.log(`Done. Output: ${dist}`);
}

main().catch((err) => {
  console.error("Build failed:", err.message);
  process.exit(1);
});
