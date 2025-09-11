import { Editor, useEditor, type TLPage, type TLAsset } from "tldraw"
import { useState, useEffect } from "react"
import { createCheckpoint } from "./PersistenceManager"
import { RestoreComponent } from "./RestoreComponent"

type MyPage = TLPage & {
  my: {
    name: string
    parentPath: string
  }
}

/**
 * tlpage.name is like /a/b/c
 * Extract name and parent path from the page name
 */
function getMyPageSingle(page: TLPage): MyPage {
  // Remove leading/trailing slashes, then split
  const parts = page.name.replace(/^\/+|\/+$/g, "").split("/")
  // The last part is the name
  const name = parts[parts.length - 1] || ""
  // Parent path is everything except the last part
  const parentPath = parts.slice(0, -1).join("/")

  return {
    ...page,
    my: {
      name,
      parentPath,
    },
  }
}

function getMyPages(pages: TLPage[]): MyPage[] {
  // Map each page using the single page function
  const myPages = pages.map(getMyPageSingle)

  // Sort by name
  myPages.sort((a, b) => a.my.name.localeCompare(b.my.name))

  return myPages
}

/**
 * Find all child pages (direct and nested) of a given page
 */
function findAllChildPages(parentPage: MyPage, allPages: MyPage[]): MyPage[] {
  const parentPath = parentPage.name === "/" ? "" : parentPage.name.slice(1) // Remove leading slash for non-root

  return allPages.filter((page) => {
    // Skip the parent page itself
    if (page.id === parentPage.id) return false

    // Check if this page is a child (direct or nested) of the parent
    const pagePathWithoutSlash = page.name.slice(1) // Remove leading slash
    return (
      pagePathWithoutSlash.startsWith(parentPath + "/") ||
      (parentPath === "" && page.name !== "/")
    ) // For root page, include all non-root pages
  })
}

/**
 * Delete a page and all its child pages
 */
function deletePageAndChildren(
  editor: Editor,
  pageToDelete: MyPage,
  allPages: MyPage[]
) {
  const childPages = findAllChildPages(pageToDelete, allPages)
  const pagesToDelete = [pageToDelete, ...childPages]

  // Delete all pages
  pagesToDelete.forEach((page) => {
    editor.deletePage(page)
  })
}

