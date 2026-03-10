export default defineNuxtPlugin(() => {
  const menuItems = useState<any[]>("nav:menuItems", () => []);
  const localePath = useLocalePath();

  menuItems.value.push({
    heading: "base.nav.translations_heading",
    items: [
      {
        title: "base.nav.languages",
        icon: "Globe",
        link: localePath("/admin/translations/langs"),
      },
      {
        title: "base.nav.all_translations",
        icon: "FileText",
        link: localePath("/admin/translations"),
      },
    ],
  });
});
