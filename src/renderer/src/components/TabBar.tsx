import { useDock, type Tab } from '../lib/dock'
import { Icon, type IconName } from './Icon'
import { t } from '../lib/i18n'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'progetti', label: 'Progetti', icon: 'folder' },
  { id: 'scene', label: 'Giochi', icon: 'scene' },
  { id: 'postazione', label: 'Postazione', icon: 'sliders' }
]

export function TabBar({ tab }: { tab: Tab }) {
  const { setTab, openPanel, config } = useDock()
  // Ordine e schede visibili dalle impostazioni
  const tabs = config.tabOrder
    .map((id) => TABS.find((x) => x.id === id))
    .filter((x): x is (typeof TABS)[number] => !!x)
    .filter((x) => !(x.id === 'scene' || x.id === 'postazione') || config.tabs[x.id])
  return (
    <nav
      className="grid h-16 shrink-0 gap-2 px-4 pb-2"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab_) => {
        const active = tab_.id === tab
        return (
          <button
            key={tab_.id}
            type="button"
            onClick={() => {
              setTab(tab_.id)
              openPanel(null)
            }}
            className={`flex items-center justify-center gap-2.5 rounded-[14px] text-base ${
              active ? 'bg-accent-tint font-semibold text-accent-text' : 'font-medium text-tab'
            }`}
          >
            <Icon name={tab_.icon} size={22} />
            {t(tab_.label)}
          </button>
        )
      })}
    </nav>
  )
}
