import { Tldraw, useEditor } from "tldraw"
import "tldraw/tldraw.css"
import { PageLinkShapeUtil } from "./page-link/PageLinkShapeUtil.tsx"
import { components, uiOverrides } from "./ui-overrides.tsx"
import { PageLinkShapeTool } from "./page-link/PageLinkShapeTool.tsx"
import { Nav } from "./nav.tsx"
import { PersistenceManager } from "./PersistenceManager.tsx"
import { CommandPalette } from "./CommandPalette.tsx"
import { useState, useEffect } from "react"

const customShapes = [PageLinkShapeUtil]
const customTools = [PageLinkShapeTool]

function AppContent() {
  const editor = useEditor()
  const [pages, setPages] = useState(() => editor.getPages())

  useEffect(() => {
    const handleStoreChange = () => {
      const newPages = editor.getPages()
      setPages(newPages)
    }

    const unsubscribe = editor.store.listen(handleStoreChange, {
      source: "user",
      scope: "all",
    })

    return () => unsubscribe()
  }, [editor])

  return (
    <>
      <PersistenceManager />
      <Nav />
      <CommandPalette editor={editor} pages={pages} />
    </>
  )
}

export default function App() {
  return (
    <>
      <div style={{ position: "fixed", inset: 0 }}>
        <Tldraw
          persistenceKey="rem"
          inferDarkMode={true}
          shapeUtils={customShapes}
          tools={customTools}
          overrides={uiOverrides}
          components={components}
          onMount={(editor) => {
            // Register asset upload handler
            editor.registerExternalAssetHandler("file", async (info) => {
              console.log("Asset upload requested:", info)

              try {
                const file = info.file
                const id = `asset_${Date.now()}_${Math.random()
                  .toString(36)
                  .substring(2, 9)}`
                const objectName = `${id}-${file.name}`
                const url = `http://localhost:3001/uploads/${encodeURIComponent(
                  objectName
                )}`

                console.log("Uploading asset:", objectName)

                const response = await fetch(url, {
                  method: "PUT",
                  body: file,
                })

                if (!response.ok) {
                  throw new Error(
                    `Failed to upload asset: ${response.statusText}`
                  )
                }

                console.log("Asset uploaded successfully:", url)

                // Return the uploaded asset info
                return {
                  id: id as any,
                  typeName: "asset",
                  type: "image",
                  props: {
                    name: file.name,
                    src: url,
                    w: 100, // Default dimensions, could be improved
                    h: 100,
                    fileSize: file.size,
                    mimeType: file.type,
                    isAnimated: false,
                  },
                  meta: {},
                }
              } catch (error) {
                console.error("Asset upload failed:", error)
                throw error
              }
            })
          }}
        >
          <AppContent />
        </Tldraw>
      </div>
    </>
  )
}
