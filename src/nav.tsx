import { useEditor, type TLPage } from "tldraw"
import { useState, useEffect } from "react"
import { useStore } from "@nanostores/react"
import { Controls } from "./Controls"
import { Breadcrumb } from "./Breadcrumb"
import { NavItem } from "./NavItem"
import { getMyPageSingle, getMyPages } from "./nav-types"
import { keyboardModeStore, setKeyboardMode } from "./stores"

export function Nav() {
  const editor = useEditor()
  const keyboardMode = useStore(keyboardModeStore)

  // React state for current page and pages
  const [currentPage, setCurrentPage] = useState<TLPage>(() =>
    editor.getCurrentPage()
  )
  const [pages, setPages] = useState<TLPage[]>(() => editor.getPages())
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [navigationMemory, setNavigationMemory] = useState<Map<string, number>>(
    new Map()
  )

  const currentMyPage = getMyPageSingle(currentPage)
  const myPages = getMyPages(pages)

  // Filter pages to show only direct children of current page
  const currentPagePath =
    currentMyPage.name === "/" ? "" : currentMyPage.name.slice(1) // Remove leading slash for non-root
  const filteredPages = myPages.filter(
    (page) =>
      page.my.parentPath === currentPagePath && page.id !== currentMyPage.id
  )

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

  // Reset selected index when keyboard mode changes or pages change
  useEffect(() => {
    if (keyboardMode && filteredPages.length > 0) {
      // Check if we have a remembered selection for this page
      const currentPagePath =
        currentMyPage.name === "/" ? "" : currentMyPage.name.slice(1)
      const rememberedIndex = navigationMemory.get(currentPagePath)
      if (
        rememberedIndex !== undefined &&
        rememberedIndex < filteredPages.length
      ) {
        setSelectedIndex(rememberedIndex)
      } else {
        setSelectedIndex(0)
      }
    }
  }, [keyboardMode, filteredPages.length, currentMyPage.name, navigationMemory])

  // Handle keyboard navigation for child pages
  useEffect(() => {
    if (!keyboardMode) return

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault()
          if (filteredPages.length > 0) {
            setSelectedIndex((prev) =>
              prev < filteredPages.length - 1 ? prev + 1 : 0
            )
          }
          break
        case "ArrowUp":
          event.preventDefault()
          if (filteredPages.length > 0) {
            setSelectedIndex((prev) =>
              prev > 0 ? prev - 1 : filteredPages.length - 1
            )
          }
          break
        case "ArrowRight":
          event.preventDefault()
          // Navigate into selected child page (only if it exists)
          if (filteredPages.length > 0 && filteredPages[selectedIndex]) {
            // Remember this selection for when we return to this parent page
            const currentPagePath =
              currentMyPage.name === "/" ? "" : currentMyPage.name.slice(1)
            setNavigationMemory((prev) =>
              new Map(prev).set(currentPagePath, selectedIndex)
            )

            editor.setCurrentPage(filteredPages[selectedIndex])
            // Stay in keyboard mode for continued navigation
          }
          break
        case "ArrowLeft":
          event.preventDefault()
          // Navigate to parent page (only if not at root)
          if (currentMyPage.name !== "/") {
            // Remember which child page we're navigating away from
            const currentPagePath =
              currentMyPage.name === "/" ? "" : currentMyPage.name.slice(1)
            setNavigationMemory((prev) =>
              new Map(prev).set(currentPagePath, selectedIndex)
            )

            const parentPath =
              currentMyPage.my.parentPath === ""
                ? "/"
                : `/${currentMyPage.my.parentPath}`
            const parentPage = myPages.find((p) => p.name === parentPath)
            if (parentPage) {
              editor.setCurrentPage(parentPage)
              // Stay in keyboard mode for continued navigation
            }
          }
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [
    keyboardMode,
    filteredPages,
    selectedIndex,
    editor,
    currentMyPage,
    myPages,
    navigationMemory,
  ])

  return (
    <div
      className={`
        fixed top-50px left-20px
        p2
        space-y-2
        bg-red-900
        text-lg font-mono
        text-white
        transition-all duration-200
        ${keyboardMode ? "ring-2 ring-blue-500 ring-opacity-75 p-2" : ""}
      `}
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

      {filteredPages.map((page, index) => {
        // Calculate child count for this page
        // For a page "/projects", we want to find pages where parentPath === "projects"
        const pagePath = page.name.slice(1) // Remove leading slash from "/projects" -> "projects"
        const childCount = myPages.filter(
          (p) => p.my.parentPath === pagePath
        ).length

        return (
          <NavItem
            key={page.id}
            page={page}
            currentPage={currentMyPage}
            editor={editor}
            isSelected={keyboardMode && index === selectedIndex}
            childCount={childCount}
          />
        )
      })}
    </div>
  )
}
