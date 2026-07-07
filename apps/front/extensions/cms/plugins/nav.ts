import { watch } from 'vue';
import type { NavMenu } from '~/types/nav';

export default defineNuxtPlugin(() => {
  const menuItems = useState<NavMenu[]>("nav:menuItems", () => []);
  const authStore = useAuthStore();

  const addCmsMenu = () => {
    if (!authStore.isAdmin) return;
    // Evitar duplicados
    if (menuItems.value.find((item) => item.heading === "CMS")) return;

    menuItems.value.push({
      heading: "CMS",
      order: 50,
      items: [
        { title: "Páginas", icon: "FileText", link: "/app/cms/pages", order: 0 },
        { title: "Blog", icon: "BookOpen", link: "/app/cms/blog/posts", order: 10 },
        { title: "Categorías", icon: "Folder", link: "/app/cms/blog/categories", order: 20 },
        { title: "Etiquetas", icon: "Tag", link: "/app/cms/tags", order: 30 },
        { title: "Media", icon: "Image", link: "/app/cms/media", order: 40 },
      ],
    });
  };

  addCmsMenu();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) {
      addCmsMenu();
    } else {
      menuItems.value = menuItems.value.filter(item => item.heading !== 'CMS');
    }
  });
});
