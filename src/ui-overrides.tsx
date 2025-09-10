import {
  DefaultToolbar,
  DefaultToolbarContent,
  type TLComponents,
  type TLUiOverrides,
  TldrawUiMenuItem,
  useIsToolSelected,
  useTools,
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
} from "tldraw"

export const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.card = {
      id: "page-link",
      icon: "color",
      label: "Page Link",
      // kbd: "p",
      onSelect: () => {
        editor.setCurrentTool("page-link")
      },
    }
    return tools
  },
}

export const components: TLComponents = {
  // Toolbar: (props) => {
  //   const tools = useTools()
  //   const isSelected = useIsToolSelected(tools["page-link"])
  //   return (
  //     <DefaultToolbar {...props}>
  //       <TldrawUiMenuItem {...tools["page-link"]} isSelected={isSelected} />
  //       <DefaultToolbarContent />
  //     </DefaultToolbar>
  //   )
  // },
  // KeyboardShortcutsDialog: (props) => {
  //   const tools = useTools()
  //   return (
  //     <DefaultKeyboardShortcutsDialog {...props}>
  //       <TldrawUiMenuItem {...tools["page-link"]} />
  //       <DefaultKeyboardShortcutsDialogContent />
  //     </DefaultKeyboardShortcutsDialog>
  //   )
  // },
}
