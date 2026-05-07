import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionsService } from '../services/subscriptions.service';
import { PlansService } from '../services/plans.service';

export const FEATURE_KEY = 'feature';
export const RequiredFeature = (feature: string) => {
  return (target: any, key?: string, descriptor?: any) => {
    Reflect.defineMetadata(FEATURE_KEY, feature, descriptor?.value ?? target);
    return descriptor ?? target;
  };
};

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly plansService: PlansService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeature) return true; // No feature required → allow

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    const subscription = await this.subscriptionsService.findActiveByUser(
      user.id,
    );
    if (!subscription) return false;

    try {
      const plan = await this.plansService.findById(subscription.planId);
      return plan?.features?.includes(requiredFeature) ?? false;
    } catch {
      return false;
    }
  }
}
