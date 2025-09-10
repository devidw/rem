import { BaseBoxShapeTool } from "tldraw"

export class PageLinkShapeTool extends BaseBoxShapeTool {
  static override id = "page-link"
  static override initial = "idle"
  override shapeType = "card"
}
