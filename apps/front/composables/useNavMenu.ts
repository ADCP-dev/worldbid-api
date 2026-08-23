import type { NavMenu, NavMenuItem } from '~/types/nav';
import { useI18n } from 'vue-i18n';
import { useOrderingStore } from '~/composables/useOrderingStore';

export function useNavMenu() {
  const authStore = useAuthStore();
  const orderingStore = useOrderingStore();
  const { t } = useI18n();
  const localePath = useLocalePath();

  const navMenu = computed<NavMenu[]>(() => {
    const baseGeneral: NavMenu = {
      heading: t('mod.nav.general'),
      order: 0,
      items: [
        {
          title: t('mod.nav.home'),
          icon: 'House',
          link: localePath('/app'),
          order: 0,
        },
        {
          title: t('mod.nav.settings'),
          icon: 'Settings',
          link: localePath('/app/settings/profile'),
          order: 10,
        },
      ],
    };

    const menu: NavMenu[] = [baseGeneral];

    if (authStore.isAdmin) {
      menu.push({
        heading: t('mod.nav.admin'),
        order: 200,
        items: [
          {
            title: t('mod.nav.users'),
            icon: 'Users',
            link: localePath('/app/users'),
            order: 0,
          },
        ],
      });
    }

    // Dynamic menu items from modules
    const dynamicItems = useState<NavMenu[]>('nav:menuItems', () => []);

    // Merge base items with dynamic items and translate
    dynamicItems.value.forEach((item) => {
      menu.push({
        ...item,
        heading: item.heading ? t(item.heading) : '',
        items: item.items.map((subItem: NavMenuItem) => {
          if ('title' in subItem) {
            return {
              ...subItem,
              title: t(subItem.title),
            };
          }
          return subItem;
        }),
      });
    });

    // Deterministic ordering: groups ascending by `order` (default 100),
    // then items within each group ascending by `order` (default 100).
    menu.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    menu.forEach((group) => {
      group.items.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    });

    // Admin-configurable override: store wins over plugin `order` defaults.
    return orderingStore.effectiveSidebarGroups(menu);
  });

  return { navMenu };
}