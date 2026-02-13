import type { NavMenu } from "~/types/nav";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();

  // Only register in dev/staging/local environments
  if (["development", "staging", "local"].includes(config.public.env)) {
    // Get the shared state specific to nav menu items
    const menuItems = useState<NavMenu[]>("nav:menuItems", () => []);

    // Push the Custom Components menu
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
              link: "/app/components/data-table-demo",
            },
            {
              title: "Form",
              icon: "SquarePen",
              link: "/app/components/form-custom-demo",
            },
            {
              title: "Rich Editor",
              icon: "FileText",
              link: "/app/components/rich-editor-demo",
            },
          ],
        },
      ],
    });
  }
});
