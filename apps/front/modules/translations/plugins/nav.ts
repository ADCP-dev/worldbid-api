export default defineNuxtPlugin(() => {
  const menuItems = useState<any[]>("nav:menuItems", () => []);

  menuItems.value.push({
    heading: "base.nav.translations_heading",
    items: [
      {
        title: "base.nav.languages",
        icon: "Globe",
        link: "/admin/translations/langs",
      },
      {
        title: "base.nav.all_translations",
        icon: "FileText",
        link: "/admin/translations",
      },
    ],
  });
});
