/** Client-safe helpers (no fs). */
export function threadKey(projectId: string, agentId: string) {
  return `${projectId}:${agentId}`;
}
