import { Editor, type TLPage } from "tldraw"
import { useState, useEffect, useRef, useMemo } from "react"
import { useStore } from "@nanostores/react"
import { keyboardModeStore, setKeyboardMode } from "./stores"

type MyPage = TLPage & {
  my: {
    name: string
    parentPath: string
  }
}

/**
 * Convert TLPage to MyPage format (same as in nav.tsx)
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

/**
 * Get search score for fuzzy matching (higher is better)
 */
function getSearchScore(query: string, text: string): number {
  if (!query) return 0

  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()

  let score = 0
  let queryIndex = 0
  let consecutiveMatches = 0

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      score += 1
      // Bonus for consecutive matches
      consecutiveMatches++
      score += consecutiveMatches * 0.5
      // Bonus for matches at word boundaries
      if (i === 0 || textLower[i - 1] === "/" || textLower[i - 1] === " ") {
        score += 2
      }
      queryIndex++
    } else {
      consecutiveMatches = 0
    }
  }

  return queryIndex === queryLower.length ? score : -1
}

interface CommandPaletteProps {
  editor: Editor
  pages: TLPage[]
}

export function CommandPalette({ editor, pages }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const keyboardMode = useStore(keyboardModeStore)

  // Convert pages to MyPage format
  const myPages = useMemo(
    () =>
      pages
        .map(getMyPageSingle)
        .sort((a, b) => a.my.name.localeCompare(b.my.name)),
    [pages]
  )

  // Filter and score pages based on search query
  const filteredPages = useMemo(() => {
    if (!query.trim()) {
      return myPages.slice(0, 10) // Show first 10 pages when no query
    }

    const scored = myPages
      .map((page) => ({
        page,
        score:
          getSearchScore(query, page.name) +
          getSearchScore(query, page.my.name),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // Limit to top 10 results

    return scored.map((item) => item.page)
  }, [myPages, query])

  // Handle keyboard shortcuts and custom events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // If palette is open, intercept Escape immediately and stop other listeners
      if (isOpen && event.key === "Escape") {
        event.preventDefault()
        // Prevent other keydown listeners (e.g., Controls) on the same target
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation()
        } else {
          event.stopPropagation()
        }
        setIsOpen(false)
        setQuery("")
        // Reactivate keyboard mode when closing palette with Escape
        setKeyboardMode(true)
        return
      }

      // Space to open palette (when not typing in an input)
      if (event.key === " " && event.target === document.body && !isOpen) {
        event.preventDefault()
        event.stopPropagation()
        setIsOpen(true)
        setQuery("")
        setSelectedIndex(0)
        // Deactivate keyboard mode when opening search for user input
        setKeyboardMode(false)
        return
      }

      if (!isOpen) return

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault()
          setSelectedIndex((prev) =>
            prev < filteredPages.length - 1 ? prev + 1 : 0
          )
          break
        case "ArrowUp":
          event.preventDefault()
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredPages.length - 1
          )
          break
        case "Enter":
          event.preventDefault()
          if (filteredPages[selectedIndex]) {
            editor.setCurrentPage(filteredPages[selectedIndex])
            setIsOpen(false)
            setQuery("")
          }
          break
      }
    }

    const handleCustomEvent = () => {
      if (!isOpen) {
        setIsOpen(true)
        setQuery("")
        setSelectedIndex(0)
        // Deactivate keyboard mode when opening search for user input
        setKeyboardMode(false)
      }
    }

    // Use capture so this handler runs before bubble-phase listeners in other components
    document.addEventListener("keydown", handleKeyDown, { capture: true })
    document.addEventListener(
      "openCommandPalette",
      handleCustomEvent as EventListener
    )
    return () => {
      document.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      } as any)
      document.removeEventListener(
        "openCommandPalette",
        handleCustomEvent as EventListener
      )
    }
  }, [isOpen, filteredPages, selectedIndex, editor, keyboardMode])

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Reset selected index when filtered pages change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredPages])

  // Scroll selected item into view
  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex]
    if (selectedItem) {
      selectedItem.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      })
    }
  }, [selectedIndex])

  // Initialize item refs array
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, filteredPages.length)
  }, [filteredPages.length])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
      <div
        ref={paletteRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden"
      >
        {/* Search input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages..."
            className="w-full px-3 py-2 text-lg border-none outline-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto">
          {filteredPages.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No pages found
            </div>
          ) : (
            filteredPages.map((page, index) => {
              const pathParts = page.name.split("/").filter(Boolean)
              const baseName = pathParts[pathParts.length - 1] || "root"
              const parentPath =
                pathParts.length > 1
                  ? "/" + pathParts.slice(0, -1).join("/")
                  : ""

              return (
                <div
                  key={page.id}
                  ref={(el) => {
                    itemRefs.current[index] = el
                  }}
                  className={`px-4 py-2 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                    index === selectedIndex
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                  onClick={() => {
                    editor.setCurrentPage(page)
                    setIsOpen(false)
                    setQuery("")
                  }}
                >
                  <div className="flex items-center text-sm">
                    {parentPath && (
                      <span className="text-gray-500 dark:text-gray-400">
                        {parentPath}/
                      </span>
                    )}
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {baseName}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer with instructions */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
            <span>↑↓ to navigate</span>
            <span>Enter to select</span>
            <span>Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
