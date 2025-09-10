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
const SNAPSHOT_FILE = path.join(DATA_DIR, "snapshot.json")

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true })
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

    // If checkpoint is requested, create a backup file
    if (checkpoint) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const backupFile = path.join(DATA_DIR, `snapshot-${timestamp}.bak.json`)
      fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2))
      console.log(`Checkpoint created: ${backupFile}`)
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
    const files = fs.readdirSync(DATA_DIR)
    const checkpoints = files
      .filter((file) => file.endsWith(".bak.json"))
      .map((file) => {
        const timestamp = file.replace("snapshot-", "").replace(".bak.json", "")
        return {
          filename: file,
          timestamp: timestamp
            .replace(/-/g, ":")
            .replace("T", " ")
            .replace("Z", ""),
          path: path.join(DATA_DIR, file),
        }
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    res.json({ checkpoints })
  } catch (error) {
    console.error("Error getting checkpoints:", error)
    res.status(500).json({ error: "Failed to get checkpoints" })
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

app.listen(PORT, () => {
  console.log(`Persistence server running on http://localhost:${PORT}`)
})
