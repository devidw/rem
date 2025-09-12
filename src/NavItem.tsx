import { Editor } from "tldraw"
import type { MyPage } from "./nav-types"

interface NavItemProps {
  page: MyPage
  currentPage: MyPage
  editor: Editor
  isSelected?: boolean
  childCount?: number
}

export function NavItem({
  page,
  currentPage,
  editor,
  isSelected = false,
  childCount = 0,
}: NavItemProps) {
  const theClassName = `
  ${page.id === currentPage.id ? "underline" : ""}
  border-b-2 border-dotted ${
    isSelected ? "border-blue-500" : "border-transparent"
  }
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
        <div className="flex justify-between items-center">
          <span>{page.my.name}</span>
          <div className="flex items-center min-w-0 pl-8">
            <span
              className={`text-xs ${
                isSelected ? "text-blue-400" : "text-gray-500"
              }`}
            >
              {childCount}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
