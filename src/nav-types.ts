import type { Editor, TLPage } from "tldraw"

export type MyPage = TLPage & {
  my: {
    name: string
    parentPath: string
  }
}

/**
 * tlpage.name is like /a/b/c
 * Extract name and parent path from the page name
 */
export function getMyPageSingle(page: TLPage): MyPage {
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

export function getMyPages(pages: TLPage[]): MyPage[] {
  // Map each page using the single page function
  const myPages = pages.map(getMyPageSingle)

  // Sort by name
  myPages.sort((a, b) => a.my.name.localeCompare(b.my.name))

  return myPages
}

/**
 * Find all child pages (direct and nested) of a given page
 */
export function findAllChildPages(
  parentPage: MyPage,
  allPages: MyPage[]
): MyPage[] {
  const parentPath = parentPage.name === "/" ? "" : parentPage.name.slice(1) // Remove leading slash for non-root

  return allPages.filter((page) => {
    // Skip the parent page itself
    if (page.id === parentPage.id) return false

    // Check if this page is a child (direct or nested) of the parent
    const pagePathWithoutSlash = page.name.slice(1) // Remove leading slash
    return (
      pagePathWithoutSlash.startsWith(parentPath + "/") ||
      (parentPath === "" && page.name !== "/")
    ) // For root page, include all non-root pages
  })
}

/**
 * Delete a page and all its child pages
 */
export function deletePageAndChildren(
  editor: Editor,
  pageToDelete: MyPage,
  allPages: MyPage[]
) {
  const childPages = findAllChildPages(pageToDelete, allPages)
  const pagesToDelete = [pageToDelete, ...childPages]

  // Delete all pages
  pagesToDelete.forEach((page) => {
    editor.deletePage(page)
  })
}
