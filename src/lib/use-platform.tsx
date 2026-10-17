'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount, usePublicClient, useSignMessage, useWriteContract } from 'wagmi'
import { decodeFunctionData, encodeFunctionData, formatEther, type Abi, type Hash, type Hex } from 'viem'
import { bountyAbi, contractAddress, chainId } from './contract'
import type { Project, Opportunity, Submission } from '@/types'
import { verifyIntentTransaction, type TransactionIntent } from './transaction-intent'
import { isConfirmedTransactionFor } from './transaction-confirmation'
export type Feed = {projects:Project[];opportunities:Opportunity[];submissions:Submission[];transactions:{hash:string;wallet:string;status:string}[];configured:boolean;syncError:string|null;demoMode?:boolean}
const blank:Feed={projects:[],opportunities:[],submissions:[],transactions:[],configured:false,syncError:null}
export async function api<T=Record<string,unknown>>(path:string,body?:unknown,wallet?:string):Promise<T> {
  const res=await fetch('/api/platform/'+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(wallet?{'x-wallet-address':wallet}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const value=await res.json()
  if(!res.ok) throw new Error(value.error || `Request failed (${res.status})`)
  return value
}
export function useFeed() {
  const query=useQuery({queryKey:['platform-feed'],queryFn:()=>api<Feed>('feed'),refetchInterval:15000,staleTime:10000})
  return {...query,data:query.data||blank}
}
export function useNow() {
  const [now,setNow]=useState(0)
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer)},[])
  return now
}
type Identity={authenticated:boolean;githubId?:string;name?:string;wallet?:string;demoMode?:boolean}
export function useIdentity() {
  const {address,chainId:connectedChain,status}=useAccount()
  const client=useQueryClient()
  const {signMessageAsync}=useSignMessage()
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const session=useQuery({queryKey:['platform-session'],queryFn:()=>api<Identity>('session'),staleTime:0})
  const linked=!!address && session.data?.wallet===address.toLowerCase()
  useEffect(()=>{
    if(status!=='connecting' && status!=='reconnecting' && session.data?.wallet && session.data.wallet!==address?.toLowerCase()) {
      void api('wallet/clear',{}).then(()=>client.invalidateQueries({queryKey:['platform-session']}))
    }
  },[address,status,session.data?.wallet,client])
  async function link() {
    setError('');setBusy(true)
    try {
      if(!address || connectedChain!==chainId) throw new Error('Connect your wallet on Sepolia first')
      const c=await api<{id:string;message:string}>('wallet/challenge',{address})
      const signature=await signMessageAsync({message:c.message})
      await api('wallet/verify',{id:c.id,signature})
      await client.invalidateQueries({queryKey:['platform-session']})
    } catch(e) {setError(e instanceof Error?e.message:'Wallet linking failed')} finally {setBusy(false)}
  }
  return {session:session.data,linked,link,error,busy}
}
type Prepared={intentId?:string;call:{functionName:string;args:string[];value?:string}}
type Pending=TransactionIntent & {hash:Hash;intentId?:string;sentBlock:string}
const pendingKey='contribchain.pending.v1'
export function useTransaction() {
  const {address,chainId:connectedChain}=useAccount()
  const publicClient=usePublicClient({chainId})
  const {writeContractAsync}=useWriteContract()
  const cache=useQueryClient()
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [hash,setHash]=useState<Hash>()
  const [busy,setBusy]=useState(false)
  const [confirmedFunction,setConfirmedFunction]=useState('')
  const [confirmedData,setConfirmedData]=useState<string>()
  const recoveryAttempt=useRef('')
  const settle=useCallback(async (pending:Pending) => {
    if(!publicClient) throw new Error('Sepolia RPC unavailable')
    let current=pending
    const original=await publicClient.getTransaction({hash:current.hash}).catch(()=>null)
    let sameAction=true
    if(original) {
      try {verifyIntentTransaction(current,original)} catch {sameAction=false}
      if(sameAction) {current={...current,nonce:original.nonce};localStorage.setItem(pendingKey,JSON.stringify(current))}
    }
    if(sameAction) await api('transactions/track',current,current.wallet)
    const receipt=await publicClient.waitForTransactionReceipt({hash:current.hash,confirmations:2,onReplaced:replacement=>{
      current={...current,hash:replacement.transaction.hash}
      localStorage.setItem(pendingKey,JSON.stringify(current));setHash(current.hash)
    }})
    // The receipt hash is authoritative even when viem does not invoke onReplaced.
    const mined=await publicClient.getTransaction({hash:receipt.transactionHash})
    try {verifyIntentTransaction(current,mined)} catch(error) {
      if(mined.from.toLowerCase()===current.wallet && current.nonce!==undefined && mined.nonce===current.nonce) localStorage.removeItem(pendingKey)
      throw error
    }
    current={...current,hash:receipt.transactionHash,nonce:mined.nonce}
    localStorage.setItem(pendingKey,JSON.stringify(current));setHash(current.hash)
    if(receipt.status!=='success') {
      await api('transactions/reconcile',{hash:current.hash},current.wallet).catch(()=>{})
      localStorage.removeItem(pendingKey);throw new Error('Transaction reverted; escrow state was not changed')
    }
    await api('transactions/track',current,current.wallet)
    await api('transactions/reconcile',{hash:current.hash},current.wallet)
    localStorage.removeItem(pendingKey)
    setConfirmedData(current.data)
    try {setConfirmedFunction(decodeFunctionData({abi:bountyAbi,data:current.data as Hex}).functionName)} catch {setConfirmedFunction('')}
    setMessage('Confirmed on Sepolia with two confirmations. Data synchronized.')
    await cache.invalidateQueries()
    return current.hash
  },[publicClient,cache])
  async function send(endpoint:string,body:unknown) {
    setBusy(true);setError('');setConfirmedFunction('');setConfirmedData(undefined);setMessage('Preparing and checking current contract state…')
    try {
      if(localStorage.getItem(pendingKey)) throw new Error('A transaction is already stored as pending. Recover it before sending another transaction.')
      if(!address || connectedChain!==chainId) throw new Error('Connect MetaMask and switch to Sepolia')
      if(!contractAddress || !publicClient) throw new Error('Deploy and configure the Sepolia escrow first')
      const prepared=await api<Prepared>(endpoint,body,address)
      const args=prepared.call.args.map((arg,i)=> {
        const f=bountyAbi.find(x=>x.type==='function' && x.name===prepared.call.functionName)
        return f && 'inputs' in f && f.inputs[i]?.type.startsWith('uint') ? BigInt(arg) : arg
      })
      const call={address:contractAddress,abi:bountyAbi as Abi,functionName:prepared.call.functionName,args,account:address,value:BigInt(prepared.call.value||'0'),chain:publicClient.chain}
      const simulation=await publicClient.simulateContract(call)
      const gas=await publicClient.estimateContractGas(call)
      const gasPrice=await publicClient.getGasPrice()
      const estimate=formatEther(gas*gasPrice)
      setMessage(`Estimated gas: ${estimate} Sepolia ETH. Confirm in MetaMask.`)
      if(prepared.call.value && !window.confirm(`Lock ${formatEther(BigInt(prepared.call.value))} Sepolia ETH in escrow?\nEstimated gas: ${estimate} ETH (actual fee may vary).\nSubmissions AND approval must occur before the deadline. Without an approved winner the publisher may refund after expiry. An approved winner cannot be refunded; payment requires a separate publisher transaction.`)) throw new Error('Funding cancelled before sending')
      const sentBlock=(await publicClient.getBlockNumber({cacheTime:0})).toString()
      const tx=await writeContractAsync({...simulation.request,chainId})
      const pending:Pending={hash:tx,intentId:prepared.intentId,wallet:address.toLowerCase(),to:contractAddress,data:encodeFunctionData({abi:bountyAbi as Abi,functionName:prepared.call.functionName,args}),value:call.value.toString(),sentBlock}
      localStorage.setItem(pendingKey,JSON.stringify(pending));setHash(tx);setMessage('Transaction submitted. Waiting for two confirmations…')
      return await settle(pending)
    } catch(e) {setError(e instanceof Error?e.message:'Transaction failed');throw e} finally {setBusy(false)}
  }
  const recover=useCallback(async (replacementHash?:string) => {
    setBusy(true);setError('')
    try {
      let pending=JSON.parse(localStorage.getItem(pendingKey)||'null') as Pending|null
      if(!pending) throw new Error('No pending transaction is stored in this browser')
      if(pending.wallet!==address?.toLowerCase()) throw new Error('Reconnect the wallet that sent the pending transaction')
      if(replacementHash) {
        if(!/^0x[a-fA-F0-9]{64}$/.test(replacementHash)) throw new Error('Enter the full replacement transaction hash from MetaMask or the explorer')
        pending={...pending,hash:replacementHash as Hash}
      }
      setHash(pending.hash);setMessage('Recovering pending transaction…')
      await settle(pending)
    } catch(e) {setError(e instanceof Error?e.message:'Recovery failed')} finally {setBusy(false)}
  },[address,settle])
  useEffect(()=>{
    if(!address || connectedChain!==chainId || !publicClient) return
    // Start recovery after wallet hydration; cancel it if the active wallet changes.
    const timer=setTimeout(()=>{
      const stored=localStorage.getItem(pendingKey)
      if(!stored) return
      try {
        const pending=JSON.parse(stored) as Pending
        if(pending.wallet!==address.toLowerCase() || pending.to.toLowerCase()!==contractAddress?.toLowerCase()) return
        const attempt=address.toLowerCase()+pending.hash
        if(recoveryAttempt.current===attempt) return
        recoveryAttempt.current=attempt
        void recover()
      } catch {setError('Stored transaction could not be read. Use transaction recovery before submitting again.')}
    },0)
    return ()=>clearTimeout(timer)
  },[address,connectedChain,publicClient,recover])
  const confirmedFor = (functionName: 'submitContribution' | 'createOpportunity', entityId: string) => isConfirmedTransactionFor(confirmedData, functionName, entityId)
  return {send,recover,message,error,hash,busy,confirmedFunction,confirmedFor}
}
