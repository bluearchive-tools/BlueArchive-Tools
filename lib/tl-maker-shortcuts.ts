export const TL_MAKER_SHORTCUT_STORAGE_KEY = 'tlMaker:shortcuts'

export const defaultShortcuts = (preferMeta: boolean) => ({
  createProject: preferMeta ? 'Cmd+Shift+N' : 'Ctrl+Shift+N',
  saveProject: preferMeta ? 'Cmd+Shift+S' : 'Ctrl+Shift+S',
  loadProject: preferMeta ? 'Cmd+Shift+O' : 'Ctrl+Shift+O',
  openSettings: preferMeta ? 'Cmd+Shift+,' : 'Ctrl+Shift+,',
  undo: preferMeta ? 'Cmd+Z' : 'Ctrl+Z',
  redo: preferMeta ? 'Cmd+Shift+Z' : 'Ctrl+Shift+Z',
  addSkill: preferMeta ? 'Cmd+Shift+A' : 'Ctrl+Shift+A',
  addEvent: preferMeta ? 'Cmd+Shift+E' : 'Ctrl+Shift+E',
  addRow: preferMeta ? 'Cmd+Shift+R' : 'Ctrl+Shift+R',
  addEnemyRow: preferMeta ? 'Cmd+Shift+D' : 'Ctrl+Shift+D',
  movePlayheadLeft: preferMeta ? 'Cmd+Shift+ArrowLeft' : 'Ctrl+Shift+ArrowLeft',
  movePlayheadRight: preferMeta ? 'Cmd+Shift+ArrowRight' : 'Ctrl+Shift+ArrowRight',
  cut: preferMeta ? 'Cmd+X' : 'Ctrl+X',
  copy: preferMeta ? 'Cmd+C' : 'Ctrl+C',
  paste: preferMeta ? 'Cmd+V' : 'Ctrl+V',
  delete: preferMeta ? 'Backspace' : 'Delete',
  toggleProMode: preferMeta ? 'Cmd+Shift+P' : 'Ctrl+Shift+P',
  openAlign: preferMeta ? 'Cmd+Shift+L' : 'Ctrl+Shift+L',
  openHistory: preferMeta ? 'Cmd+Shift+H' : 'Ctrl+Shift+H',
  openExTemplate: preferMeta ? 'Cmd+Shift+T' : 'Ctrl+Shift+T',
  openPluginManager: preferMeta ? 'Cmd+Shift+M' : 'Ctrl+Shift+M',
  openSquadMenu: preferMeta ? 'Cmd+Shift+1' : 'Ctrl+Shift+1',
  openGroupMenu: preferMeta ? 'Cmd+Shift+2' : 'Ctrl+Shift+2',
  openSquadEditor: preferMeta ? 'Cmd+Shift+G' : 'Ctrl+Shift+G',
  toggleDamageCalc: preferMeta ? 'Cmd+Shift+C' : 'Ctrl+Shift+C',
  toggleTextTL: preferMeta ? 'Cmd+Shift+Y' : 'Ctrl+Shift+Y',
  toggleCostLines: preferMeta ? 'Cmd+Shift+K' : 'Ctrl+Shift+K',
  importSquad: preferMeta ? 'Cmd+Shift+I' : 'Ctrl+Shift+I',
})

export type TlMakerShortcutSettings = ReturnType<typeof defaultShortcuts>
export type TlMakerShortcutKey = keyof TlMakerShortcutSettings

type ShortcutItem = {
  key: TlMakerShortcutKey
  label: string
}

export const TL_MAKER_SHORTCUT_CATEGORIES: Array<{ title: string; items: ShortcutItem[] }> = [
  {
    title: 'プロジェクト',
    items: [
      { key: 'createProject', label: '新規TL' },
      { key: 'saveProject', label: 'TL保存' },
      { key: 'loadProject', label: 'TL読み込み' },
      { key: 'openSettings', label: '設定' },
    ],
  },
  {
    title: '編集',
    items: [
      { key: 'undo', label: '元に戻す' },
      { key: 'redo', label: 'やり直す' },
      { key: 'cut', label: 'カット' },
      { key: 'copy', label: 'コピー' },
      { key: 'paste', label: 'ペースト' },
      { key: 'delete', label: '削除' },
    ],
  },
  {
    title: 'タイムライン操作',
    items: [
      { key: 'addSkill', label: 'スキル追加' },
      { key: 'addEvent', label: 'イベント追加' },
      { key: 'addRow', label: '行追加' },
      { key: 'addEnemyRow', label: '敵行追加' },
      { key: 'movePlayheadLeft', label: '再生位置 -0.1s' },
      { key: 'movePlayheadRight', label: '再生位置 +0.1s' },
    ],
  },
  {
    title: '表示・拡張機能',
    items: [
      { key: 'toggleProMode', label: 'プロモード' },
      { key: 'openAlign', label: '整列' },
      { key: 'openHistory', label: '履歴' },
      { key: 'openExTemplate', label: 'EXテンプレ' },
      { key: 'openPluginManager', label: 'プラグイン' },
      { key: 'toggleDamageCalc', label: 'ダメージ計算' },
      { key: 'toggleTextTL', label: 'TLテキスト' },
      { key: 'toggleCostLines', label: 'コスト詳細' },
    ],
  },
  {
    title: '部隊',
    items: [
      { key: 'openSquadMenu', label: '部隊変更' },
      { key: 'openGroupMenu', label: 'グループ変更' },
      { key: 'openSquadEditor', label: '部隊編集' },
      { key: 'importSquad', label: '部隊インポート' },
    ],
  },
]
