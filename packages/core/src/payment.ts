export const PAYMENT_STATES = ["CREATED","FUNDED","WAITING_FOR_PROOF","PROOF_SUBMITTED","VERIFYING","SETTLED","EXPIRED","REFUNDED"] as const;
export type PaymentState = typeof PAYMENT_STATES[number];
const transitions: Record<PaymentState, readonly PaymentState[]> = {CREATED:["FUNDED"],FUNDED:["WAITING_FOR_PROOF","EXPIRED"],WAITING_FOR_PROOF:["PROOF_SUBMITTED","EXPIRED"],PROOF_SUBMITTED:["VERIFYING","WAITING_FOR_PROOF"],VERIFYING:["SETTLED","WAITING_FOR_PROOF"],SETTLED:[],EXPIRED:["REFUNDED"],REFUNDED:[]};
export function canTransition(from: PaymentState,to: PaymentState): boolean { return transitions[from].includes(to); }
