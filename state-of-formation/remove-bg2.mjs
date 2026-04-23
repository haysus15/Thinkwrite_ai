import sharp from 'sharp'

async function removeWhiteBackground(inputFile, outputFile) {
  const image = sharp(inputFile)
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = new Uint8Array(data)

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const avg = (r + g + b) / 3
    // Remove whites AND light grays
    if (avg > 180 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30) {
      pixels[i + 3] = 0
    }
  }

  await sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
  .png()
  .toFile(outputFile)

  console.log(`Done: ${outputFile}`)
}

await removeWhiteBackground('public/demons-left.png', 'public/demons-left-clean.png')
await removeWhiteBackground('public/demons-right.png', 'public/demons-right-clean.png')
