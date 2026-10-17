import type { ReactNode } from 'react'

export function PageHeader({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:ReactNode}) {
  return <header className="cc-page-header"><div className="min-w-0"><p className="cc-eyebrow"><span aria-hidden="true" />{eyebrow}</p><h1 className="cc-title">{title}</h1><p className="cc-description">{description}</p></div>{action && <div className="cc-page-action">{action}</div>}</header>
}

export function StatusBadge({status,children}:{status:string;children?:ReactNode}) {
  const value=status.toLowerCase()
  const tone=['paid','confirmed','success','verified','funded'].includes(value)?'success':['approved','pending','open','demo','unverified'].includes(value)?'warning':['rejected','refunded','failed','error'].includes(value)?'danger':'neutral'
  return <span className="cc-badge" data-tone={tone}><span aria-hidden="true" />{children || status}</span>
}

export function EmptyState({title,description,action}:{title:string;description:string;action?:ReactNode}) {
  return <div className="cc-empty"><span className="cc-empty-symbol" aria-hidden="true">✳</span><h3>{title}</h3><p>{description}</p>{action}</div>
}
