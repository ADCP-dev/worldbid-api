import type { NavMenu } from "~/types/nav";
import { watch } from "vue";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>("nav:menuItems", () => []);
  const localePath = useLocalePath();

  const addUiAppMenu = () => {
    if (
      config.public.env !== "production" &&
      !menuItems.value.find((item) => item.heading === "UI App")
    ) {
      menuItems.value.push({
        heading: "UI App",
        items: [
          {
            title: "Components",
            icon: "Component",
            children: [
              {
                title: "Data Table",
                icon: "Table",
                link: localePath("/app/components/data-table-demo"),
              },
              {
                title: "Form",
                icon: "SquarePen",
                link: localePath("/app/components/form-custom-demo"),
              },
              {
                title: "Rich Editor",
                icon: "FileText",
                link: localePath("/app/components/rich-editor-demo"),
              },
            ],
          },
        ],
      });
    }
  };

  addUiAppMenu();

  watch(
    () => authStore.isAuthenticated,
    () => {
      addUiAppMenu();
    },
  );
});
