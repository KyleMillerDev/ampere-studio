#!/usr/bin/env node
/**
 * Bundles `src/editor-inject/index.ts` into `public/editor/inject.js`.
 * Runs as part of `npm run dev` and `npm run build` so the script is
 * always fresh for the preview iframe.
 */
import { build } from "esbuild"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const isWatch = process.argv.includes("--watch")

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [path.join(root, "src/editor-inject/index.ts")],
  outfile: path.join(root, "public/editor/inject.js"),
  bundle: true,
  format: "iife",
  target: ["es2019"],
  platform: "browser",
  minify: !isWatch,
  sourcemap: isWatch,
  logLevel: "info",
}

if (isWatch) {
  const ctx = await (await import("esbuild")).context(options)
  await ctx.watch()
  console.log("editor-inject: watching for changes")
} else {
  await build(options)
}
