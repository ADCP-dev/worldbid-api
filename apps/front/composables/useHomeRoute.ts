import { useAuthStore } from "~/stores/auth.store";

export function useHomeRoute() {
  const authStore = useAuthStore();
  const config = useRuntimeConfig();

  // const resolveHomeRoute = (roleName?: string) => {
  //   const map: Record<string, string> = {
  //     Admin: config.public.mainAppRoute,
  //     Staff: '/chatbots/staff',
  //   }
  //   return map[roleName || ''] || config.public.mainAppRoute
  // }

  // const route = computed(() => resolveHomeRoute(authStore.user?.role?.name))
  const resolveHomeRoute = () => {
    return config.public.mainAppRoute;
  };

  const route = computed(() => resolveHomeRoute());

  const navigateHome = () => navigateTo(route.value);

  return { route, navigateHome, resolveHomeRoute };
}
