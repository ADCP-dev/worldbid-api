<script setup lang="ts">
import {
  Bell,
  LogOut,
  Sparkles,
  User,
} from 'lucide-vue-next'

const props = defineProps<{
  user: {
    name: string
    email: string
    avatar?: string
  }
}>()

const { logout } = useAuthStore()
const localePath = useLocalePath()

const initials = computed(() => {
  return (props.user.name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
})

// const closeDrawer = () => {
//   if (typeof document !== 'undefined') {
//     const el = document.getElementById('main-drawer') as HTMLInputElement
//     if (el) el.checked = false
//   }
// }
</script>

<template>
  <div class="dropdown dropdown-top is-drawer-close:dropdown-right w-full">
    <div tabindex="0" role="button" class="btn btn-ghost py-2 hover:bg-base-200 w-full justify-start is-drawer-close:justify-center is-drawer-close:px-0 h-auto">
      <div class="avatar">
        <div class="w-8 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
          <img v-if="user.avatar" :src="user.avatar" :alt="user.name" class="object-cover w-full h-full" >
          <span v-else class="text-xs font-bold text-primary">{{ initials }}</span>
        </div>
      </div>
      <div class="flex flex-col items-start ml-2 text-left truncate flex-1 is-drawer-close:hidden">
        <span class="text-sm font-medium">{{ user.name }}</span>
        <span class="text-xs opacity-70">{{ user.email }}</span>
      </div>
    </div>
    <ul tabindex="0" class="dropdown-content z-[2] menu p-2 shadow bg-base-100 rounded-box w-56 mb-2 is-drawer-close:mb-0 is-drawer-close:ml-2 is-drawer-close:bottom-0 is-drawer-close:top-auto">
      <li class="menu-title text-base-content opacity-100 p-2">
         <div class="flex items-center gap-2">
            <div class="avatar">
              <div class="w-8 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                <img v-if="user.avatar" :src="user.avatar" :alt="user.name" class="object-cover w-full h-full" >
                <span v-else class="text-xs font-bold text-primary">{{ initials }}</span>
              </div>
            </div>
            <div class="flex flex-col items-start text-left truncate w-full">
              <span class="text-sm font-semibold truncate w-full">{{ user.name }}</span>
              <span class="text-xs opacity-70 truncate w-full">{{ user.email }}</span>
            </div>
         </div>
      </li>
      <div class="divider my-0"/>
      <li>
        <NuxtLink :to="localePath('/app/settings/profile')">
          <User class="w-4 h-4" /> {{ $t('mod.nav.account') }}
        </NuxtLink>
      </li>
      <div class="divider my-0"/>
      <li>
        <a @click="logout"><LogOut class="w-4 h-4" /> {{ $t('mod.nav.logout') }}</a>
      </li>
    </ul>
  </div>
</template>
