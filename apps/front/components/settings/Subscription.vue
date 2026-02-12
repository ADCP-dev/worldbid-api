<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { 
  CreditCard, 
  ExternalLink, 
  Loader2, 
  Coins, 
  Activity, 
  TrendingUp,
  Server
} from 'lucide-vue-next'
import TokenUsageService, { type UsageSummary, type ModelUsage } from '@/services/tokenUsageService'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import NumberFlow from '@number-flow/vue'

const tokenUsageService = new TokenUsageService()
const usageSummary = ref<UsageSummary | null>(null)
const modelUsage = ref<ModelUsage[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const loadData = async () => {
  isLoading.value = true
  error.value = null
  try {
    const [summary, models] = await Promise.all([
      tokenUsageService.getSummary(),
      tokenUsageService.getUsageByModel()
    ])
    usageSummary.value = summary
    modelUsage.value = models
  } catch (e) {
    console.error('Failed to load usage data:', e)
    error.value = 'Failed to load usage data. Please try again.'
  } finally {
    isLoading.value = false
  }
}

const manageSubscription = () => {
  // TODO: Implement actual Stripe Portal redirection
  alert('Redirecting to Stripe Billing Portal...')
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4
  }).format(amount)
}

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US').format(num)
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium">
        Subscription & Usage
      </h3>
      <p class="text-sm text-muted-foreground">
        Manage your plan and track your AI resource consumption.
      </p>
    </div>
    
    <Separator />

    <div v-if="error" class="mb-4">
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>
    </div>

    <div v-if="isLoading && !usageSummary" class="flex justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="usageSummary" class="space-y-6">
      <!-- Key Metrics -->
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">
              Last 30 Days Cost
            </CardTitle>
            <CreditCard class="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ formatCurrency(usageSummary.last30d.totalCost) }}
            </div>
            <p class="text-xs text-muted-foreground">
              {{ formatNumber(usageSummary.last30d.totalTokens) }} tokens used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">
              Lifetime Usage
            </CardTitle>
            <Activity class="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              <NumberFlow :value="usageSummary.lifetime.totalTokens" />
            </div>
            <p class="text-xs text-muted-foreground">
              Total tokens consumed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">
              Plan Status
            </CardTitle>
            <TrendingUp class="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold flex items-center gap-2">
              Active
              <Badge variant="default" class="text-xs font-normal">Pro</Badge>
            </div>
            <p class="text-xs text-muted-foreground">
              Metered billing enabled
            </p>
          </CardContent>
        </Card>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <!-- Usage by Model -->
        <Card class="col-span-1">
          <CardHeader>
            <CardTitle>Usage by Model</CardTitle>
            <CardDescription>Breakdown of tokens per AI model (Last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <div v-for="model in modelUsage" :key="model.modelUsed" class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <div class="flex items-center gap-2">
                    <Server class="h-4 w-4 text-muted-foreground" />
                    <span class="font-medium">{{ model.modelUsed }}</span>
                  </div>
                  <span class="text-muted-foreground">{{ formatCurrency(model.totalCost) }}</span>
                </div>
                <!-- Visual bar relative to max cost? Simplification: just a full bar for now or relative to total cost -->
                <div class="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div 
                    class="h-full bg-primary" 
                    :style="{ width: `${Math.min((model.totalCost / (usageSummary.last30d.totalCost || 1)) * 100, 100)}%` }"
                  ></div>
                </div>
                <div class="flex justify-between text-xs text-muted-foreground">
                  <span>{{ formatNumber(model.totalTokens) }} tokens</span>
                  <span>{{ Math.round((model.totalCost / (usageSummary.last30d.totalCost || 1)) * 100) }}% of cost</span>
                </div>
              </div>
              <div v-if="modelUsage.length === 0" class="text-sm text-muted-foreground text-center py-4">
                No usage data available for this period.
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Billing Actions -->
        <Card class="col-span-1">
          <CardHeader>
            <CardTitle>Billing Management</CardTitle>
            <CardDescription>Manage your subscription, payment methods, and invoices.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="rounded-lg border p-4">
              <div class="flex items-center gap-4">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <CreditCard class="h-5 w-5" />
                </div>
                <div class="flex-1 space-y-1">
                  <p class="text-sm font-medium leading-none">Stripe Portal</p>
                  <p class="text-sm text-muted-foreground">
                    Update card, download invoices, cancel plan.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button @click="manageSubscription" class="w-full">
              <ExternalLink class="mr-2 h-4 w-4" />
              Open Customer Portal
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  </div>
</template>
