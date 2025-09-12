import { Editor } from "tldraw"
import { forwardRef } from "react"
import type { MyPage } from "./nav-types"

interface AddPageButtonProps {
  editor: Editor
  currentPage: MyPage
  allPages: MyPage[]
  showKeyboardHint?: boolean
}

export const AddPageButton = forwardRef<HTMLButtonElement, AddPageButtonProps>(
  ({ editor, currentPage, allPages, showKeyboardHint = false }, ref) => {
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

    return (
      <button
        ref={ref}
        onClick={handleAdd}
        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded cursor-pointer"
        title="Add new page (C)"
      >
        {showKeyboardHint ? "C" : "➕"}
      </button>
    )
  }
)
