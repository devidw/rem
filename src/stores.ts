import { atom } from "nanostores"

export const keyboardModeStore = atom<boolean>(false)

export const setKeyboardMode = (mode: boolean) => {
  keyboardModeStore.set(mode)
}

export const toggleKeyboardMode = () => {
  keyboardModeStore.set(!keyboardModeStore.get())
}
