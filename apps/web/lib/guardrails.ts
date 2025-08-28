// Wav Anti-Bullshit guardrails system
// Will be implemented in Phase 2

export function shouldSayIDK(hits: any[], movable: boolean, contradiction: boolean): boolean {
  // TODO: Implement heuristic for "I don't know" responses
  throw new Error('Not implemented')
}

export function composeRefusal(category: string, severity: 'N1' | 'N2' | 'N3'): string {
  // TODO: Implement refusal composition
  throw new Error('Not implemented')
}

export function stripInjections(text: string): string {
  // TODO: Implement prompt injection filtering
  throw new Error('Not implemented')
}

export function isMovableTopic(text: string): boolean {
  // TODO: Implement movable topic detection (prix/algos/lois/maj)
  throw new Error('Not implemented')
}