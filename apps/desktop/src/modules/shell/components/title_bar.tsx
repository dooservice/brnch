import { GitBranchIcon, SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import DropdownMenu from '@/components/dropdown_menu'
import Kbd from '@/components/kbd'
import { useDialog } from '@/hooks/use_dialog'
import WindowControls from './window_controls'

/** The window's own top bar: menus, the quick search and the window buttons. */
export default function TitleBar() {
  const { t } = useTranslation('shell')
  const navigate = useNavigate()
  const palette = useDialog('palette')
  const addProject = useDialog('add-project')
  const newRun = useDialog('new-run')
  const about = useDialog('about')
  const edit = (command: 'copy' | 'cut' | 'selectAll') => () => void document.execCommand(command)

  return (
    <header data-tauri-drag-region className="flex h-9 shrink-0 items-center gap-1.5 border-b border-line bg-side pl-3">
      <span className="mr-2 flex items-center gap-2 font-bold"><GitBranchIcon size={16} />brnch</span>
      <DropdownMenu label={t('menu.file')} entries={[{ label: t('menu.addProject'), onSelect: () => addProject.show() }, { label: t('menu.settings'), shortcut: 'Ctrl ,', onSelect: () => navigate('/settings') }]} />
      <DropdownMenu label={t('menu.edit')} entries={[{ label: t('menu.copy'), shortcut: 'Ctrl C', onSelect: edit('copy') }, { label: t('menu.cut'), shortcut: 'Ctrl X', onSelect: edit('cut') }, { label: t('menu.selectAll'), shortcut: 'Ctrl A', onSelect: edit('selectAll') }]} />
      <DropdownMenu label={t('menu.view')} entries={[{ label: t('menu.palette'), shortcut: 'Ctrl K', onSelect: () => palette.show() }]} />
      <DropdownMenu label={t('menu.agents')} entries={[{ label: t('menu.newRun'), shortcut: 'Ctrl N', onSelect: () => newRun.show() }]} />
      <DropdownMenu label={t('menu.help')} entries={[{ label: t('menu.about'), onSelect: () => about.show() }]} />
      <div data-tauri-drag-region className="flex flex-1 justify-center">
        <button type="button" onClick={() => palette.show()} className="flex h-6 w-96 items-center gap-2 rounded-md border border-line px-2.5 text-muted hover:text-ink">
          <SearchIcon size={14} />
          <span className="flex-1 text-left">{t('search')}</span>
          <Kbd>Ctrl K</Kbd>
        </button>
      </div>
      <WindowControls />
    </header>
  )
}
