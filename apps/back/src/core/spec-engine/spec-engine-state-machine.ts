/**
 * Spec Engine — State Machine Validator
 *
 * Validates state machine transitions declared on a field spec.
 * A field with `stateMachine.transitions` defines the allowed
 * from→to transitions and (optionally) which roles may perform them.
 */

import type {
  ResourceSpec,
  FieldSpec,
  StateTransitionSpec,
} from './spec.types';

export interface TransitionResult {
  valid: boolean;
  error?: string;
}

export class StateMachineValidator {
  /**
   * Validate that `from` → `to` is an allowed transition for the given user role.
   *
   * - Returns { valid: false, error } when the transition is not declared.
   * - Returns { valid: false, error } when the transition declares `roles`
   *   and `userRole` is not among them.
   * - Returns { valid: true } otherwise.
   */
  static validateTransition(
    spec: ResourceSpec,
    field: FieldSpec,
    from: string,
    to: string,
    userRole: string,
  ): TransitionResult {
    const sm = field.stateMachine;
    if (!sm || !Array.isArray(sm.transitions)) {
      return {
        valid: false,
        error: `Field "${field.name}" does not define a state machine`,
      };
    }

    const match: StateTransitionSpec | undefined = sm.transitions.find(
      (t) => t.from === from && t.to === to,
    );

    if (!match) {
      return {
        valid: false,
        error: `Invalid state transition from ${from} to ${to}`,
      };
    }

    if (match.roles && match.roles.length > 0) {
      if (!match.roles.includes(userRole as any)) {
        return {
          valid: false,
          error: `Role ${userRole} cannot transition from ${from} to ${to}`,
        };
      }
    }

    return { valid: true };
  }
}
