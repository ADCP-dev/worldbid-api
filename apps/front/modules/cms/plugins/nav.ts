export default defineNuxtPlugin(() => {
  const menuItems = useState<any[]>("nav:menuItems", () => []);

  menuItems.value.push({
    heading: "CMS",
    items: [
      { title: "Dashboard", icon: "LayoutDashboard", link: "/app/cms" },
      { title: "Páginas", icon: "FileText", link: "/app/cms/pages" },
      { title: "Blog", icon: "BookOpen", link: "/app/cms/blog/posts" },
      { title: "Categorías", icon: "Folder", link: "/app/cms/blog/categories" },
    ],
  });
});
