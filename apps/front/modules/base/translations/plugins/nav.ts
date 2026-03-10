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
        (item) => item.heading === "base.nav.translations_heading",
      )
    ) {
      menuItems.value.push({
        heading: "base.nav.translations_heading",
        items: [
          {
            title: "base.nav.languages",
            icon: "Globe",
            link: localePath("/admin/translations/langs"),
          },
          {
            title: "base.nav.all_translations",
            icon: "FileText",
            link: localePath("/admin/translations"),
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
