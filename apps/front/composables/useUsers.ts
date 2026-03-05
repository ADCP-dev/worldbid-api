import { fetchWrapper } from '~/helpers/fetch-wrapper';

export interface User {
  id: number | string;
  email: string;
  provider: string;
  socialId?: string | null;
  firstName: string | null;
  lastName: string | null;
  role?: {
    id: number | string;
    name?: string;
  } | null;
  status?: {
    id: number | string;
    name?: string;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function useUsers() {
  const config = useRuntimeConfig();
  const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`;

  const fetchUsers = async (params: Record<string, any> = {}) => {
    // Note: The DataTable component handles the pagination and fetching directly,
    // but we can provide this for custom usages.
    const queryString = new URLSearchParams(params as any).toString();
    const url = `${baseURL}/users${queryString ? '?' + queryString : ''}`;
    return await fetchWrapper.get(url);
  };

  const createUser = async (userData: any) => {
    return await fetchWrapper.post(`${baseURL}/users`, userData);
  };

  const updateUser = async (id: number | string, userData: any) => {
    return await fetchWrapper.patch(`${baseURL}/users/${id}`, userData);
  };

  const deleteUser = async (id: number | string) => {
    return await fetchWrapper.delete(`${baseURL}/users/${id}`);
  };

  // Dedicated endpoints or just patch depending on API capabilities
  // Here we use the generic patch for role, status, and password
  const changePassword = async (id: number | string, password: string) => {
    return await fetchWrapper.patch(`${baseURL}/users/${id}`, { password });
  };

  const changeRole = async (id: number | string, roleId: number | string) => {
    return await fetchWrapper.patch(`${baseURL}/users/${id}`, { role: { id: roleId } });
  };

  const changeStatus = async (id: number | string, statusId: number | string) => {
    return await fetchWrapper.patch(`${baseURL}/users/${id}`, { status: { id: statusId } });
  };

  return {
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    changePassword,
    changeRole,
    changeStatus
  };
}
