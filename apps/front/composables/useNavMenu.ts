import type { NavMenu, NavMenuItems } from "~/types/nav";
import { useI18n } from "vue-i18n";

export function useNavMenu() {
  const authStore = useAuthStore();
  const config = useRuntimeConfig();
  const { t } = useI18n();
  const localePath = useLocalePath();

  const navMenu = computed<NavMenu[]>(() => {
    const baseGeneral: NavMenu = {
      heading: t("base.nav.general"),
      items: [
        {
          title: t("base.nav.home"),
          icon: "House",
          link: localePath("/app"),
        },
        {
          title: t("base.nav.settings"),
          icon: "Settings",
          link: localePath("/app/settings/profile"),
        },
      ],
    };

    const menu: NavMenu[] = [baseGeneral];

    if (authStore.isAdmin) {
      menu.push({
        heading: t("base.nav.admin"),
        items: [
          {
            title: t("base.nav.users"),
            icon: "Users",
            link: localePath("/app/users"),
          },
        ],
      });
    }

    // Dynamic menu items from modules
    const dynamicItems = useState<NavMenu[]>("nav:menuItems", () => []);

    // Merge base items with dynamic items and translate
    dynamicItems.value.forEach((item) => {
      menu.push({
        ...item,
        heading: item.heading ? t(item.heading) : undefined,
        items: item.items.map(subItem => ({
          ...subItem,
          title: t(subItem.title),
        }))
      });
    });

    return menu;
  });

  const navMenuBottom = computed<NavMenuItems>(() => []);

  return { navMenu, navMenuBottom };
}
