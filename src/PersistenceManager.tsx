import { useEditor } from "tldraw"
import { useEffect, useRef } from "react"
import { getSnapshot } from "tldraw"

export function PersistenceManager() {
  const editor = useEditor()
  const saveTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const saveToServer = async (checkpoint = false) => {
      try {
        const snapshot = getSnapshot(editor.store)

        const response = await fetch("http://localhost:3001/api/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            snapshot,
            checkpoint,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        console.log(
          "Snapshot saved to server",
          checkpoint ? "(with checkpoint)" : ""
        )
      } catch (error) {
        console.error("Failed to save snapshot:", error)
      }
    }

    const handleStoreChange = () => {
      // Debounce saves to avoid too many requests
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveToServer(false) // Regular save, no checkpoint
      }, 2000) // Save after 2 seconds of inactivity
    }

    // Listen for store changes
    const unsubscribe = editor.store.listen(handleStoreChange, {
      source: "user",
      scope: "all",
    })

    // Initial save when component mounts
    saveToServer(false)

    return () => {
      unsubscribe()
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [editor])

  // This component doesn't render anything
  return null
}

// Function to manually trigger a checkpoint
export const createCheckpoint = async (editor: any) => {
  try {
    const snapshot = getSnapshot(editor.store)

    const response = await fetch("http://localhost:3001/api/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snapshot,
        checkpoint: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log("Checkpoint created successfully")
    alert("Checkpoint created successfully!")
  } catch (error) {
    console.error("Failed to create checkpoint:", error)
    alert("Failed to create checkpoint")
  }
}
