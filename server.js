import express from "express"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import cors from "cors"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001
const DATA_DIR = path.join(__dirname, "data")
const ASSETS_DIR = path.join(DATA_DIR, "assets")
const BACKUPS_DIR = path.join(DATA_DIR, "backups")
const SNAPSHOT_FILE = path.join(DATA_DIR, "snapshot.json")

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true })
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true })
}

app.use(cors())
app.use(express.json({ limit: "50mb" }))

// Handle raw bodies for asset uploads
app.use("/uploads", express.raw({ type: "*/*", limit: "50mb" }))

// Save snapshot endpoint
app.post("/api/save", (req, res) => {
  try {
    const { snapshot, checkpoint = false } = req.body

    if (!snapshot) {
      return res.status(400).json({ error: "No snapshot provided" })
    }

    // If checkpoint is requested, create a backup folder with snapshot and assets
    if (checkpoint) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const backupFolderName = `backup-${timestamp}`
      const backupDir = path.join(BACKUPS_DIR, backupFolderName)
      const backupSnapshotFile = path.join(backupDir, "snapshot.json")
      const backupAssetsDir = path.join(backupDir, "assets")

      // Create backup directory and assets subdirectory
      fs.mkdirSync(backupDir, { recursive: true })
      fs.mkdirSync(backupAssetsDir, { recursive: true })

      // Save snapshot to backup folder
      fs.writeFileSync(backupSnapshotFile, JSON.stringify(snapshot, null, 2))

      // Copy all assets to backup folder
      try {
        const assetFiles = fs.readdirSync(ASSETS_DIR)
        assetFiles.forEach((file) => {
          const srcPath = path.join(ASSETS_DIR, file)
          const destPath = path.join(backupAssetsDir, file)
          fs.copyFileSync(srcPath, destPath)
        })
        console.log(
          `Backup created with ${assetFiles.length} assets: ${backupDir}`
        )
      } catch (error) {
        console.log(`Backup created (no assets found): ${backupDir}`)
      }
    }

    // Save the main snapshot file
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2))
    console.log("Snapshot saved successfully")

    res.json({
      success: true,
      message: checkpoint ? "Snapshot saved with checkpoint" : "Snapshot saved",
    })
  } catch (error) {
    console.error("Error saving snapshot:", error)
    res.status(500).json({ error: "Failed to save snapshot" })
  }
})

// Load snapshot endpoint
app.get("/api/load", (req, res) => {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) {
      return res.json({ snapshot: null })
    }

    const data = fs.readFileSync(SNAPSHOT_FILE, "utf8")
    const snapshot = JSON.parse(data)
    res.json({ snapshot })
  } catch (error) {
    console.error("Error loading snapshot:", error)
    res.status(500).json({ error: "Failed to load snapshot" })
  }
})

// Get list of checkpoints
app.get("/api/checkpoints", (req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return res.json({ checkpoints: [] })
    }

    const folders = fs.readdirSync(BACKUPS_DIR)
    const checkpoints = folders
      .filter((folder) => folder.startsWith("backup-"))
      .map((folder) => {
        const timestamp = folder.replace("backup-", "")
        const folderPath = path.join(BACKUPS_DIR, folder)
        const snapshotPath = path.join(folderPath, "snapshot.json")
        const assetsPath = path.join(folderPath, "assets")

        // Count assets in backup
        let assetCount = 0
        try {
          if (fs.existsSync(assetsPath)) {
            assetCount = fs.readdirSync(assetsPath).length
          }
        } catch (error) {
          // Ignore errors when counting assets
        }

        return {
          folderName: folder,
          timestamp: timestamp
            .replace(/-/g, ":")
            .replace("T", " ")
            .replace("Z", ""),
          path: folderPath,
          snapshotPath,
          assetsPath,
          assetCount,
        }
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    res.json({ checkpoints })
  } catch (error) {
    console.error("Error getting checkpoints:", error)
    res.status(500).json({ error: "Failed to get checkpoints" })
  }
})

// Get backup snapshot data (for client-side restoration)
app.get("/api/restore/:backupFolder", (req, res) => {
  try {
    const backupFolder = req.params.backupFolder
    const backupDir = path.join(BACKUPS_DIR, backupFolder)
    const backupSnapshotFile = path.join(backupDir, "snapshot.json")

    if (!fs.existsSync(backupDir)) {
      return res.status(404).json({ error: "Backup folder not found" })
    }

    if (!fs.existsSync(backupSnapshotFile)) {
      return res
        .status(404)
        .json({ error: "Snapshot file not found in backup" })
    }

    // Load snapshot from backup
    const snapshotData = fs.readFileSync(backupSnapshotFile, "utf8")
    const snapshot = JSON.parse(snapshotData)

    console.log(`Sent backup snapshot data: ${backupFolder}`)
    res.json({
      success: true,
      snapshot: snapshot,
      message: `Backup snapshot data retrieved: ${backupFolder}`,
    })
  } catch (error) {
    console.error("Error getting backup snapshot:", error)
    res.status(500).json({ error: "Failed to get backup snapshot" })
  }
})

