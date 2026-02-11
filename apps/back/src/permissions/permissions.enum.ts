export enum PermissionEnum {
  // Resource-specific permissions
  'manage:users' = 'manage:users',
  'manage:users:own' = 'manage:users:own',
  'manage:roles' = 'manage:roles',

  'view:reports' = 'view:reports',
  'view:analytics' = 'view:analytics',

  'create:content' = 'create:content',
  'edit:content' = 'edit:content',
  'edit:content:own' = 'edit:content:own',
  'delete:content' = 'delete:content',
  'delete:content:own' = 'delete:content:own',
  'publish:content' = 'publish:content',
  'publish:content:own' = 'publish:content:own',
  'approve:content' = 'approve:content',

  'access:admin' = 'access:admin',
  'access:api' = 'access:api',
}
