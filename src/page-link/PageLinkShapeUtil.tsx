import { HTMLContainer, ShapeUtil, Rectangle2d, type TLBaseShape } from "tldraw"

type PageLink = TLBaseShape<"link-page", { page: string }>

export class PageLinkShapeUtil extends ShapeUtil<PageLink> {
  static override type = "page-link" as const

  getDefaultProps(): PageLink["props"] {
    return { page: "some-page-id" }
  }

  getGeometry(shape: PageLink) {
    return new Rectangle2d({
      width: 100,
      height: 100,
      isFilled: true,
    })
  }

  component(shape: PageLink) {
    return (
      <HTMLContainer
        style={{
          pointerEvents: "all",
          background: "red",
        }}
      >
        <button
          style={{ pointerEvents: "all" }}
          onClick={() => {
            console.info("click")
          }}
        >
          {shape.props.page}
        </button>
      </HTMLContainer>
    )
  }

  indicator(shape: PageLink) {
    return <rect width={100} height={100} />
  }
}
