<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Code,
  Zap,
  Layers,
  Globe,
  Database,
  Shield,
  Workflow,
  BarChart3,
} from "lucide-vue-next";

interface FeaturesProps {
  icon: string;
  title: string;
  description: string;
}

const featureList: FeaturesProps[] = [
  {
    icon: "shield",
    title: "landing.features.list.shield.title",
    description: "landing.features.list.shield.description",
  },
  {
    icon: "zap",
    title: "landing.features.list.zap.title",
    description: "landing.features.list.zap.description",
  },
  {
    icon: "layers",
    title: "landing.features.list.layers.title",
    description: "landing.features.list.layers.description",
  },
  {
    icon: "database",
    title: "landing.features.list.database.title",
    description: "landing.features.list.database.description",
  },
  {
    icon: "workflow",
    title: "landing.features.list.workflow.title",
    description: "landing.features.list.workflow.description",
  },
  {
    icon: "barChart3",
    title: "landing.features.list.barChart3.title",
    description: "landing.features.list.barChart3.description",
  },
];

const iconMap: Record<
  string,
  | typeof Code
  | typeof Zap
  | typeof Layers
  | typeof Globe
  | typeof Database
  | typeof Shield
  | typeof Workflow
  | typeof BarChart3
> = {
  code: Code,
  zap: Zap,
  layers: Layers,
  globe: Globe,
  database: Database,
  shield: Shield,
  workflow: Workflow,
  barChart3: BarChart3,
};
</script>

<template>
  <section id="features" class="container mx-auto py-24 sm:py-32" data-aos="fade-up">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-8" data-aos="fade-up">
        <h2 class="text-lg text-primary mb-2 tracking-wider">
          {{ $t('landing.features.title.badge') }}
        </h2>

        <h2 class="text-3xl md:text-4xl font-bold mb-4">
          {{ $t('landing.features.title.main') }}
        </h2>

        <p class="max-w-2xl mx-auto text-xl text-muted-foreground">
          {{ $t('landing.features.title.description') }}
        </p>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="{ icon, title, description }, index in featureList" :key="title" :data-aos="'fade-up'"
          :data-aos-delay="index * 100">
          <Card class="h-full bg-background border-0 shadow-none">
            <CardHeader class="flex justify-center items-center flex-col">
              <div class="bg-primary/20 p-2 rounded-full ring-8 ring-primary/10 mb-4">
                <component :is="iconMap[icon]" class="size-6 text-primary" />

              </div>
              <CardTitle>
                {{ $t(title) }}
              </CardTitle>
            </CardHeader>

            <CardContent class="text-muted-foreground text-center">
              {{ $t(description) }}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="less" scoped></style>
