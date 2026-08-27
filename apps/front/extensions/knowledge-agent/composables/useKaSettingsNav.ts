import type { Component } from 'vue';
import { Bot, Cpu, Plug } from 'lucide-vue-next';

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
      key: 'models',
      label: t('ext.ka.nav.models'),
      icon: Cpu,
      url: '/app/settings/models',
    },
    {
      key: 'mcp',
      label: t('ext.ka.nav.mcpServers'),
      icon: Plug,
      url: '/app/settings/mcp-servers',
    },
  ];
}