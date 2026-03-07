import type { NavMenu } from "~/types/nav";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();

  // Only register in dev/staging/local environments
  if (config.public.env !== 'production') {
    // Get the shared state specific to nav menu items
    const menuItems = useState<NavMenu[]>("nav:menuItems", () => []);

    const localePath = useLocalePath();

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
});
