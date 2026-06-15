import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

import lodashGet from "lodash/get"
import {
  Node,
  Project,
  SyntaxKind,
  type JsxAttribute,
  type JsxElement,
  type StringLiteral,
} from "ts-morph"

import type { EditorBlock, EditorWarning } from "@/lib/editor/types"

/**
 * Deterministic block id derived from the attribute and file path. Using
 * a stable hash means rescans of unchanged repos produce identical block
 * ids, which lets the DynamoDB cache round-trip without the UI needing to
 * reconcile ids when a background refresh lands.
 */
function stableBlockId(parts: {
  sourceType: string
  targetId: string
  filePath: string
  order: number
}): string {
  return createHash("sha1")
    .update(
      [parts.sourceType, parts.targetId, parts.filePath, String(parts.order)].join(
        "\u0000"
      )
    )
    .digest("hex")
    .slice(0, 24)
}

const AMPERE_ID_ATTR = "data-ampere-id"
const AMPERE_JSON_ATTR = "data-ampere-json"

/** HTML intrinsic tag names we render as-is in the preview. */
const INTRINSIC_TAGS = new Set([
  "a",
  "abbr",
  "article",
  "aside",
  "b",
  "blockquote",
  "button",
  "caption",
  "div",
  "em",
  "figcaption",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "i",
  "img",
  "label",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
])

export interface ScanResult {
  blocks: EditorBlock[]
  files: string[]
  warnings: EditorWarning[]
}

/**
 * Walk `repoPath` for every JSX file that contains `data-ampere-id` or
 * `data-ampere-json` attributes. Return one `EditorBlock` per match.
 */
