/**
 * La superficie pública del proceso de envío (REQ-015/S-073): lo que `src/index.ts` (Task 7)
 * consume para arrancar y parar el proceso periódico.
 */
export { startDispatchLoop, stopDispatchLoop } from './scheduler';
export { runDispatchCycle } from './run-cycle';
