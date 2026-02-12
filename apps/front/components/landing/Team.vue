<script setup lang="ts">
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";

import LinkedInIcon from "@/components/icons/LinkedInIcon.vue";
import GithubIcon from "@/components/icons/GithubIcon.vue";
import XIcon from "@/components/icons/XIcon.vue";

interface TeamProps {
  imageUrl: string;
  firstName: string;
  lastName: string;
  positions: string[];
  socialNetworks: SocialNetworkProps[];
}

interface SocialNetworkProps {
  name: string;
  url: string;
}

const teamList: TeamProps[] = [
  {
    imageUrl: "https://i.pravatar.cc/250?img=58",
    firstName: "Leo",
    lastName: "Miranda",
    positions: ["Desarrollador Frontend Vue", "Creador de este Sitio Web"],
    socialNetworks: [
      {
        name: "LinkedIn",
        url: "https://www.linkedin.com/in/leopoldo-miranda/",
      },
      {
        name: "Github",
        url: "https://github.com/leoMirandaa",
      },
      {
        name: "X",
        url: "https://x.com/leo_mirand4",
      },
    ],
  },
  {
    imageUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1528&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    firstName: "Elizabeth",
    lastName: "Moore",
    positions: ["Diseñadora UI/UX"],
    socialNetworks: [
      {
        name: "LinkedIn",
        url: "https://www.linkedin.com/in/leopoldo-miranda/",
      },
      {
        name: "X",
        url: "https://x.com/leo_mirand4",
      },
    ],
  },
  {
    imageUrl:
      "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=1760&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    firstName: "David",
    lastName: "Diaz",
    positions: ["Ingeniero de Machine Learning", "Especialista en TensorFlow"],
    socialNetworks: [
      {
        name: "LinkedIn",
        url: "https://www.linkedin.com/in/leopoldo-miranda/",
      },
      {
        name: "Github",
        url: "https://github.com/leoMirandaa",
      },
    ],
  },
  {
    imageUrl:
      "https://images.unsplash.com/photo-1573497161161-c3e73707e25c?q=80&w=1587&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    firstName: "Sarah",
    lastName: "Robinson",
    positions: ["Desarrolladora Cloud Native", "Orquestadora de Kubernetes"],
    socialNetworks: [
      {
        name: "LinkedIn",
        url: "https://www.linkedin.com/in/leopoldo-miranda/",
      },
      {
        name: "Github",
        url: "https://github.com/leoMirandaa",
      },
      {
        name: "X",
        url: "https://x.com/leo_mirand4",
      },
    ],
  },
  {
    imageUrl:
      "https://images.unsplash.com/photo-1616805765352-beedbad46b2a?q=80&w=1887&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    firstName: "Michael",
    lastName: "Holland",
    positions: ["Ingeniero DevOps", "Maestro de Pipelines CI/CD"],
    socialNetworks: [
      {
        name: "LinkedIn",
        url: "https://www.linkedin.com/in/leopoldo-miranda/",
      },
    ],
  },
  {
    imageUrl:
      "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=1587&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    firstName: "Zoe",
    lastName: "Garcia",
    positions: ["Evangelista JavaScript", "Campeona de Deno"],
    socialNetworks: [
      {
        name: "LinkedIn",
        url: "https://www.linkedin.com/in/leopoldo-miranda/",
      },
      {
        name: "Github",
        url: "https://github.com/leoMirandaa",
      },
    ],
  },
  {
    imageUrl:
      "https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    firstName: "Evan",
    lastName: "James",
    positions: ["Desarrollador Backend"],
    socialNetworks: [
      {
        name: "LinkedIn",
        url: "https://www.linkedin.com/in/leopoldo-miranda/",
      },
      {
        name: "Github",
        url: "https://github.com/leoMirandaa",
      },
      {
        name: "X",
        url: "https://x.com/leo_mirand4",
      },
    ],
  },
  {
    imageUrl:
      "https://images.unsplash.com/photo-1573497019236-17f8177b81e8?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3Dhttps://images.unsplash.com/photo-1573497019236-17f8177b81e8?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    firstName: "Pam",
    lastName: "Taylor",
    positions: ["Desarrolladora Fullstack", "Investigadora UX"],
    socialNetworks: [
      {
        name: "X",
        url: "https://x.com/leo_mirand4",
      },
    ],
  },
];

const socialIcon = (socialName: string) => {
  switch (socialName) {
    case "LinkedIn":
      return LinkedInIcon;

    case "Github":
      return GithubIcon;

    case "X":
      return XIcon;
  }
};
</script>

<template>
  <section
    id="team"
    class="container mx-auto py-24 sm:py-32"
  >
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-lg text-primary mb-2 tracking-wider">Equipo</h2>

        <h2 class="text-3xl md:text-4xl font-bold">
          El Equipo de Ensueño de la Empresa
        </h2>
      </div>

      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
      >
      <Card
        v-for="{
          imageUrl,
          firstName,
          lastName,
          positions,
          socialNetworks,
        } in teamList"
        :key="imageUrl"
        class="bg-muted/60 dark:bg-card flex flex-col h-full overflow-hidden group/hoverimg"
      >
        <CardHeader class="p-0 gap-0">
          <div class="h-full overflow-hidden">
            <img
              :src="imageUrl"
              alt=""
              class="w-full aspect-square object-cover saturate-0 transition-all duration-200 ease-linear size-full group-hover/hoverimg:saturate-100 group-hover/hoverimg:scale-[1.01]"
            >
          </div>
          <CardTitle class="py-6 pb-4 px-6"
            >{{ firstName }}
            <span class="text-primary">{{ lastName }}</span>
          </CardTitle>
        </CardHeader>

        <CardContent
          v-for="(position, index) in positions"
          :key="index"
          :class="{
            'pb-0 text-muted-foreground ': true,
            'pb-4': index === positions.length - 1,
          }"
        >
          {{ position }}<span v-if="index < positions.length - 1">,</span>
        </CardContent>

        <CardFooter class="space-x-4 mt-auto">
          <a
            v-for="{ name, url } in socialNetworks"
            :key="name"
            :href="url"
            target="_blank"
            class="hover:opacity-80 transition-all"
            :aria-label="`Visit our ${name} page`"
          >
            <component :is="socialIcon(name)" />
          </a>
        </CardFooter>
      </Card>
    </div>
    </div>
  </section>
</template>
