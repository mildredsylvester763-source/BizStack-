export type WalletProviderCapabilities = {
  collect: boolean; deposit: boolean; withdraw: boolean; send: boolean; receive: boolean;
  refunds: boolean; disputes: boolean; recurring: boolean; cards: boolean; mobileMoney: boolean;
  bankAccounts: boolean; fx: boolean; webhooks: boolean;
};

export type WalletTransferInput = {
  amount:number; currency:string; idempotencyKey:string;
  beneficiary?:Record<string,unknown>; description?:string;
};

export type WalletProviderResult = {
  status:"pending"|"processing"|"completed"|"failed";
  providerReference?:string;
  feeAmount?:number;
  message?:string;
};

export interface WalletProviderAdapter {
  provider:string;
  capabilities:WalletProviderCapabilities;
  createDeposit(input:WalletTransferInput):Promise<WalletProviderResult>;
  createWithdrawal(input:WalletTransferInput):Promise<WalletProviderResult>;
  createTransfer(input:WalletTransferInput):Promise<WalletProviderResult>;
  createPaymentRequest?(input:WalletTransferInput):Promise<WalletProviderResult>;
  refund?(providerReference:string,amount:number,currency:string):Promise<WalletProviderResult>;
  verifyWebhook(headers:Headers,rawBody:string):Promise<boolean>;
  handleWebhook(event:unknown):Promise<{externalEventId:string;eventType:string;status:"processed"|"ignored"}>;
}

export function assertProviderCapability(adapter:WalletProviderAdapter,capability:keyof WalletProviderCapabilities){
  if(!adapter.capabilities[capability]) throw new Error(`${adapter.provider} does not support ${capability}.`);
}
