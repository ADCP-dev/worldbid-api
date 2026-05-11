import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { fetchWrapper } from '@/helpers/fetch-wrapper';
import StripeService from '@/services/stripe.service';

export function useSubscriptionQuery(userId: string | number = 'me') {
  const stripeService = new StripeService();
  const baseURL = stripeService.apiUrl;

  return useQuery({
    queryKey: ['subscription', userId],
    queryFn: () => fetchWrapper.get(`${baseURL}/stripe/subscriptions/${userId}`),
  });
}

export function usePlansQuery() {
  const stripeService = new StripeService();

  return useQuery({
    queryKey: ['stripe', 'plans'],
    queryFn: () => stripeService.getPlans(),
  });
}

export function useCheckoutMutation() {
  const queryClient = useQueryClient();
  const stripeService = new StripeService();

  return useMutation({
    mutationFn: (planId: string) => stripeService.createCheckoutSession(planId),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

export function useCancelMutation() {
  const queryClient = useQueryClient();
  const stripeService = new StripeService();

  return useMutation({
    mutationFn: (subscriptionId: string) => stripeService.cancelSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

export function useResumeMutation() {
  const queryClient = useQueryClient();
  const stripeService = new StripeService();

  return useMutation({
    mutationFn: (subscriptionId: string) => stripeService.resumeSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

export function useInvoicesQuery() {
  const stripeService = new StripeService();

  return useQuery({
    queryKey: ['stripe', 'invoices'],
    queryFn: () => stripeService.getInvoices(),
    staleTime: 60_000,
  });
}
