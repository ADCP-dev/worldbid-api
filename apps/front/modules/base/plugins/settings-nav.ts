export default defineNuxtPlugin(() => {
  const authStore = useAuthStore()
  const items = useState<{ title: string; href: string }[]>('settings:navItems', () => [])

  const addAppearance = () => {
    if (!authStore.isAdmin) return
    if (!items.value.find(i => i.href === '/app/settings/appearance')) {
      items.value.push({ title: 'Apariencia', href: '/app/settings/appearance' })
    }
  }

  addAppearance()
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) {
      addAppearance()
    } else {
      items.value = items.value.filter(i => i.href !== '/app/settings/appearance')
    }
  })
})