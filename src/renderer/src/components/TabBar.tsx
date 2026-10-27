import { useDock, type Tab } from '../lib/dock'
import { Icon, type IconName } from './Icon'
import { t } from '../lib/i18n'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'progetti', label: 'Progetti', icon: 'folder' },
  { id: 'scene', label: 'Giochi', icon: 'scene' },
  { id: 'postazione', label: 'Postazione', icon: 'sliders' },
  { id: 'sistema', label: 'Sistema', icon: 'chip' }
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
      className="grid h-[68px] shrink-0 gap-1.5 border-t border-divider px-5 py-1.5"
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
            className={`flex flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ${
              active ? 'bg-accent-tint text-accent-text' : 'text-tab'
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
