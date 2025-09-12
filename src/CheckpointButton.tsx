import { Editor } from "tldraw"
import { createCheckpoint } from "./PersistenceManager"

interface CheckpointButtonProps {
  editor: Editor
}

export function CheckpointButton({ editor }: CheckpointButtonProps) {
  const handleCheckpoint = () => {
    createCheckpoint(editor)
  }

  return (
    <button
      onClick={handleCheckpoint}
      className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded cursor-pointer"
      title="Create a checkpoint backup"
    >
      💾
    </button>
  )
}
