import { Editor } from "tldraw"

interface ReexportAssetsButtonProps {
  editor: Editor
  showLabel?: boolean
}

export function ReexportAssetsButton({
  editor,
  showLabel = false,
}: ReexportAssetsButtonProps) {
  const handleReexportAssets = async () => {
    try {
      if (
        !window.confirm(
          "This will export all assets from IndexedDB to server using asset IDs with file extensions inferred from MIME types. Continue?"
        )
      ) {
        return
      }

      console.log("Starting bulk asset export...")

      // Get current snapshot
      const { getSnapshot } = await import("tldraw")
      const snapshot = getSnapshot(editor.store)

      // Find all assets in the snapshot
      const assets: Array<{ id: string; asset: any }> = []
      for (const [key, value] of Object.entries(snapshot.document.store)) {
        if (key.startsWith("asset:")) {
          assets.push({ id: key, asset: value })
        }
      }

      if (assets.length === 0) {
        alert("No assets found in current document")
        return
      }

      console.log(`Found ${assets.length} assets in document`)

      // Function to get expected filename using asset ID to ensure uniqueness
      const getExpectedFilename = (asset: any, assetId: string) => {
        if (!asset?.props) return null

        // Check for HTTP URL format - if it already exists on server
        if (
          asset.props.src &&
          asset.props.src.includes("http://localhost:3001/uploads/")
        ) {
          const urlMatch = asset.props.src.match(/\/uploads\/(asset_[^"]+)/)
          if (urlMatch) {
            return decodeURIComponent(urlMatch[1])
          }
        }

        // For assets stored in IndexedDB, always use ID-based naming to ensure uniqueness
        if (asset.props.src && asset.props.src.startsWith("asset:")) {
          const name = (asset.props as any).name || "unknown"
          // Always prefix with asset ID to ensure uniqueness, even for "tldrawFile" and similar
          const sanitizedName = name.replace(/[^a-zA-Z0-9.-]/g, "-")
          return `asset_${assetId}_${sanitizedName}`
        }

        return null
      }

      // Collect all assets from IndexedDB for bulk export
      const assetsToExport = []
      const dbName = "TLDRAW_DOCUMENT_v2rem" // Based on persistenceKey "rem"

      try {
        const request = indexedDB.open(dbName)
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        // Get all assets from IndexedDB - create a new transaction for each asset
        for (const { id, asset } of assets) {
          if (asset.type !== "image") continue // Only process images

          const assetId = id.replace("asset:", "")
          const expectedFilename = getExpectedFilename(asset, assetId)

          if (!expectedFilename) continue

          try {
            // Create a new transaction for each asset to avoid TransactionInactiveError
            const transaction = db.transaction(["assets"], "readonly")
            const objectStore = transaction.objectStore("assets")

            const getRequest = objectStore.get(id)
            const assetData = await new Promise<any>((resolve, reject) => {
              getRequest.onsuccess = () => resolve(getRequest.result)
              getRequest.onerror = () => reject(getRequest.error)
            })

            if (assetData) {
              // Extract blob data
              let assetBlob: Blob | null = null

              if (assetData instanceof File || assetData instanceof Blob) {
                assetBlob = assetData
              } else if (assetData.name && assetData.size && assetData.type) {
                assetBlob = assetData as any
              } else {
                // Search for blob in asset data structure
                for (const value of Object.values(assetData)) {
                  if (value instanceof Blob || value instanceof File) {
                    assetBlob = value as Blob
                    break
                  } else if (
                    value &&
                    typeof value === "object" &&
                    "name" in value &&
                    "size" in value
                  ) {
                    assetBlob = value as unknown as Blob
                    break
                  }
                }
              }

              if (assetBlob) {
                // Convert blob to base64 for transport using a more efficient method
                // that doesn't cause call stack overflow for large files
                const base64 = await new Promise<string>((resolve) => {
                  const reader = new FileReader()
                  reader.onload = () => {
                    const result = reader.result as string
                    // Remove the data URL prefix (e.g., "data:image/png;base64,")
                    const base64Data = result.split(",")[1]
                    resolve(base64Data)
                  }
                  reader.readAsDataURL(assetBlob)
                })

                assetsToExport.push({
                  id: assetId, // Use just the asset ID
                  mimeType: assetBlob.type || "application/octet-stream", // Include MIME type
                  blob: base64,
                })
              }
            }
          } catch (error) {
            console.error(`Failed to get asset ${id} from IndexedDB:`, error)
          }
        }

        db.close()
      } catch (error) {
        console.error("Failed to access IndexedDB:", error)
        alert("Failed to access IndexedDB. Check console for details.")
        return
      }

      if (assetsToExport.length === 0) {
        alert("No assets could be extracted from IndexedDB")
        return
      }

      console.log(
        `Extracted ${assetsToExport.length} assets, sending to server...`
      )

      // Send all assets to server in one bulk request
      try {
        const response = await fetch(
          "http://localhost:3001/api/export-assets",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ assets: assetsToExport }),
          }
        )

        const result = await response.json()

        if (response.ok) {
          console.log("Bulk export result:", result)
          alert(
            `Asset export complete!\n\n✅ Successfully exported: ${result.successCount}\n❌ Failed: ${result.failCount}`
          )
        } else {
          throw new Error(result.error || "Export failed")
        }
      } catch (error) {
        console.error("Bulk export failed:", error)
        alert("Bulk export failed. Check console for details.")
      }
    } catch (error) {
      console.error("Asset export failed:", error)
      alert("Asset export failed. Check console for details.")
    }
  }

  return (
    <button
      onClick={handleReexportAssets}
      className={`${
        showLabel ? "px-2 py-1" : "w-6 h-6"
      } flex items-center justify-center text-gray-800 text-xs border border-gray-400 cursor-pointer font-mono`}
      title="Re-export missing assets to server"
    >
      {showLabel ? "Export" : "-&gt;"}
    </button>
  )
}
