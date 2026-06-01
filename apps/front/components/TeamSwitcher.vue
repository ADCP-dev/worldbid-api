<script setup lang="ts">
import { ChevronsUpDown, Plus } from 'lucide-vue-next'
import { type Component, ref } from 'vue'

const props = defineProps<{
  teams: {
    name: string
    logo: Component
    plan: string
  }[]
}>()

const activeTeam = ref(props.teams[0])
</script>

<template>
  <div class="dropdown w-full">
    <div tabindex="0" role="button" class="btn btn-ghost w-full justify-start px-2 h-auto py-2">
      <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-base-300 text-base-content">
        <component :is="activeTeam.logo" class="size-4" />
      </div>
      <div class="flex flex-col items-start ml-2 text-left flex-1 truncate">
        <span class="truncate font-medium text-sm">
          {{ activeTeam.name }}
        </span>
        <span class="truncate text-xs opacity-70">{{ activeTeam.plan }}</span>
      </div>
      <ChevronsUpDown class="ml-auto opacity-50" />
    </div>

    <ul tabindex="0" class="dropdown-content z-[2] menu p-2 shadow bg-base-100 rounded-box w-full mt-2">
      <li class="menu-title text-base-content opacity-70 px-2 py-1 text-xs">
        Teams
      </li>
      <li v-for="(team, index) in teams" :key="team.name" @click="activeTeam = team">
        <a class="flex items-center gap-2 w-full">
          <div class="flex size-6 items-center justify-center rounded-sm border">
            <component :is="team.logo" class="size-3.5 shrink-0" />
          </div>
          <span class="flex-1">{{ team.name }}</span>
          <span class="opacity-50 text-xs">⌘{{ index + 1 }}</span>
        </a>
      </li>
      <div class="divider my-0"/>
      <li>
        <a class="flex items-center gap-2">
           <div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
             <Plus class="size-4" />
           </div>
           <span class="font-medium opacity-70">Add team</span>
        </a>
      </li>
    </ul>
  </div>
</template>
