import { Editor } from "tldraw"
import type { MyPage } from "./nav-types"

interface BreadcrumbProps {
  editor: Editor
  currentPage: MyPage
  allPages: MyPage[]
}

export function Breadcrumb({ editor, currentPage, allPages }: BreadcrumbProps) {
  // Build breadcrumb items
  const breadcrumbItems = []

  if (currentPage.name === "/") {
    // Root page - just show "root"
    breadcrumbItems.push({
      label: "root",
      path: "/",
      isLast: true,
    })
  } else {
    // Split the current page path into segments (excluding root)
    const pathSegments = currentPage.name.split("/").filter(Boolean)

    // Add root link first
    breadcrumbItems.push({
      label: "root",
      path: "/",
      isLast: false,
    })

    // Add each segment
    let currentPath = ""
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`
      breadcrumbItems.push({
        label: segment,
        path: currentPath,
        isLast: index === pathSegments.length - 1,
      })
    })
  }

  return (
    <div className="flex items-center space-x-1">
      {breadcrumbItems.map((item, index) => {
        const page = allPages.find((p) => p.name === item.path)
        const isClickable = page && !item.isLast

        return (
          <span key={item.path} className="flex items-center">
            {index > 0 && <span className="mx-1">&rarr;</span>}
            <span
              className={`${
                isClickable
                  ? "cursor-pointer hover:underline"
                  : item.isLast
                  ? "font-bold underline"
                  : "opacity-50"
              }`}
              onClick={() => {
                if (page && !item.isLast) {
                  editor.setCurrentPage(page)
                }
              }}
            >
              {item.label}
            </span>
          </span>
        )
      })}
    </div>
  )
}
