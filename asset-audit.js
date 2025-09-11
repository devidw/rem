import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SNAPSHOT_PATH = path.join(__dirname, "data", "snapshot.json")
const ASSETS_DIR = path.join(__dirname, "data", "assets")

function parseSnapshotData(snapshotContent) {
  try {
    return JSON.parse(snapshotContent)
  } catch (error) {
    console.error("Error parsing snapshot.json:", error.message)
    return null
  }
}

function getActualAssetFiles() {
  if (!fs.existsSync(ASSETS_DIR)) {
    return []
  }
  return fs
    .readdirSync(ASSETS_DIR)
    .filter((file) => file.endsWith(".png"))
    .map((file) => file.replace(".png", "")) // Return just the asset ID without extension
}

function getAssetIdFromAsset(asset, assetId) {
  if (!asset?.props) return null

  // For assets stored in IndexedDB, extract just the ID part
  if (asset.props.src && asset.props.src.startsWith("asset:")) {
    const idWithoutPrefix = assetId.replace("asset:", "")
    return idWithoutPrefix
  }

  // For assets served from the server, extract the filename from the URL
  if (asset.props.src && asset.props.src.includes("/uploads/")) {
    // Extract filename from URL like "http://localhost:3001/uploads/-1671102483.png"
    const urlParts = asset.props.src.split("/uploads/")
    if (urlParts.length > 1) {
      const filename = urlParts[1]
      // Remove .png extension if present
      return filename.replace(".png", "")
    }
  }

  return null
}

function buildAssetMapping(snapshotData) {
  if (!snapshotData?.document?.store) {
    return {}
  }

  const assetMapping = {}
  const store = snapshotData.document.store

  // Collect all assets defined in snapshot
  for (const [key, value] of Object.entries(store)) {
    if (key.startsWith("asset:")) {
      const assetId = key
      const assetIdOnly = getAssetIdFromAsset(value, assetId)

      assetMapping[assetId] = {
        id: assetId,
        assetIdOnly: assetIdOnly,
      }
    }
  }

  return assetMapping
}

function findUltimatePageParent(shapeId, store, pageNames) {
  let currentId = shapeId
  const visited = new Set() // Prevent infinite loops

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)

    // If this is a page, return it
    if (pageNames[currentId]) {
      return currentId
    }

    // If this is a shape, get its parent
    const shape = store[currentId]
    if (shape && shape.parentId) {
      currentId = shape.parentId
    } else {
      break
    }
  }

  return null
}

function buildAssetToPageMapping(snapshotData) {
  const assetToPages = {}
  const pageNames = {}

  if (!snapshotData?.document?.store) {
    return { assetToPages, pageNames }
  }

  const store = snapshotData.document.store

  // First pass: collect page names
  for (const [key, value] of Object.entries(store)) {
    if (key.startsWith("page:") && value.name) {
      pageNames[key] = value.name
    }
  }

  // Second pass: find image shapes and their asset references
  for (const [key, value] of Object.entries(store)) {
    if (
      key.startsWith("shape:") &&
      value.type === "image" &&
      value.props?.assetId
    ) {
      const assetId = value.props.assetId
      const parentId = value.parentId

      // Traverse up the hierarchy to find the ultimate page parent
      const ultimatePageId = findUltimatePageParent(parentId, store, pageNames)

      if (ultimatePageId) {
        if (!assetToPages[assetId]) {
          assetToPages[assetId] = []
        }
        if (!assetToPages[assetId].includes(ultimatePageId)) {
          assetToPages[assetId].push(ultimatePageId)
        }
      }
    }
  }

  return { assetToPages, pageNames }
}

function main() {
  // Check for --rm flag
  const shouldRemove = process.argv.includes("--rm")

  // Read snapshot.json
  let snapshotContent
  try {
    snapshotContent = fs.readFileSync(SNAPSHOT_PATH, "utf8")
  } catch (error) {
    console.error("Error reading snapshot.json:", error.message)
    return
  }

  // Parse snapshot data
  const snapshotData = parseSnapshotData(snapshotContent)
  if (!snapshotData) return

  // Get actual files in assets directory
  const actualAssets = getActualAssetFiles()

  // Build asset mapping
  const assetMapping = buildAssetMapping(snapshotData)

  // Build asset-to-page mapping
  const { assetToPages, pageNames } = buildAssetToPageMapping(snapshotData)

  // Collect all asset IDs that are actually used
  const usedAssetIds = new Set()

  // Show only pages that have assets
  for (const pageId of Object.keys(pageNames)) {
    // Check if this page has any assets
    const pageAssets = []

    for (const assetId in assetToPages) {
      if (assetToPages[assetId].includes(pageId)) {
        const asset = assetMapping[assetId]
        const assetIdOnly = asset?.assetIdOnly
        const fileExists = assetIdOnly && actualAssets.includes(assetIdOnly)
        const filePath = fileExists ? `${assetIdOnly}.png` : "❌"

        // Track used asset IDs
        if (assetIdOnly) {
          usedAssetIds.add(assetIdOnly)
        }

        pageAssets.push({
          assetId,
          filePath,
        })
      }
    }

    // Only show pages that have assets
    if (pageAssets.length > 0) {
      const pageName = pageNames[pageId] || pageId
      console.log(`${pageName}`)
      pageAssets.forEach(({ assetId, filePath }) => {
        console.log(`  ${assetId} → ${filePath}`)
      })
      console.log()
    }
  }

  // Find unused files on disk
  const unusedAssetIds = actualAssets.filter(
    (assetId) => !usedAssetIds.has(assetId)
  )

  if (unusedAssetIds.length > 0) {
    console.log("ASSET FILES ON DISK BUT NOT USED:")
    unusedAssetIds.forEach((assetId) => {
      console.log(`  ${assetId}.png`)
    })
    console.log()

    if (shouldRemove) {
      console.log("REMOVING UNUSED ASSET FILES:")
      unusedAssetIds.forEach((assetId) => {
        const filePath = path.join(ASSETS_DIR, `${assetId}.png`)
        try {
          fs.unlinkSync(filePath)
          console.log(`  ✅ Removed: ${assetId}.png`)
        } catch (error) {
          console.error(
            `  ❌ Failed to remove ${assetId}.png: ${error.message}`
          )
        }
      })
    } else {
      console.log("Use --rm flag to remove these unused files.")
    }
  } else {
    console.log("No unused asset files found on disk.")
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
