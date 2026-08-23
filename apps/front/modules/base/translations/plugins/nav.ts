import type { NavMenu } from "~/types/nav";
import { watch } from "vue";

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>("nav:menuItems", () => []);
  const localePath = useLocalePath();

  const addTranslationsMenu = () => {
    if (
      authStore.isAdmin &&
      !menuItems.value.find(
        (item) => item.heading === "mod.nav.translations_heading",
      )
    ) {
      menuItems.value.push({
        heading: "mod.nav.translations_heading",
        order: 96,
        items: [
          {
            title: "mod.nav.languages",
            icon: "Globe",
            link: localePath("/admin/translations/langs"),
            order: 0,
          },
          {
            title: "mod.nav.all_translations",
            icon: "FileText",
            link: localePath("/admin/translations"),
            order: 10,
          },
        ],
      });
    }
  };

  addTranslationsMenu();

  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addTranslationsMenu();
      }
    },
  );
});
