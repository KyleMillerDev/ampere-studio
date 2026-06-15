/**
 * Shape of a single editable block surfaced by the parser.
 *
 * The parser walks the fetched repo for `data-ampere-id` JSX attributes
 * (inline React) and `data-ampere-json` JSX attributes (JSON-driven content)
 * and emits one block per match.
 */

export type EditorBlockType = "text" | "image"
export type EditorSourceType = "inline" | "json"

export interface EditorBlock {
  /** Stable synthetic ID the CMS uses to address this block in the preview. */
  blockId: string
  /**
   * The raw value of the `data-ampere-id` / `data-ampere-json` attribute.
   * For JSON, this is `relative/file.json:dot.path.to.key`.
   */
  targetId: string
  sourceType: EditorSourceType
  type: EditorBlockType
  /** Original JSX tag name (e.g. `h1`, `p`, `img`). */
  jsxTag: string
  /**
   * Starting value. For `text` blocks: the inner text content. For `image`
   * blocks: the current `src` value.
   */
  initialValue: string
  /** For image blocks, the current src (mirrors `initialValue`). */
  initialSrc?: string
  /** `className` string literal, if that attribute was a plain string. */
  classNameValue?: string
  /** Relative path to the source file the block was captured from. */
  filePath: string
  /** For JSON-backed blocks: the file and dot path. */
  jsonFile?: string
  jsonKeyPath?: string
  /** Ordinal scan position, used to preserve scan order in the preview. */
  order: number
}

/** Warning surfaced during parse (e.g. the attribute references a missing JSON key). */
export interface EditorWarning {
  targetId: string
  reason: string
}

/** Single change applied by the publish endpoint. */
export interface EditorChange {
  blockId: string
  targetId: string
  sourceType: EditorSourceType
  type: "text" | "image"
  newValue: string
}
