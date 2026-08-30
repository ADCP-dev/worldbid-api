import type { Component } from 'vue';
import { Bot, Database, Plug } from 'lucide-vue-next';

export interface KaConfigSection {
  key: string;
  label: string;
  icon: Component;
  url: string;
}

export function KA_SETTINGS_SECTIONS(
  t: (key: string) => string,
): KaConfigSection[] {
  return [
    {
      key: 'agents',
      label: t('ext.ka.nav.agents'),
      icon: Bot,
      url: '/app/settings/agents',
    },
    {
      key: 'providers',
      label: t('ext.ka.nav.providersAndModels'),
      icon: Database,
      url: '/app/settings/providers',
    },
    {
      key: 'mcp',
      label: t('ext.ka.nav.mcpServers'),
      icon: Plug,
      url: '/app/settings/mcp-servers',
    },
  ];
}
