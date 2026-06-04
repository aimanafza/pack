/**
 * PACK Extension Icon Generator
 * Run once with: node generate-icons.js
 * Requires: npm install canvas (or uses built-in if available)
 *
 * Generates the PACK "p" lettermark icons at 16, 48, and 128px.
 * Palette: #1A1A18 letter on #F5F0EB linen background — matches PACK design system.
 */

const fs = require('fs')
const path = require('path')

// Try to use the `canvas` npm package; fall back to a pure SVG→PNG approach via sharp if available
let canvasLib
try {
  canvasLib = require('canvas')
} catch {
  console.log('canvas not available, trying sharp...')
  canvasLib = null
}

const SIZES = [16, 48, 128]

const BG_COLOR = '#F5F0EB'   // linen surface — matches PACK --color-bg-secondary
const INK_COLOR = '#1A1A18'  // near-black — matches PACK --color-text-primary

function buildSvg(size) {
  // Font size scales proportionally; weight 500 for readability at small sizes
  const fontSize = Math.round(size * 0.62)
  const fontFamily = 'Georgia, serif'
  // Slight italic for the editorial "p" lettermark feel
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG_COLOR}" rx="${Math.round(size * 0.18)}"/>
  <text
    x="${size / 2}"
    y="${size / 2 + fontSize * 0.36}"
    text-anchor="middle"
    font-family="${fontFamily}"
    font-size="${fontSize}"
    font-style="italic"
    fill="${INK_COLOR}"
  >p</text>
</svg>`
}

async function generateWithCanvas(size) {
  const { createCanvas } = canvasLib
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Background — rounded rect
  const r = Math.round(size * 0.18)
  ctx.fillStyle = BG_COLOR
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.quadraticCurveTo(size, 0, size, r)
  ctx.lineTo(size, size - r)
  ctx.quadraticCurveTo(size, size, size - r, size)
  ctx.lineTo(r, size)
  ctx.quadraticCurveTo(0, size, 0, size - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
  ctx.fill()

  // Letter
  const fontSize = Math.round(size * 0.62)
  ctx.fillStyle = INK_COLOR
  ctx.font = `italic ${fontSize}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('p', size / 2, size / 2 + fontSize * 0.06)

  return canvas.toBuffer('image/png')
}

async function generateWithSharp(size) {
  const sharp = require('sharp')
  const svg = buildSvg(size)
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function generateFallbackPng(size) {
  // Pure PNG from SVG without external deps — write SVG and note it
  const svgPath = path.join(__dirname, 'icons', `icon${size}.svg`)
  const pngPath = path.join(__dirname, 'icons', `icon${size}.png`)
  fs.writeFileSync(svgPath, buildSvg(size))
  console.log(`  Wrote SVG fallback: ${svgPath}`)
  console.log(`  To convert to PNG: npx svgexport ${svgPath} ${pngPath} ${size}:${size}`)
  // Write a minimal 1×1 transparent PNG as placeholder so the extension loads without error
  // This is the smallest valid PNG header + IDAT + IEND
  const MINIMAL_PNG = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c48900000' +
    '00a4944415478016360000000020001e221bc330000000049454e44ae426082',
    'hex'
  )
  fs.writeFileSync(pngPath, MINIMAL_PNG)
  console.log(`  Placeholder PNG written: ${pngPath} (replace with converted SVG for production)`)
}

async function main() {
  console.log('Generating PACK extension icons...\n')
  for (const size of SIZES) {
    const outPath = path.join(__dirname, 'icons', `icon${size}.png`)
    try {
      let buf
      if (canvasLib) {
        buf = await generateWithCanvas(size)
        console.log(`  ✓ ${size}×${size} via canvas`)
      } else {
        try {
          buf = await generateWithSharp(size)
          console.log(`  ✓ ${size}×${size} via sharp`)
        } catch {
          await generateFallbackPng(size)
          continue
        }
      }
      fs.writeFileSync(outPath, buf)
    } catch (err) {
      console.error(`  ✗ ${size}×${size} failed: ${err.message}`)
      await generateFallbackPng(size)
    }
  }
  console.log('\nDone. Icons written to pack-extension/icons/')
}

main().catch(console.error)
