import type { NavMenu } from "~/types/nav";
import { watch } from "vue";

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>("nav:menuItems", () => []);
  const localePath = useLocalePath();

  const addErrorTrackerMenu = () => {
    if (
      authStore.isAdmin &&
      !menuItems.value.find((item) => item.heading === "System")
    ) {
      menuItems.value.push({
        heading: "System",
        order: 98,
        items: [
          {
            title: "base.nav.error_logs",
            icon: "Bug",
            link: localePath("/admin/errors"),
            order: 0,
          },
        ],
      });
    }
  };

  addErrorTrackerMenu();

  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addErrorTrackerMenu();
      }
    },
  );
});