// Restore from backup endpoint (server-side restoration - kept for compatibility)
app.post("/api/restore/:backupFolder", (req, res) => {
  try {
    const backupFolder = req.params.backupFolder
    const backupDir = path.join(BACKUPS_DIR, backupFolder)
    const backupSnapshotFile = path.join(backupDir, "snapshot.json")
    const backupAssetsDir = path.join(backupDir, "assets")

    if (!fs.existsSync(backupDir)) {
      return res.status(404).json({ error: "Backup folder not found" })
    }

    if (!fs.existsSync(backupSnapshotFile)) {
      return res
        .status(404)
        .json({ error: "Snapshot file not found in backup" })
    }

    // Load snapshot from backup
    const snapshotData = fs.readFileSync(backupSnapshotFile, "utf8")
    const snapshot = JSON.parse(snapshotData)

    // Restore assets from backup
    if (fs.existsSync(backupAssetsDir)) {
      const backupAssetFiles = fs.readdirSync(backupAssetsDir)
      backupAssetFiles.forEach((file) => {
        const srcPath = path.join(backupAssetsDir, file)
        const destPath = path.join(ASSETS_DIR, file)
        fs.copyFileSync(srcPath, destPath)
      })
      console.log(`Restored ${backupAssetFiles.length} assets from backup`)
    }

    // Save restored snapshot as current
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2))

    console.log(`Restored from backup: ${backupFolder}`)
    res.json({
      success: true,
      message: `Successfully restored from backup ${backupFolder}`,
    })
  } catch (error) {
    console.error("Error restoring from backup:", error)
    res.status(500).json({ error: "Failed to restore from backup" })
  }
})

// Upload asset endpoint (tldraw style)
app.put("/uploads/:id", (req, res) => {
  try {
    const id = req.params.id
    const assetPath = path.join(ASSETS_DIR, id)

    // Write the raw body to file
    fs.writeFileSync(assetPath, req.body)

    console.log(`Asset uploaded: ${id}`)
    res.json({ ok: true })
  } catch (error) {
    console.error("Error uploading asset:", error)
    res.status(500).json({ error: "Failed to upload asset" })
  }
})

// Serve assets
app.get("/uploads/:id", (req, res) => {
  try {
    const id = req.params.id
    const assetPath = path.join(ASSETS_DIR, id)

    if (!fs.existsSync(assetPath)) {
      return res.status(404).json({ error: "Asset not found" })
    }

    // Get file stats for content type
    const stats = fs.statSync(assetPath)
    const contentType = getContentType(id)

    res.setHeader("Content-Type", contentType)
    res.setHeader("Content-Length", stats.size)
    res.setHeader("Cache-Control", "public, max-age=31536000") // Cache for 1 year

    const stream = fs.createReadStream(assetPath)
    stream.pipe(res)
  } catch (error) {
    console.error("Error serving asset:", error)
    res.status(500).json({ error: "Failed to serve asset" })
  }
})

// Export assets from browser IndexedDB endpoint
app.post("/api/export-assets", express.json(), (req, res) => {
  try {
    const { assets } = req.body

    if (!assets || !Array.isArray(assets)) {
      return res.status(400).json({ error: "No assets array provided" })
    }

    let successCount = 0
    let failCount = 0
    const results = []

    for (const { id, mimeType, blob } of assets) {
      try {
        if (!id || !blob) {
          failCount++
          results.push({
            id,
            success: false,
            error: "Missing asset ID or blob data",
          })
          continue
        }

        // Infer file extension from MIME type
        const fileExtension = getFileExtensionFromMimeType(
          mimeType || "application/octet-stream"
        )
        const filename = `${id}${fileExtension}`

        // Convert base64 blob data back to binary
        const buffer = Buffer.from(blob, "base64")
        const assetPath = path.join(ASSETS_DIR, filename)

        // Write the asset to file
        fs.writeFileSync(assetPath, buffer)

        successCount++
        results.push({ id, filename, success: true })
        console.log(
          `Asset exported: ${filename} (MIME: ${mimeType || "unknown"})`
        )
      } catch (error) {
        failCount++
        results.push({ id, success: false, error: error.message })
        console.error(`Error exporting asset ${id}:`, error)
      }
    }

    res.json({
      success: true,
      message: `Export complete: ${successCount} successful, ${failCount} failed`,
      successCount,
      failCount,
      results,
    })
  } catch (error) {
    console.error("Error in bulk asset export:", error)
    res.status(500).json({ error: "Failed to export assets" })
  }
})

// Helper function to determine content type
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase()
  const contentTypes = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".json": "application/json",
  }
  return contentTypes[ext] || "application/octet-stream"
}

// Helper function to get file extension from MIME type
function getFileExtensionFromMimeType(mimeType) {
  const mimeToExt = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    "image/x-icon": ".ico",
    "application/pdf": ".pdf",
    "application/json": ".json",
    "text/plain": ".txt",
    "application/octet-stream": ".bin",
  }
  return mimeToExt[mimeType] || ".bin"
}

app.listen(PORT, () => {
  console.log(`Persistence server running on http://localhost:${PORT}`)
})
