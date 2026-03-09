import type { NavMenu } from "~/types/nav";

export default defineNuxtPlugin((nuxtApp) => {
  const authStore = useAuthStore();

  if (authStore.isAdmin) {
    const menuItems = useState<NavMenu[]>("nav:menuItems", () => []);

    const localePath = useLocalePath();

    menuItems.value.push({
      heading: "System",
      items: [
        {
          title: "Error Logs",
          icon: "Bug",
          link: localePath("/admin/errors"),
        },
      ],
    });
  }
});
