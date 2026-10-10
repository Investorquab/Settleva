export const erc20Abi = [
  {type:"function",name:"decimals",stateMutability:"view",inputs:[],outputs:[{type:"uint8"}]},
  {type:"function",name:"approve",stateMutability:"nonpayable",inputs:[{name:"spender",type:"address"},{name:"amount",type:"uint256"}],outputs:[{type:"bool"}]}
] as const;

export const settlevaAbi = [
  {
    type:"function",name:"createPayment",stateMutability:"nonpayable",
    inputs:[
      {name:"paymentId",type:"bytes32"},{name:"payee",type:"address"},{name:"token",type:"address"},
      {name:"amount",type:"uint256"},{name:"expiry",type:"uint64"},
      {name:"conditionHash",type:"bytes32"},{name:"providerHash",type:"bytes32"}
    ],outputs:[]
  },
  {
    type:"function",name:"release",stateMutability:"nonpayable",
    inputs:[
      {name:"paymentId",type:"bytes32"},
      {name:"proofIdentifier",type:"bytes32"},
      {name:"verificationSignature",type:"bytes"}
    ],outputs:[]
  },
  {
    type:"function",name:"verificationAttestationHash",stateMutability:"view",
    inputs:[
      {name:"paymentId",type:"bytes32"},{name:"conditionHash",type:"bytes32"},
      {name:"providerHash",type:"bytes32"},{name:"proofIdentifier",type:"bytes32"}
    ],
    outputs:[{type:"bytes32"}]
  }
] as const;