function Controls({
  editor,
  currentPage,
  allPages,
}: {
  editor: Editor
  currentPage: MyPage
  allPages: MyPage[]
}) {
  const handleDelete = () => {
    const childPages = findAllChildPages(currentPage, allPages)
    const childCount = childPages.length

    let confirmMessage = `Are you sure you want to delete the page "${currentPage.my.name}"?`
    if (childCount > 0) {
      confirmMessage += `\n\nThis will also delete ${childCount} child page${
        childCount === 1 ? "" : "s"
      }:`
      confirmMessage += childPages
        .slice(0, 5)
        .map((p) => `\n- ${p.my.name}`)
        .join("")
      if (childCount > 5) {
        confirmMessage += `\n... and ${childCount - 5} more`
      }
    }

    if (window.confirm(confirmMessage)) {
      // Find parent page to navigate to after deletion
      let targetPage: MyPage | undefined

      if (currentPage.name === "/") {
        // Can't delete root page
        alert("Cannot delete the root page")
        return
      } else {
        // Navigate to parent page
        const parentPath =
          currentPage.my.parentPath === ""
            ? "/"
            : `/${currentPage.my.parentPath}`
        targetPage = allPages.find((p) => p.name === parentPath)
      }

      // Delete the page and its children
      deletePageAndChildren(editor, currentPage, allPages)

      // Navigate to parent page if it exists
      if (targetPage) {
        editor.setCurrentPage(targetPage)
      }
    }
  }

  const handleAdd = () => {
    const pageName = window.prompt("Enter page name:")
    if (pageName && pageName.trim()) {
      // Create full path by combining current page path with new name
      const currentPath = currentPage.name === "/" ? "" : currentPage.name
      const fullPath = `${currentPath}/${pageName.trim()}`

      // Check if page already exists
      const existingPage = allPages.find((p) => p.name === fullPath)
      if (existingPage) {
        alert("A page with this name already exists")
        return
      }

      // Create new page
      editor.createPage({ name: fullPath })
      // Get the newly created page
      const newPage =
        allPages.find((p) => p.name === fullPath) ||
        editor.getPages().find((p) => p.name === fullPath)
      if (newPage) {
        editor.setCurrentPage(newPage)
      }
    }
  }

  const handleRename = () => {
    // Can't rename root page
    if (currentPage.name === "/") {
      alert("Cannot rename the root page")
      return
    }

    // Get current full path for prefilling
    const currentPath = currentPage.name
    const newPath = window.prompt("Enter new page path:", currentPath)

    if (newPath && newPath.trim() && newPath.trim() !== currentPath) {
      const trimmedNewPath = newPath.trim()

      // Ensure path starts with /
      const normalizedNewPath = trimmedNewPath.startsWith("/")
        ? trimmedNewPath
        : `/${trimmedNewPath}`

      // Check if page with new path already exists
      const existingPage = allPages.find((p) => p.name === normalizedNewPath)
      if (existingPage) {
        alert("A page with this path already exists")
        return
      }

      const newFullPath = normalizedNewPath

      // Create any missing parent directories
      const pathParts = normalizedNewPath.split("/").filter(Boolean)
      let currentPath = ""

      for (let i = 0; i < pathParts.length - 1; i++) {
        currentPath += "/" + pathParts[i]
        const existingParent = allPages.find((p) => p.name === currentPath)
        if (!existingParent) {
          // Create the missing parent directory
          editor.createPage({ name: currentPath })
        }
      }

      // Find all child pages that need to be updated
      const childPages = findAllChildPages(currentPage, allPages)
      const oldPath = currentPage.name
      const oldPathWithoutSlash = oldPath.slice(1) // Remove leading slash
      const newPathWithoutSlash = newFullPath.slice(1) // Remove leading slash

      // Update all pages with new paths (preserves content!)
      const pagesToUpdate = [currentPage, ...childPages]

      pagesToUpdate.forEach((page) => {
        // Calculate new path for this page
        let newPagePath: string
        if (page.id === currentPage.id) {
          // This is the page being renamed/moved
          newPagePath = newFullPath
        } else {
          // This is a child page - replace the old parent path with new one
          const pagePathWithoutSlash = page.name.slice(1) // Remove leading slash
          newPagePath = `/${pagePathWithoutSlash.replace(
            oldPathWithoutSlash,
            newPathWithoutSlash
          )}`
        }

        // Update the page name (preserves all content!)
        editor.renamePage(page.id, newPagePath)
      })

      // Navigate back to the renamed page
      const renamedPage = editor.getPages().find((p) => p.name === newFullPath)
      if (renamedPage) {
        editor.setCurrentPage(renamedPage)
      }
    }
  }

  const handleCheckpoint = () => {
    createCheckpoint(editor)
  }

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
      const assets: Array<{ id: string; asset: TLAsset }> = []
      for (const [key, value] of Object.entries(snapshot.document.store)) {
        if (key.startsWith("asset:")) {
          assets.push({ id: key, asset: value as TLAsset })
        }
      }

      if (assets.length === 0) {
        alert("No assets found in current document")
        return
      }

      console.log(`Found ${assets.length} assets in document`)

      // Function to get expected filename using asset ID to ensure uniqueness
      const getExpectedFilename = (asset: TLAsset, assetId: string) => {
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
    <div className="flex items-center space-x-2">
      <button
        onClick={handleAdd}
        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded cursor-pointer"
        title="Add new page"
      >
        ➕
      </button>
      <button
        onClick={handleCheckpoint}
        className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded cursor-pointer"
        title="Create a checkpoint backup"
      >
        💾
      </button>
      <RestoreComponent />
      <button
        onClick={handleReexportAssets}
        className="px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded cursor-pointer"
        title="Re-export missing assets to server"
      >
        📤
      </button>
      {currentPage.name !== "/" && (
        <button
          onClick={handleRename}
          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded cursor-pointer"
          title="Rename/move this page and update all child pages"
        >
          ✏️
        </button>
      )}
      {currentPage.name !== "/" && (
        <button
          onClick={handleDelete}
          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded cursor-pointer"
          title="Delete this page and all child pages"
        >
          🗑️
        </button>
      )}
    </div>
  )
}

