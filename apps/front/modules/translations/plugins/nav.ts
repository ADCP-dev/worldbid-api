export default defineNuxtPlugin(() => {
  const menuItems = useState<any[]>("nav:menuItems", () => []);

  menuItems.value.push({
    heading: "Translations",
    items: [
      {
        title: "Languages",
        icon: "Globe",
        link: "/admin/translations/langs",
      },
      {
        title: "All Translations",
        icon: "FileText",
        link: "/admin/translations",
      },
    ],
  });
});
