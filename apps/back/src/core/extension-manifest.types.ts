export interface ExtensionManifest {
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  author?: string;
  engines?: { foundation?: string; node?: string };
  dependencies?: { extensions?: string[] };
  contributes?: {
    routes?: RouteContribution[];
    entities?: EntityContribution[];
    seeds?: boolean;
    config?: string[];
    menuItems?: MenuContribution[];
    permissions?: PermissionContribution[];
  };
  activationEvents?: string[];
}

export interface RouteContribution {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
}

export interface EntityContribution {
  name: string;
  table: string;
}

export interface MenuContribution {
  heading?: string;
  items?: MenuItemContribution[];
}

export interface MenuItemContribution {
  title: string;
  icon?: string;
  link: string;
}

export interface PermissionContribution {
  action: string;
  description?: string;
}

export interface ExtensionConflict {
  type:
    | 'route_conflict'
    | 'table_conflict'
    | 'missing_dependency'
    | 'circular_dependency';
  detail: string;
  severity: 'error' | 'warning';
}
