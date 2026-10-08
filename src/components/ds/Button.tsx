import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../icons'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent'

const VARIANT: Record<ButtonVariant, string> = {
  // Lime on the dark shell, deep green on a solid light panel.
  primary: 'btn-primary',
  // Glass on the dark shell, a soft green tint on a light panel.
  secondary: 'btn-glass',
  ghost: 'btn-ghost',
  // Always lime. For the one main action on a dark surface.
  accent: 'btn-accent',
}

type Common = {
  variant?: ButtonVariant
  icon?: IconName
  className?: string
  children: ReactNode
}

type AsLink = Common & { to: string; href?: never } & Omit<ComponentProps<typeof Link>, 'to' | 'className' | 'children'>
type AsAnchor = Common & { href: string; to?: never } & Omit<ComponentProps<'a'>, 'href' | 'className' | 'children'>
type AsButton = Common & { to?: never; href?: never } & Omit<ComponentProps<'button'>, 'className' | 'children'>

/** One button for the whole site. Renders a router link, an anchor or a real button, always with the same look. */
export function Button(props: AsLink | AsAnchor | AsButton) {
  const { variant = 'primary', icon, className = '', children, ...rest } = props as Common & Record<string, unknown>
  const cls = `btn ${VARIANT[variant]} ${className}`.trim()
  const content = (
    <>
      {children}
      {icon && <Icon name={icon} className="h-4 w-4" strokeWidth={2.2} />}
    </>
  )
  if ('to' in rest && typeof rest.to === 'string') {
    return <Link {...(rest as Omit<AsLink, keyof Common>)} to={rest.to} className={cls}>{content}</Link>
  }
  if ('href' in rest && typeof rest.href === 'string') {
    return <a {...(rest as Omit<AsAnchor, keyof Common>)} href={rest.href} className={cls}>{content}</a>
  }
  return <button type="button" {...(rest as Omit<AsButton, keyof Common>)} className={cls}>{content}</button>
}
