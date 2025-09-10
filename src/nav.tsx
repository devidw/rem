import { Editor, useEditor, type TLPage } from "tldraw"
import { useState, useEffect } from "react"
import { createCheckpoint } from "./PersistenceManager"

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