export async function scanRepo(repoPath: string): Promise<ScanResult> {
  const blocks: EditorBlock[] = []
  const warnings: EditorWarning[] = []
  const touchedFiles = new Set<string>()
  const jsonCache = new Map<string, unknown>()

  const project = buildProject(repoPath)
  let order = 0

  for (const sf of project.getSourceFiles()) {
    const attrs = sf.getDescendantsOfKind(SyntaxKind.JsxAttribute)
    for (const attr of attrs) {
      const name = attr.getNameNode().getText()
      if (name !== AMPERE_ID_ATTR && name !== AMPERE_JSON_ATTR) continue

      const attrValue = readAttributeStringLiteral(attr)
      if (attrValue === null) {
        warnings.push({
          targetId: "",
          reason: `Non-string ${name} attribute in ${path.relative(repoPath, sf.getFilePath())}`,
        })
        continue
      }

      const opening =
        attr.getFirstAncestorByKind(SyntaxKind.JsxOpeningElement) ??
        attr.getFirstAncestorByKind(SyntaxKind.JsxSelfClosingElement)
      if (!opening) continue

      const jsxTag = opening.getTagNameNode().getText()
      const isSelfClosing = opening.getKind() === SyntaxKind.JsxSelfClosingElement
      const jsxElement = isSelfClosing
        ? null
        : (opening.getParent() as JsxElement | undefined) ?? null

      const classNameAttr = opening.getAttribute("className")
      const classNameValue = Node.isJsxAttribute(classNameAttr)
        ? readAttrStringLiteralOrUndefined(classNameAttr)
        : undefined

      const srcAttr = opening.getAttribute("src")
      const srcValue = Node.isJsxAttribute(srcAttr)
        ? readAttrStringLiteralOrUndefined(srcAttr)
        : undefined

      const sourceType = name === AMPERE_JSON_ATTR ? "json" : "inline"
      const relFile = path.relative(repoPath, sf.getFilePath()).replace(/\\/g, "/")
      touchedFiles.add(relFile)

      if (sourceType === "inline") {
        const inferredType = inferInlineBlockType(jsxTag, Boolean(srcValue))

        if (inferredType === "image") {
          blocks.push({
            blockId: stableBlockId({
              sourceType: "inline",
              targetId: attrValue,
              filePath: relFile,
              order,
            }),
            targetId: attrValue,
            sourceType: "inline",
            type: "image",
            jsxTag,
            initialValue: srcValue ?? "",
            initialSrc: srcValue,
            classNameValue,
            filePath: relFile,
            order: order++,
          })
          continue
        }

        // Only emit text blocks when the element's children are pure text.
        // Sections, divs, or custom components with nested markup are silently
        // skipped: we only want inline text and images to be editable.
        if (inferredType !== "text" || !jsxElement) continue
        const textValue = readSingleTextChild(jsxElement)
        if (textValue === null) continue

        blocks.push({
          blockId: stableBlockId({
            sourceType: "inline",
            targetId: attrValue,
            filePath: relFile,
            order,
          }),
          targetId: attrValue,
          sourceType: "inline",
          type: "text",
          jsxTag,
          initialValue: textValue,
          initialSrc: srcValue,
          classNameValue,
          filePath: relFile,
          order: order++,
        })
        continue
      }

      // JSON-backed block.
      const parsed = parseJsonTarget(attrValue)
      if (!parsed) {
        warnings.push({
          targetId: attrValue,
          reason: "data-ampere-json value must look like 'path/file.json:dot.key'",
        })
        continue
      }

      const absoluteJsonPath = path.join(repoPath, parsed.file)
      let json = jsonCache.get(absoluteJsonPath)
      if (!jsonCache.has(absoluteJsonPath)) {
        try {
          const raw = await fs.readFile(absoluteJsonPath, "utf8")
          json = JSON.parse(raw)
          jsonCache.set(absoluteJsonPath, json)
        } catch {
          json = undefined
          jsonCache.set(absoluteJsonPath, undefined)
          warnings.push({
            targetId: attrValue,
            reason: `Could not read JSON at ${parsed.file}`,
          })
        }
      }

      const resolved =
        json !== undefined
          ? lodashGet(json as object, parsed.key)
          : undefined

      const jsonType: "text" | "image" =
        typeof resolved === "string" && /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(resolved)
          ? "image"
          : "text"

      const initialValue =
        resolved === undefined || resolved === null
          ? ""
          : typeof resolved === "string"
            ? resolved
            : JSON.stringify(resolved)

      blocks.push({
        blockId: stableBlockId({
          sourceType: "json",
          targetId: attrValue,
          filePath: relFile,
          order,
        }),
        targetId: attrValue,
        sourceType: "json",
        type: jsonType,
        jsxTag,
        initialValue,
        initialSrc: jsonType === "image" ? initialValue : undefined,
        classNameValue,
        jsonFile: parsed.file,
        jsonKeyPath: parsed.key,
        filePath: relFile,
        order: order++,
      })
    }
  }

  return {
    blocks,
    files: Array.from(touchedFiles).sort(),
    warnings,
  }
}

function buildProject(repoPath: string): Project {
  const tsconfigPath = path.join(repoPath, "tsconfig.json")
  let project: Project
  try {
    project = new Project({
      tsConfigFilePath: tsconfigPath,
      skipAddingFilesFromTsConfig: true,
      skipLoadingLibFiles: true,
    })
  } catch {
    project = new Project({
      compilerOptions: { allowJs: true, jsx: 1 },
      skipAddingFilesFromTsConfig: true,
      skipLoadingLibFiles: true,
    })
  }

  project.addSourceFilesAtPaths([
    path.join(repoPath, "app/**/*.{tsx,jsx}"),
    path.join(repoPath, "pages/**/*.{tsx,jsx}"),
    path.join(repoPath, "src/**/*.{tsx,jsx}"),
    path.join(repoPath, "components/**/*.{tsx,jsx}"),
    // Exclude build output and dependencies.
    `!${path.join(repoPath, "node_modules/**")}`,
    `!${path.join(repoPath, ".next/**")}`,
    `!${path.join(repoPath, ".git/**")}`,
    `!${path.join(repoPath, "dist/**")}`,
    `!${path.join(repoPath, "build/**")}`,
  ])
  return project
}

