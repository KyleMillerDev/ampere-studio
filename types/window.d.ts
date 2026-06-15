/**
 * Ambient declarations shared by code running in the CMS parent window
 * and by the editor iframe's inject script.
 */

interface Window {
  /**
   * Installed by the inject script inside the preview iframe. Lets the
   * parent CMS push text and image updates back into the live DOM without
   * round-tripping through React.
   */
  __ampereSetValue?: (
    blockId: string,
    type: "text" | "image",
    newValue: string
  ) => void
}
