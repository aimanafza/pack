// Looks are generated at 2:3. Older images taller than that would lose the head
// or shoes when cropped to fill, so those are shown whole instead.
export function markTallLook(e) {
  const img = e.currentTarget
  img.dataset.tall = String(img.naturalWidth / img.naturalHeight < 0.66)
}
