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
        items: [
          {
            title: "Error Logs",
            icon: "Bug",
            link: localePath("/admin/errors"),
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
