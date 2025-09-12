import { Editor } from "tldraw"
import { forwardRef } from "react"
import {
  type MyPage,
  findAllChildPages,
  deletePageAndChildren,
} from "./nav-types"

interface DeletePageButtonProps {
  editor: Editor
  currentPage: MyPage
  allPages: MyPage[]
  showKeyboardHint?: boolean
}

export const DeletePageButton = forwardRef<
  HTMLButtonElement,
  DeletePageButtonProps
>(({ editor, currentPage, allPages, showKeyboardHint = false }, ref) => {
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

  // Don't render if this is the root page
  if (currentPage.name === "/") {
    return null
  }

  return (
    <button
      ref={ref}
      onClick={handleDelete}
      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded cursor-pointer"
      title="Delete this page and all child pages (D)"
    >
      {showKeyboardHint ? "D" : "🗑️"}
    </button>
  )
})
