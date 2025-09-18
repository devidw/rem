import { useEditor } from "tldraw"
import { useState } from "react"
import { loadSnapshot } from "tldraw"

interface Checkpoint {
  folderName: string
  timestamp: string
  assetCount: number
}

interface RestoreComponentProps {
  className?: string
  title?: string
  children?: React.ReactNode
  showLabel?: boolean
}

export function RestoreComponent({
  className: providedClassName,
  title = "Restore from backup",
  children: providedChildren,
  showLabel = false,
}: RestoreComponentProps) {
  const defaultClassName = showLabel
    ? "px-2 py-1 flex items-center justify-center text-gray-800 text-xs border border-gray-400 cursor-pointer font-mono"
    : "w-6 h-6 flex items-center justify-center text-gray-800 text-xs border border-gray-400 cursor-pointer font-mono"
  const defaultChildren = showLabel ? "Restore" : "&lt;-"

  const className = providedClassName || defaultClassName
  const children = providedChildren || defaultChildren
  const editor = useEditor()
  const [isLoading, setIsLoading] = useState(false)

  const getCheckpoints = async (): Promise<Checkpoint[]> => {
    try {
      const response = await fetch("http://localhost:3001/api/checkpoints")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      return data.checkpoints || []
    } catch (error) {
      console.error("Failed to get checkpoints:", error)
      return []
    }
  }

  const restoreFromCheckpoint = async (backupFolder: string): Promise<void> => {
    try {
      setIsLoading(true)

      // Fetch the backup snapshot directly
      const response = await fetch(
        `http://localhost:3001/api/restore/${backupFolder}`,
        {
          method: "GET", // Use GET to just fetch the snapshot data
          headers: {
            "Content-Type": "application/json",
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const { snapshot } = await response.json()

      if (!snapshot) {
        throw new Error("No snapshot data received")
      }

      // Load the snapshot directly into the editor's store
      // This will update the in-memory state without page reload
      loadSnapshot(editor.store, snapshot)

      console.log("Restored from checkpoint:", backupFolder)

      // Optional: Save the restored state as current
      await fetch("http://localhost:3001/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snapshot,
          checkpoint: false,
        }),
      })
    } catch (error) {
      console.error("Failed to restore from checkpoint:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestore = async () => {
    if (isLoading) return

    try {
      const checkpoints = await getCheckpoints()

      if (checkpoints.length === 0) {
        alert("No backups available")
        return
      }

      // Create a simple prompt for backup selection
      const selectedIndex = window.prompt(
        "Select a backup to restore from:\n\n" +
          checkpoints
            .map(
              (checkpoint: Checkpoint, index: number) =>
                `${index + 1}. ${checkpoint.timestamp} (${
                  checkpoint.assetCount
                } assets)`
            )
            .join("\n") +
          "\n\nEnter the number (1-" +
          checkpoints.length +
          ") or 'cancel':"
      )

      if (!selectedIndex || selectedIndex.toLowerCase() === "cancel") {
        return
      }

      const index = parseInt(selectedIndex) - 1
      if (isNaN(index) || index < 0 || index >= checkpoints.length) {
        alert("Invalid selection")
        return
      }

      const selectedCheckpoint = checkpoints[index]

      if (
        window.confirm(
          `Are you sure you want to restore from backup:\n\n` +
            `Date: ${selectedCheckpoint.timestamp}\n` +
            `Assets: ${selectedCheckpoint.assetCount}\n\n` +
            `This will replace your current work!`
        )
      ) {
        await restoreFromCheckpoint(selectedCheckpoint.folderName)
        alert("Backup restored successfully!")
      }
    } catch (error) {
      console.error("Failed to restore:", error)
      alert(
        "Failed to restore from backup: " +
          (error instanceof Error ? error.message : String(error))
      )
    }
  }

  return (
    <button
      onClick={handleRestore}
      disabled={isLoading}
      className={className}
      title={title}
    >
      {isLoading ? "⏳" : children}
    </button>
  )
}
