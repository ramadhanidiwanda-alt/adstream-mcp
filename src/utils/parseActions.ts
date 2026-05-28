import type { Action, ActionValue } from '../types.js';

export function parseActionValue(actions: Action[] | undefined, actionType: string): number {
  if (!actions || !Array.isArray(actions)) {
    return 0;
  }

  const action = actions.find((a) => a.action_type === actionType);
  return action ? parseFloat(action.value) || 0 : 0;
}

export function parseActionValueFromValues(
  actionValues: ActionValue[] | undefined,
  actionType: string
): number {
  if (!actionValues || !Array.isArray(actionValues)) {
    return 0;
  }

  const actionValue = actionValues.find((a) => a.action_type === actionType);
  return actionValue ? parseFloat(actionValue.value) || 0 : 0;
}
