export function transactionExplorerHref(hash: string, explorerUrl: string): string | null {
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) return null
  return `${explorerUrl.replace(/\/+$/, '')}/tx/${hash}`
}
