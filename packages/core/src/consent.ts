export type ConsentMode = 'interactive' | 'non-interactive';
export type ConsentDecision = 'approved' | 'denied' | 'unavailable';

export interface ConsentRequest {
  actionId: string;
  summary: string;
  mutating: boolean;
  required: boolean;
  prohibited?: boolean;
}

export interface ConsentContext {
  mode: ConsentMode;
  assumeYes: boolean;
}

export interface ConsentEvaluation {
  decision: ConsentDecision;
  blocked: boolean;
  reason?: string;
}

export function evaluateConsent(
  request: ConsentRequest,
  context: ConsentContext,
  decision: ConsentDecision,
): ConsentEvaluation {
  if (request.prohibited) {
    return { decision: 'denied', blocked: true, reason: 'This mutation is prohibited by policy.' };
  }
  if (!request.mutating) {
    return { decision: 'approved', blocked: false };
  }
  if (context.mode === 'non-interactive' && !context.assumeYes) {
    return { decision: 'unavailable', blocked: true, reason: 'Explicit authorization is required in non-interactive mode.' };
  }
  if (decision !== 'approved') {
    return { decision, blocked: true, reason: 'Explicit consent was not granted.' };
  }
  return { decision: 'approved', blocked: false };
}

export interface InstallationRequest {
  actionId: string;
  summary: string;
  requiresConsent: true;
  prohibited?: boolean;
}

export interface InstallationResult {
  completed: boolean;
  metadata: Record<string, string | number | boolean | null>;
  errorCode?: string;
}