function Breadcrumb({
  editor,
  currentPage,
  allPages,
}: {
  editor: Editor
  currentPage: MyPage
  allPages: MyPage[]
}) {
  // Build breadcrumb items
  const breadcrumbItems = []

  if (currentPage.name === "/") {
    // Root page - just show "root"
    breadcrumbItems.push({
      label: "root",
      path: "/",
      isLast: true,
    })
  } else {
    // Split the current page path into segments (excluding root)
    const pathSegments = currentPage.name.split("/").filter(Boolean)

    // Add root link first
    breadcrumbItems.push({
      label: "root",
      path: "/",
      isLast: false,
    })

    // Add each segment
    let currentPath = ""
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`
      breadcrumbItems.push({
        label: segment,
        path: currentPath,
        isLast: index === pathSegments.length - 1,
      })
    })
  }

  return (
    <div className="flex items-center space-x-1">
      {breadcrumbItems.map((item, index) => {
        const page = allPages.find((p) => p.name === item.path)
        const isClickable = page && !item.isLast

        return (
          <span key={item.path} className="flex items-center">
            {index > 0 && <span className="mx-1">&rarr;</span>}
            <span
              className={`${
                isClickable
                  ? "cursor-pointer hover:underline"
                  : item.isLast
                  ? "font-bold underline"
                  : "opacity-50"
              }`}
              onClick={() => {
                if (page && !item.isLast) {
                  editor.setCurrentPage(page)
                }
              }}
            >
              {item.label}
            </span>
          </span>
        )
      })}
    </div>
  )
}

export function Nav() {
  const editor = useEditor()

  // React state for current page and pages
  const [currentPage, setCurrentPage] = useState<TLPage>(() =>
    editor.getCurrentPage()
  )
  const [pages, setPages] = useState<TLPage[]>(() => editor.getPages())

  // Set up listeners for tldraw changes
  useEffect(() => {
    const handleStoreChange = () => {
      // Update current page
      const newCurrentPage = editor.getCurrentPage()
      if (
        newCurrentPage.id !== currentPage.id ||
        newCurrentPage.name !== currentPage.name
      ) {
        setCurrentPage(newCurrentPage)
      }

      // Update pages list
      const newPages = editor.getPages()
      if (
        newPages.length !== pages.length ||
        newPages.some((page, index) => page.id !== pages[index]?.id) ||
        newPages.some((page, index) => page.name !== pages[index]?.name)
      ) {
        setPages(newPages)
      }
    }

    // Listen for store changes
    const unsubscribe = editor.store.listen(handleStoreChange, {
      source: "user",
      scope: "all",
    })

    // Cleanup listener on unmount
    return () => {
      unsubscribe()
    }
  }, [editor, currentPage.id, currentPage.name, pages.length])

  const currentMyPage = getMyPageSingle(currentPage)
  const myPages = getMyPages(pages)

  // Filter pages to show only direct children of current page
  const currentPagePath =
    currentMyPage.name === "/" ? "" : currentMyPage.name.slice(1) // Remove leading slash for non-root
  const filteredPages = myPages.filter(
    (page) => page.my.parentPath === currentPagePath
  )

  console.info({ currentMyPage, filteredPages })

  return (
    <div
      className="
    fixed top-50px left-20px
    p2
    space-y-2
    bg-red-900
    text-lg font-mono
  "
    >
      <Breadcrumb
        editor={editor}
        currentPage={currentMyPage}
        allPages={myPages}
      />

      <Controls
        editor={editor}
        currentPage={currentMyPage}
        allPages={myPages}
      />

      <hr />

      {filteredPages.map((page) =>
        NavItem({ page, editor, currentPage: currentMyPage })
      )}
    </div>
  )
}

function NavItem({
  page,
  currentPage,
  editor,
}: {
  page: MyPage
  currentPage: MyPage
  editor: Editor
}) {
  const theClassName = `
  ${page.id === currentPage.id ? "underline" : ""}
  `

  return (
    <>
      <div
        className={theClassName}
        key={page.id}
        onClick={() => {
          editor.setCurrentPage(page)
        }}
      >
        {page.my.name}
      </div>
    </>
  )
}
