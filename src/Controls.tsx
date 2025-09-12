import { Editor } from "tldraw"
import { useEffect, useRef } from "react"
import { useStore } from "@nanostores/react"
import { RestoreComponent } from "./RestoreComponent"
import { AddPageButton } from "./AddPageButton"
import { CheckpointButton } from "./CheckpointButton"
import { ReexportAssetsButton } from "./ReexportAssetsButton"
import { RenamePageButton } from "./RenamePageButton"
import { DeletePageButton } from "./DeletePageButton"
import {
  keyboardModeStore,
  toggleKeyboardMode,
  setKeyboardMode,
} from "./stores"
import type { MyPage } from "./nav-types"

interface ControlsProps {
  editor: Editor
  currentPage: MyPage
  allPages: MyPage[]
}

export function Controls({ editor, currentPage, allPages }: ControlsProps) {
  const keyboardMode = useStore(keyboardModeStore)
  const addPageRef = useRef<HTMLButtonElement>(null)
  const renamePageRef = useRef<HTMLButtonElement>(null)
  const deletePageRef = useRef<HTMLButtonElement>(null)
  const isRootPage = currentPage.name === "/"

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to toggle keyboard mode
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault()
        toggleKeyboardMode()
        return
      }

      // If not in keyboard mode, ignore other shortcuts
      if (!keyboardMode) return

      // Handle keyboard shortcuts for buttons
      switch (event.key.toLowerCase()) {
        case "c":
          event.preventDefault()
          addPageRef.current?.click()
          break
        case "r":
          event.preventDefault()
          if (!isRootPage) {
            renamePageRef.current?.click()
          }
          break
        case "d":
          event.preventDefault()
          if (!isRootPage) {
            deletePageRef.current?.click()
          }
          break
        case "escape":
          event.preventDefault()
          setKeyboardMode(false)
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [keyboardMode, isRootPage])

  return (
    <div className="space-y-2">
      {/* Primary controls - always visible */}
      <div className="flex items-center space-x-2">
        <AddPageButton
          ref={addPageRef}
          editor={editor}
          currentPage={currentPage}
          allPages={allPages}
          showKeyboardHint={keyboardMode}
        />
        <RenamePageButton
          ref={renamePageRef}
          editor={editor}
          currentPage={currentPage}
          allPages={allPages}
          showKeyboardHint={keyboardMode}
        />
        <DeletePageButton
          ref={deletePageRef}
          editor={editor}
          currentPage={currentPage}
          allPages={allPages}
          showKeyboardHint={keyboardMode}
        />
        <button
          onClick={() => {
            // Dispatch custom event to trigger CommandPalette
            const searchEvent = new CustomEvent("openCommandPalette", {
              bubbles: true,
              detail: { fromKeyboardMode: keyboardMode },
            })
            document.dispatchEvent(searchEvent)
          }}
          className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded cursor-pointer"
          title={keyboardMode ? "Search (Space)" : "Search"}
        >
          {keyboardMode ? "⎵" : "🔍"}
        </button>
      </div>

      {/* Secondary controls - only on root page */}
      {isRootPage && (
        <div className="flex items-center space-x-2">
          <CheckpointButton editor={editor} />
          <RestoreComponent />
          <ReexportAssetsButton editor={editor} />
        </div>
      )}
    </div>
  )
}
