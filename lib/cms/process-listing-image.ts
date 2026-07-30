import { processImageForUpload } from "@/lib/cms/process-product-image"

const MAX_LISTING_IMAGE_SIZE = 1920

/** Resize rental listing photos for upload (JPEG, max 1920px on the long edge). */
export async function processListingImage(file: File): Promise<File> {
  return processImageForUpload(file, {
    maxSize: MAX_LISTING_IMAGE_SIZE,
    quality: 0.88,
  })
}
