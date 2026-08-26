export interface KaConfigSection {
  key: string;
  label: string;
  icon?: string;
  url: string;
}

const AGENTS_ICON =
  'M12 2a3 3 0 0 1 3 3c0 1.3-.83 2.42-2 2.83V20l4-4h5a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5l-4-4z';
const MODELS_ICON =
  'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z';
const MCP_ICON =
  'M4 6h16M4 12h16M4 18h16';

export function KA_SETTINGS_SECTIONS(
  t: (key: string) => string,
): KaConfigSection[] {
  return [
    {
      key: 'agents',
      label: t('ext.ka.nav.agents'),
      icon: AGENTS_ICON,
      url: '/app/settings/agents',
    },
    {
      key: 'models',
      label: t('ext.ka.nav.models'),
      icon: MODELS_ICON,
      url: '/app/settings/models',
    },
    {
      key: 'mcp',
      label: t('ext.ka.nav.mcpServers'),
      icon: MCP_ICON,
      url: '/app/settings/mcp-servers',
    },
  ];
}