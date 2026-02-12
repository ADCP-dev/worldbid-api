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
        link: "/settings/profile",
      },
    ],
  };

  const navMenu = computed<NavMenu[]>(() => {
    const menu: NavMenu[] = [baseGeneral];

    if (authStore.isAdmin) {
      menu.push({
        heading: "Admin",
        items: [
          {
            title: "Dashboard",
            icon: "House",
            link: "/admin/dashboard",
            new: true,
          },
        ],
      });
    }

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
                link: "/components/accordion",
              },
              {
                title: "Alert",
                icon: "circle",
                link: "/components/alert",
              },
              {
                title: "Alert Dialog",
                icon: "circle",
                link: "/components/alert-dialog",
              },
              {
                title: "Aspect Ratio",
                icon: "circle",
                link: "/components/aspect-ratio",
              },
              {
                title: "Avatar",
                icon: "circle",
                link: "/components/avatar",
              },
              {
                title: "Badge",
                icon: "circle",
                link: "/components/badge",
              },
              {
                title: "Breadcrumb",
                icon: "circle",
                link: "/components/breadcrumb",
              },
              {
                title: "Button",
                icon: "circle",
                link: "/components/button",
              },
              {
                title: "Calendar",
                icon: "circle",
                link: "/components/calendar",
              },
              {
                title: "Card",
                icon: "circle",
                link: "/components/card",
              },
              {
                title: "Carousel",
                icon: "circle",
                link: "/components/carousel",
              },
              {
                title: "Checkbox",
                icon: "circle",
                link: "/components/checkbox",
              },
              {
                title: "Collapsible",
                icon: "circle",
                link: "/components/collapsible",
              },
              {
                title: "Combobox",
                icon: "circle",
                link: "/components/combobox",
              },
              {
                title: "Command",
                icon: "circle",
                link: "/components/command",
              },
              {
                title: "Context Menu",
                icon: "circle",
                link: "/components/context-menu",
              },
              {
                title: "Dialog",
                icon: "circle",
                link: "/components/dialog",
              },
              {
                title: "Drawer",
                icon: "circle",
                link: "/components/drawer",
              },
              {
                title: "Dropdown Menu",
                icon: "circle",
                link: "/components/dropdown-menu",
              },
              {
                title: "Form",
                icon: "circle",
                link: "/components/form",
              },
              {
                title: "Hover Card",
                icon: "circle",
                link: "/components/hover-card",
              },
              {
                title: "Input",
                icon: "circle",
                link: "/components/input",
              },
              {
                title: "Label",
                icon: "circle",
                link: "/components/label",
              },
              {
                title: "Menubar",
                icon: "circle",
                link: "/components/menubar",
              },
              {
                title: "Navigation Menu",
                icon: "circle",
                link: "/components/navigation-menu",
              },
              {
                title: "Number Field",
                icon: "circle",
                link: "/components/number-field",
              },
              {
                title: "Pagination",
                icon: "circle",
                link: "/components/pagination",
              },
              {
                title: "PIN Input",
                icon: "circle",
                link: "/components/pin-input",
              },
              {
                title: "Popover",
                icon: "circle",
                link: "/components/popover",
              },
              {
                title: "Progress",
                icon: "circle",
                link: "/components/progress",
              },
              {
                title: "Radio Group",
                icon: "circle",
                link: "/components/radio-group",
              },
              {
                title: "Range Calendar",
                icon: "circle",
                link: "/components/range-calendar",
              },
              {
                title: "Resizable",
                icon: "circle",
                link: "/components/resizable",
              },
              {
                title: "Scroll Area",
                icon: "circle",
                link: "/components/scroll-area",
              },
              {
                title: "Select",
                icon: "circle",
                link: "/components/select",
              },
              {
                title: "Separator",
                icon: "circle",
                link: "/components/separator",
              },
              {
                title: "Sheet",
                icon: "circle",
                link: "/components/sheet",
              },
              {
                title: "Skeleton",
                icon: "circle",
                link: "/components/skeleton",
              },
              {
                title: "Slider",
                icon: "circle",
                link: "/components/slider",
              },
              {
                title: "Sonner",
                icon: "circle",
                link: "/components/sonner",
              },
              {
                title: "Stepper",
                icon: "circle",
                link: "/components/stepper",
              },
              {
                title: "Switch",
                icon: "circle",
                link: "/components/switch",
              },
              {
                title: "Table",
                icon: "circle",
                link: "/components/table",
              },
              {
                title: "Tabs",
                icon: "circle",
                link: "/components/tabs",
              },
              {
                title: "Tags Input",
                icon: "circle",
                link: "/components/tags-input",
              },
              {
                title: "Textarea",
                icon: "circle",
                link: "/components/textarea",
              },
              {
                title: "Toggle",
                icon: "circle",
                link: "/components/toggle",
              },
              {
                title: "Toggle Group",
                icon: "circle",
                link: "/components/toggle-group",
              },
              {
                title: "Tooltip",
                icon: "circle",
                link: "/components/tooltip",
              },
            ],
          },
        ],
      });
    }

    return menu;
  });

  const navMenuBottom = computed<NavMenuItems>(() => []);

  return { navMenu, navMenuBottom };
}
