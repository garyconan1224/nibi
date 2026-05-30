import { create } from 'zustand'
import type { EditorView } from '@codemirror/view'

interface LnEditorState {
  cmView: EditorView | null
  setCmView: (v: EditorView | null) => void
  insertAtCursor: (text: string) => boolean
}

export const useLnEditorStore = create<LnEditorState>((set, get) => ({
  cmView: null,

  setCmView: (v) => set({ cmView: v }),

  insertAtCursor: (text) => {
    const view = get().cmView
    if (!view) return false
    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    })
    view.focus()
    return true
  },
}))
