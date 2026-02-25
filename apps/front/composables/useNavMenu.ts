import type { NavMenu, NavMenuItems } from "~/types/nav";

export function useNavMenu() {
  const authStore = useAuthStore();
  const config = useRuntimeConfig();

  const baseGeneral: NavMenu = {
    heading: "General",
    items: [
      {
        title: "Home",
        icon: "House",
        link: "/app",
      },
      {
        title: "Settings",
        icon: "Settings",
        link: "/app/settings/profile",
      },
    ],
  };

  const navMenu = computed<NavMenu[]>(() => {
    const menu: NavMenu[] = [baseGeneral];

    // if (authStore.isAdmin) {
    //   menu.push({
    //     heading: "Admin",
    //     items: [
    //       {
    //         title: "Dashboard",
    //         icon: "House",
    //         link: "/admin/dashboard",
    //         new: true,
    //       },
    //     ],
    //   });
    // }

    // Dynamic menu items from modules
    const dynamicItems = useState<NavMenu[]>("nav:menuItems", () => []);

    // Merge base items with dynamic items
    dynamicItems.value.forEach((item) => {
      menu.push(item);
    });

    return menu;
  });

  const navMenuBottom = computed<NavMenuItems>(() => []);

  return { navMenu, navMenuBottom };
}
