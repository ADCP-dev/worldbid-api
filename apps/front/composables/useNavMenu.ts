import type { NavMenu, NavMenuItems } from "~/types/nav";

export function useNavMenu() {
  const authStore = useAuthStore();
  const config = useRuntimeConfig();

  const baseGeneral: NavMenu = {
    heading: "General",
    items: [
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

    // Optionally show components menu in dev/staging/local env
    if (["development", "staging", "local"].includes(config.public.env)) {
      // Keep dev components menu minimal to avoid heavy duplication
      menu.push({
        heading: "Components",
        items: [
          {
            title: "Components",
            icon: "Component",
            children: [
              {
                title: "Accordion",
                icon: "circle",
                link: "/app/components/accordion",
              },
              {
                title: "Alert",
                icon: "circle",
                link: "/app/components/alert",
              },
              {
                title: "Alert Dialog",
                icon: "circle",
                link: "/app/components/alert-dialog",
              },
              {
                title: "Aspect Ratio",
                icon: "circle",
                link: "/app/components/aspect-ratio",
              },
              {
                title: "Avatar",
                icon: "circle",
                link: "/app/components/avatar",
              },
              {
                title: "Badge",
                icon: "circle",
                link: "/app/components/badge",
              },
              {
                title: "Breadcrumb",
                icon: "circle",
                link: "/app/components/breadcrumb",
              },
              {
                title: "Button",
                icon: "circle",
                link: "/app/components/button",
              },
              {
                title: "Calendar",
                icon: "circle",
                link: "/app/components/calendar",
              },
              {
                title: "Card",
                icon: "circle",
                link: "/app/components/card",
              },
              {
                title: "Carousel",
                icon: "circle",
                link: "/app/components/carousel",
              },
              {
                title: "Checkbox",
                icon: "circle",
                link: "/app/components/checkbox",
              },
              {
                title: "Collapsible",
                icon: "circle",
                link: "/app/components/collapsible",
              },
              {
                title: "Combobox",
                icon: "circle",
                link: "/app/components/combobox",
              },
              {
                title: "Command",
                icon: "circle",
                link: "/app/components/command",
              },
              {
                title: "Context Menu",
                icon: "circle",
                link: "/app/components/context-menu",
              },
              {
                title: "Dialog",
                icon: "circle",
                link: "/app/components/dialog",
              },
              {
                title: "Drawer",
                icon: "circle",
                link: "/app/components/drawer",
              },
              {
                title: "Dropdown Menu",
                icon: "circle",
                link: "/app/components/dropdown-menu",
              },
              {
                title: "Form",
                icon: "circle",
                link: "/app/components/form",
              },
              {
                title: "Hover Card",
                icon: "circle",
                link: "/app/components/hover-card",
              },
              {
                title: "Input",
                icon: "circle",
                link: "/app/components/input",
              },
              {
                title: "Label",
                icon: "circle",
                link: "/app/components/label",
              },
              {
                title: "Menubar",
                icon: "circle",
                link: "/app/components/menubar",
              },
              {
                title: "Navigation Menu",
                icon: "circle",
                link: "/app/components/navigation-menu",
              },
              {
                title: "Number Field",
                icon: "circle",
                link: "/app/components/number-field",
              },
              {
                title: "Pagination",
                icon: "circle",
                link: "/app/components/pagination",
              },
              {
                title: "PIN Input",
                icon: "circle",
                link: "/app/components/pin-input",
              },
              {
                title: "Popover",
                icon: "circle",
                link: "/app/components/popover",
              },
              {
                title: "Progress",
                icon: "circle",
                link: "/app/components/progress",
              },
              {
                title: "Radio Group",
                icon: "circle",
                link: "/app/components/radio-group",
              },
              {
                title: "Range Calendar",
                icon: "circle",
                link: "/app/components/range-calendar",
              },
              {
                title: "Resizable",
                icon: "circle",
                link: "/app/components/resizable",
              },
              {
                title: "Scroll Area",
                icon: "circle",
                link: "/app/components/scroll-area",
              },
              {
                title: "Select",
                icon: "circle",
                link: "/app/components/select",
              },
              {
                title: "Separator",
                icon: "circle",
                link: "/app/components/separator",
              },
              {
                title: "Sheet",
                icon: "circle",
                link: "/app/components/sheet",
              },
              {
                title: "Skeleton",
                icon: "circle",
                link: "/app/components/skeleton",
              },
              {
                title: "Slider",
                icon: "circle",
                link: "/app/components/slider",
              },
              {
                title: "Sonner",
                icon: "circle",
                link: "/app/components/sonner",
              },
              {
                title: "Stepper",
                icon: "circle",
                link: "/app/components/stepper",
              },
              {
                title: "Switch",
                icon: "circle",
                link: "/app/components/switch",
              },
              {
                title: "Table",
                icon: "circle",
                link: "/app/components/table",
              },
              {
                title: "Tabs",
                icon: "circle",
                link: "/app/components/tabs",
              },
              {
                title: "Tags Input",
                icon: "circle",
                link: "/app/components/tags-input",
              },
              {
                title: "Textarea",
                icon: "circle",
                link: "/app/components/textarea",
              },
              {
                title: "Toggle",
                icon: "circle",
                link: "/app/components/toggle",
              },
              {
                title: "Toggle Group",
                icon: "circle",
                link: "/app/components/toggle-group",
              },
              {
                title: "Tooltip",
                icon: "circle",
                link: "/app/components/tooltip",
              },
            ],
          },
        ],
      });
    }

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
