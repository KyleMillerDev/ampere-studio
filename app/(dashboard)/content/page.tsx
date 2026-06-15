import { EditorLanding } from "@/components/cms/editor/editor-landing"

export const metadata = { title: "Content editor" }
export const dynamic = "force-dynamic"

export default function ContentEditorPage() {
  return (
    <div className="-mx-6 -my-6 flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <EditorLanding />
    </div>
  )
}
