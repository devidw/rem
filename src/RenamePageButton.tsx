import { Editor } from "tldraw"
import { forwardRef } from "react"
import { type MyPage, findAllChildPages } from "./nav-types"

interface RenamePageButtonProps {
  editor: Editor
  currentPage: MyPage
  allPages: MyPage[]
  showKeyboardHint?: boolean
}

export const RenamePageButton = forwardRef<
  HTMLButtonElement,
  RenamePageButtonProps
>(({ editor, currentPage, allPages, showKeyboardHint = false }, ref) => {
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

  // Don't render if this is the root page
  if (currentPage.name === "/") {
    return null
  }

  return (
    <button
      ref={ref}
      onClick={handleRename}
      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded cursor-pointer"
      title="Rename/move this page and update all child pages (R)"
    >
      {showKeyboardHint ? "R" : "✏️"}
    </button>
  )
})
