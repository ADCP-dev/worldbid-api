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
        order: 90,
        items: [
          {
            title: "Components",
            icon: "Component",
            order: 0,
            children: [
              {
                title: "Data Table",
                icon: "Table",
                link: localePath("/app/components/data-table-demo"),
                order: 0,
              },
              {
                title: "Form",
                icon: "SquarePen",
                link: localePath("/app/components/form-custom-demo"),
                order: 10,
              },
              {
                title: "Rich Editor",
                icon: "FileText",
                link: localePath("/app/components/rich-editor-demo"),
                order: 20,
              },
              {
                title: "Form Components",
                icon: "LayoutList",
                link: localePath("/app/components/form-components-demo"),
                order: 30,
              },
              {
                title: "Kanban",
                icon: "Kanban",
                link: localePath("/app/components/kanban-demo"),
                order: 40,
              },
              {
                title: "Calendar",
                icon: "Calendar",
                link: localePath("/app/components/calendar-demo"),
                order: 50,
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
