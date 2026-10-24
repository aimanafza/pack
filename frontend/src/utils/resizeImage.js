// Shrink a photo before upload: phone photos are often 4000px+ and several MB, which
// is slow on mobile data and costs more for Claude to read. 2000px keeps plenty of detail.
const MAX_SIDE = 2000

export async function resizeImage(file) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    // Already small and a format every browser reads: send as is
    if (scale === 1 && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      bitmap.close?.()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    // PNGs may be transparent (cut-out product shots); JPEG would fill that with black
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.88))
    if (!blob) return file
    const ext = type === 'image/png' ? 'png' : 'jpg'
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${base}.${ext}`, { type })
  } catch {
    // The browser can't decode it (some HEIC files): upload the original and let the server try
    return file
  }
}
