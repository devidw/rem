import { Editor } from "tldraw"
import { createCheckpoint } from "./PersistenceManager"

interface CheckpointButtonProps {
  editor: Editor
  showLabel?: boolean
}

export function CheckpointButton({
  editor,
  showLabel = false,
}: CheckpointButtonProps) {
  const handleCheckpoint = () => {
    createCheckpoint(editor)
  }

  return (
    <button
      onClick={handleCheckpoint}
      className={`${
        showLabel ? "px-2 py-1" : "w-6 h-6"
      } flex items-center justify-center text-gray-800 text-xs border border-gray-400 cursor-pointer font-mono`}
      title="Create a checkpoint backup"
    >
      {showLabel ? "Backup" : "[]"}
    </button>
  )
}