function readAttributeStringLiteral(attr: JsxAttribute): string | null {
  const init = attr.getInitializer()
  if (!init) return null
  if (init.getKind() === SyntaxKind.StringLiteral) {
    return (init as StringLiteral).getLiteralText()
  }
  if (Node.isJsxExpression(init)) {
    const expr = init.getExpression()
    if (expr && expr.getKind() === SyntaxKind.StringLiteral) {
      return (expr as StringLiteral).getLiteralText()
    }
  }
  return null
}

function readAttrStringLiteralOrUndefined(
  attr: JsxAttribute | undefined
): string | undefined {
  if (!attr) return undefined
  const v = readAttributeStringLiteral(attr as JsxAttribute)
  return v === null ? undefined : v
}

/**
 * Inline HTML tags whose text content is safe to extract recursively.
 * Block-level elements and custom components are not included so we only
 * flatten headings / paragraphs with simple inline formatting.
 */
const INLINE_TEXT_TAGS = new Set([
  "abbr", "b", "bdi", "cite", "code", "data", "em", "i", "kbd",
  "mark", "q", "s", "samp", "small", "span", "strong", "sub", "sup",
  "time", "u", "var",
])

/** Self-closing inline tags that contribute no text (but are safe to ignore). */
const VOID_INLINE_TAGS = new Set(["br", "wbr"])

/**
 * Return the element's inner text when every child is plain JsxText, or a
 * safe inline element (span, strong, br, etc.). Returns null if the element
 * contains block-level elements, JSX expressions, or custom components, so
 * that callers know the block cannot be safely treated as inline-editable text.
 */
function readSingleTextChild(el: JsxElement): string | null {
  return collectInlineText(el)
}

function collectInlineText(el: JsxElement): string | null {
  const children = el.getJsxChildren()
  if (children.length === 0) return ""

  const parts: string[] = []

  for (const c of children) {
    if (c.getKind() === SyntaxKind.JsxText) {
      parts.push(c.getText())
      continue
    }

    // Self-closing element: allow void inline tags (br, wbr) silently.
    if (c.getKind() === SyntaxKind.JsxSelfClosingElement) {
      const tag = (c as import("ts-morph").JsxSelfClosingElement)
        .getTagNameNode()
        .getText()
        .toLowerCase()
      if (VOID_INLINE_TAGS.has(tag)) {
        parts.push(" ")
        continue
      }
      return null
    }

    // Full element: allow known inline tags and recurse into their children.
    if (c.getKind() === SyntaxKind.JsxElement) {
      const childEl = c as JsxElement
      const tag = childEl
        .getOpeningElement()
        .getTagNameNode()
        .getText()
        .toLowerCase()
      if (!INLINE_TEXT_TAGS.has(tag)) return null
      const inner = collectInlineText(childEl)
      if (inner === null) return null
      parts.push(inner)
      continue
    }

    // JSX expression, fragment, or anything else — disqualify.
    return null
  }

  const combined = parts.join("")
  return collapseJsxTextWhitespace(combined)
}

/** JSX text nodes keep source whitespace; collapse to the rendered result. */
function collapseJsxTextWhitespace(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line, idx, arr) => {
      if (idx === 0) return line.replace(/\s+$/g, "")
      if (idx === arr.length - 1) return line.replace(/^\s+/g, "")
      return line.trim()
    })
    .filter(Boolean)
    .join(" ")
    .trim()
}

function inferInlineBlockType(
  tag: string,
  hasSrcAttr: boolean
): "text" | "image" | "container" {
  const lower = tag.toLowerCase()
  if (lower === "img" || hasSrcAttr) return "image"
  if (INTRINSIC_TAGS.has(lower)) return "text"
  // Custom components: treat as container placeholders in the preview.
  return "container"
}

function parseJsonTarget(
  value: string
): { file: string; key: string } | null {
  const colon = value.indexOf(":")
  if (colon < 1 || colon === value.length - 1) return null
  const file = value.slice(0, colon).trim()
  const key = value.slice(colon + 1).trim()
  if (!file.toLowerCase().endsWith(".json")) return null
  return { file, key }
}
