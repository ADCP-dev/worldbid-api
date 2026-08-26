import { watch } from 'vue';
import type { NavMenu } from '~/types/nav';

export default defineNuxtPlugin((nuxtApp) => {
  const { t } = nuxtApp.$i18n;
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);
  const authStore = useAuthStore();

  const addKnowledgeAgentMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === 'Knowledge Agent')) return;

    menuItems.value.push({
      heading: 'Knowledge Agent',
      order: 40,
      items: [
        { title: t('ext.ka.nav.notes'), icon: 'FileText', link: '/app/knowledge', order: 0 },
        { title: t('ext.ka.nav.chat'), icon: 'MessageSquare', link: '/app/agent', order: 20 },
        {
          title: t('ext.ka.nav.config'),
          icon: 'Settings',
          order: 30,
          children: [
            { title: t('ext.ka.nav.agents'), icon: 'Bot', link: '/app/settings/agents', order: 0 },
            { title: t('ext.ka.nav.models'), icon: 'Cpu', link: '/app/settings/models', order: 10 },
            { title: t('ext.ka.nav.mcpServers'), icon: 'Plug', link: '/app/settings/mcp-servers', order: 20 },
          ],
        },
      ],
    });
  };

  addKnowledgeAgentMenu();
  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addKnowledgeAgentMenu();
      } else {
        menuItems.value = menuItems.value.filter(
          (item) => item.heading !== 'Knowledge Agent',
        );
      }
    },
  );
});
