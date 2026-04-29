export default defineNuxtPlugin(() => {
  const menuItems = useState<any[]>("nav:menuItems", () => []);

  // Evitar duplicados
  if (menuItems.value.find((item) => item.heading === "CMS")) {
    return;
  }

  menuItems.value.push({
    heading: "CMS",
    items: [
      { title: "Páginas", icon: "FileText", link: "/app/cms/pages" },
      { title: "Blog", icon: "BookOpen", link: "/app/cms/blog/posts" },
      { title: "Categorías", icon: "Folder", link: "/app/cms/blog/categories" },
      { title: "Etiquetas", icon: "Tag", link: "/app/cms/tags" },
    ],
  });
});
