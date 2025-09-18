import { Editor } from "tldraw"
import { useEffect, useRef, useState } from "react"
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
  const [secondaryExpanded, setSecondaryExpanded] = useState(false)
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
          className="w-6 h-6 flex items-center justify-center text-gray-800 text-xs border border-gray-400 cursor-pointer font-mono"
          title={keyboardMode ? "Search (Space)" : "Search"}
        >
          ⎵
        </button>

        {/* Secondary controls inline - only on root page */}
        {isRootPage && (
          <>
            {!secondaryExpanded ? (
              <button
                onClick={() => setSecondaryExpanded(true)}
                className="w-6 h-6 flex items-center justify-center text-gray-800 text-xs border border-gray-400 cursor-pointer font-mono"
                title="Show more options"
              >
                ...
              </button>
            ) : (
              <>
                <CheckpointButton editor={editor} showLabel={true} />
                <RestoreComponent showLabel={true} />
                <ReexportAssetsButton editor={editor} showLabel={true} />
                <button
                  onClick={() => setSecondaryExpanded(false)}
                  className="w-6 h-6 flex items-center justify-center text-gray-800 text-xs border border-gray-400 cursor-pointer font-mono"
                  title="Hide options"
                >
                  ^
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
