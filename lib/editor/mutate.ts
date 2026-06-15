import path from "node:path"

import {
  Node,
  Project,
  SyntaxKind,
  type JsxAttribute,
  type JsxElement,
  type StringLiteral,
} from "ts-morph"

import type { EditorChange, EditorWarning } from "@/lib/editor/types"

const AMPERE_ID_ATTR = "data-ampere-id"

export interface InlineMutationResult {
  modifiedFiles: Set<string>
  warnings: EditorWarning[]
}

/**
 * Apply every inline (JSX-driven) change by walking the already-fetched
 * source tree with ts-morph and mutating only the specific nodes that match
 * `data-ampere-id="<targetId>"`.
 */
export async function applyInlineMutations(params: {
  repoPath: string
  changes: EditorChange[]
}): Promise<InlineMutationResult> {
  const warnings: EditorWarning[] = []
  const modifiedFiles = new Set<string>()

  const project = buildProject(params.repoPath)

  for (const change of params.changes) {
    let applied = false
    for (const sf of project.getSourceFiles()) {
      const matchingAttrs = sf
        .getDescendantsOfKind(SyntaxKind.JsxAttribute)
        .filter((attr) => isIdAttrWithValue(attr, change.targetId))

      for (const attr of matchingAttrs) {
        const opening =
          attr.getFirstAncestorByKind(SyntaxKind.JsxOpeningElement) ??
          attr.getFirstAncestorByKind(SyntaxKind.JsxSelfClosingElement)
        if (!opening) continue

        const isSelfClosing =
          opening.getKind() === SyntaxKind.JsxSelfClosingElement

        if (change.type === "text") {
          if (isSelfClosing) {
            warnings.push({
              targetId: change.targetId,
              reason: "self-closing-element-cannot-contain-text",
            })
            continue
          }
          const el = opening.getParent() as JsxElement
          const children = el.getJsxChildren()

          const allText = children.every(
            (c) => c.getKind() === SyntaxKind.JsxText
          )

          if (!allText) {
            // The element has inline children (e.g. <span>, <br/>) or
            // expressions. Replace the entire body with the new plain text,
            // which flattens any inline markup. This is the correct behaviour
            // for a content editor: the user edited the visible text and we
            // persist exactly that.
            const escaped = escapeJsxText(change.newValue)
            el.setBodyText(escaped)
            modifiedFiles.add(relPath(params.repoPath, sf.getFilePath()))
            applied = true
            continue
          }

          const escaped = escapeJsxText(change.newValue)

          if (children.length === 1) {
            children[0].replaceWithText(escaped)
          } else if (children.length === 0) {
            el.setBodyText(escaped)
          } else {
            // Multiple JsxText siblings (rare); rewrite the body wholesale.
            el.setBodyText(escaped)
          }

          modifiedFiles.add(relPath(params.repoPath, sf.getFilePath()))
          applied = true
          continue
        }

        if (change.type === "image") {
          const srcAttr = opening.getAttribute("src")
          if (!Node.isJsxAttribute(srcAttr)) {
            warnings.push({
              targetId: change.targetId,
              reason: "no-src-attribute",
            })
            continue
          }
          const init = srcAttr.getInitializer()
          if (!init) continue

          if (init.getKind() === SyntaxKind.StringLiteral) {
            init.replaceWithText(JSON.stringify(change.newValue))
            modifiedFiles.add(relPath(params.repoPath, sf.getFilePath()))
            applied = true
            continue
          }
          if (Node.isJsxExpression(init)) {
            const expr = init.getExpression()
            if (expr && expr.getKind() === SyntaxKind.StringLiteral) {
              expr.replaceWithText(JSON.stringify(change.newValue))
              modifiedFiles.add(relPath(params.repoPath, sf.getFilePath()))
              applied = true
              continue
            }
          }
          warnings.push({
            targetId: change.targetId,
            reason: "dynamic-src-expression",
          })
          continue
        }
      }
    }
    if (!applied) {
      warnings.push({ targetId: change.targetId, reason: "not-found" })
    }
  }

  await project.save()
  return { modifiedFiles, warnings }
}

function buildProject(repoPath: string): Project {
  let project: Project
  try {
    project = new Project({
      tsConfigFilePath: path.join(repoPath, "tsconfig.json"),
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
    `!${path.join(repoPath, "node_modules/**")}`,
    `!${path.join(repoPath, ".next/**")}`,
    `!${path.join(repoPath, ".git/**")}`,
    `!${path.join(repoPath, "dist/**")}`,
    `!${path.join(repoPath, "build/**")}`,
  ])
  return project
}

function isIdAttrWithValue(attr: JsxAttribute, value: string): boolean {
  if (attr.getNameNode().getText() !== AMPERE_ID_ATTR) return false
  const init = attr.getInitializer()
  if (!init) return false
  if (init.getKind() === SyntaxKind.StringLiteral) {
    return (init as StringLiteral).getLiteralText() === value
  }
  if (Node.isJsxExpression(init)) {
    const expr = init.getExpression()
    if (expr && expr.getKind() === SyntaxKind.StringLiteral) {
      return (expr as StringLiteral).getLiteralText() === value
    }
  }
  return false
}

function relPath(repoPath: string, absolutePath: string): string {
  return path.relative(repoPath, absolutePath).replace(/\\/g, "/")
}

/**
 * Entity-encode any characters that would otherwise break JSX text content.
 * Keeps the node as JsxText rather than converting to a JsxExpression so
 * the source tree stays as close to the original as possible.
 */
function escapeJsxText(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
}
