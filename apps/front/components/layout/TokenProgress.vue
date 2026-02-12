<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Info, RefreshCw, AlertTriangle } from "lucide-vue-next";
// import ApiService from "~/editor/services/apiService";
import { toast } from "vue-sonner";

// const apiService = new ApiService();

interface TokenUsage {
  used: number;
  total: number;
  resetDate: string;
}

const tokenUsage = ref<TokenUsage>({
  used: 0,
  total: 0,
  resetDate: new Date().toISOString(),
});

const error = ref<{ message: string; statusCode: number }>({
  message: '',
  statusCode: 0,
});

const hasError = ref(false)

const getBalance = async () => {
  // try {
  //   const balance = await apiService.getBalance();
  //   console.log(balance);

  //   // Clear previous errors
  //   error.value = { message: '', statusCode: 0 };

  //   // if type Balance
  //   if (balance && 'usedTokens' in balance) {
  //     tokenUsage.value = {
  //       used: balance.usedTokens,
  //       total: balance.totalTokens,
  //       resetDate: new Date(balance.subscriptionEndDate).toISOString(),
  //     };
  //   } else if (balance && 'message' in balance) {
  //     // if type { message: string; statusCode: number; }
  //     error.value = {
  //       message: balance.message || 'Failed to fetch token balance',
  //       statusCode: balance.statusCode || 500
  //     };
  //     hasError.value = true

  //     toast("Error", {
  //       description: error.value.message,
  //     });
  //   }
  // } catch (err) {
  //   console.error('Error fetching token balance:', err);
  //   error.value = {
  //     message: 'Network error: Unable to fetch token balance',
  //     statusCode: 0
  //   };
  // }
}

const isRefreshing = ref(false);

const refreshTokens = async () => {
  try {
    isRefreshing.value = true;
    await getBalance();
  } catch (error) {
    console.error('Error refreshing token balance:', error);
  } finally {
    isRefreshing.value = false;
  }
};

// Load token usage from user data
onMounted(async () => {
  // every minute update the token usage
  await getBalance();
  const interval = setInterval(getBalance, 60 * 1000);
  onUnmounted(() => {
    clearInterval(interval);
  });
});

const percentage = computed(() => {
  return Math.min((tokenUsage.value.used / tokenUsage.value.total) * 100, 100);
});

const remaining = computed(() => {
  return tokenUsage.value.total - tokenUsage.value.used;
});

const progressColor = computed(() => {
  if (percentage.value >= 90) return "bg-destructive/20";
  if (percentage.value >= 75) return "bg-warning/20";
  return "bg-primary/20";
});

const formatResetDate = computed(() => {
  const date = new Date(tokenUsage.value.resetDate);
  return date.toLocaleDateString();
});

// Format large numbers
const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
};
</script>

<template>
  <div class="w-full flex items-center justify-center">
    <div class="flex items-center gap-3">
      <!-- Error State -->
      <div
v-if="hasError"
        class="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20">
        <AlertTriangle class="h-4 w-4 text-destructive" />
        <span class="text-sm text-destructive font-medium">
          {{ error.message }}
        </span>
        <button
:disabled="isRefreshing"
          class="p-1 rounded-md hover:bg-destructive/20 transition-colors disabled:opacity-50"
          title="Retry loading token balance" @click="refreshTokens">
          <RefreshCw
:class="[
            'h-4 w-4 text-destructive',
            isRefreshing && 'animate-spin'
          ]" />
        </button>
      </div>

      <!-- Normal State -->
      <template v-else>
        <Badge variant="secondary" class="text-xs">
          {{ percentage.toFixed(2) }}%
        </Badge>
        <div class="w-96">
          <Progress :model-value="percentage" :class="progressColor" />
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info class="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <div class="space-y-1">
                <div class="font-medium">Token Usage</div>
                <div class="text-xs">
                  <div>Used: {{ formatNumber(tokenUsage.used) }}</div>
                  <div>Total: {{ formatNumber(tokenUsage.total) }}</div>
                  <div>Remaining: {{ formatNumber(remaining) }}</div>
                  <div>Resets: {{ formatResetDate }}</div>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <button
:disabled="isRefreshing"
          class="ml-2 p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh token balance" @click="refreshTokens">
          <RefreshCw
:class="[
            'h-4 w-4 text-muted-foreground',
            isRefreshing && 'animate-spin'
          ]" />
        </button>
      </template>
    </div>
  </div>
</template>
