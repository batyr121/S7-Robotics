"use client"

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer'
import { LogOut, Ban as BanIcon, Trash2, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type ConfirmOptions = {
  title?: React.ReactNode
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  preset?: 'logout' | 'ban' | 'delete' | 'default'
  askReason?: boolean
  reasonPlaceholder?: string
}

const ConfirmContext = React.createContext<((opts: ConfirmOptions) => Promise<any>) | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{
    open: boolean
    options: ConfirmOptions
    resolve?: (v: any) => void
  }>({ open: false, options: {} })

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    return new Promise<any>((resolve) => {
      setState({ open: true, options: opts, resolve })
    })
  }, [])

  const close = () => setState({ open: false, options: {} })
  const onCancel = () => {
    state.resolve?.(false)
    close()
  }
  const [reason, setReason] = React.useState('')
  const onConfirm = () => {
    const ask = ((state.options.preset && (state.options.preset as any)) ? true : false)
      ? (state.options.preset === 'ban')
      : Boolean(state.options.askReason)
    state.resolve?.(ask ? { ok: true, reason } : true)
    close()
  }

  React.useEffect(() => {
    const el = typeof document !== 'undefined' ? (document.querySelector('.site-content') as HTMLElement | null) : null
    if (!el) return
    if (state.open) {
      try { (document.activeElement as HTMLElement | null)?.blur() } catch {}
      try { el.setAttribute('inert', '') } catch {}
      try { el.style.pointerEvents = 'none'; el.style.userSelect = 'none' } catch {}
    } else {
      try { el.removeAttribute('inert') } catch {}
      try { el.style.pointerEvents = ''; el.style.userSelect = '' } catch {}
    }
  }, [state.open])

  const preset = state.options.preset
  const presetDefaults: Record<string, Partial<ConfirmOptions>> = {
    logout: {
      title: 'Выйти из аккаунта?',
      description: 'Выход из аккаунта очистит локальные данные (кеш, черновики). Чтобы снова получить доступ, войдите в аккаунт заново.',
      confirmText: 'Выйти',
      cancelText: 'Отмена',
      variant: 'danger',
    },
    ban: {
      title: 'Забанить пользователя?',
      description: 'Пользователь потеряет доступ ко всем разделам. Укажите причину бана (она будет показана при входе).',
      confirmText: 'Подтвердить',
      cancelText: 'Отмена',
      variant: 'danger',
      askReason: true,
      reasonPlaceholder: 'Причина (необязательно)'
    },
    delete: {
      title: 'Удалить?',
      description: 'Это действие нельзя отменить.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      variant: 'danger',
    },
    default: {
      title: 'Подтвердите действие',
      description: 'Проверьте данные и подтвердите выполнение действия.',
      confirmText: 'Подтвердить',
      cancelText: 'Отмена',
      variant: 'default',
    }
  }

  const merged: ConfirmOptions = { ...(preset ? presetDefaults[preset] : {}), ...state.options }
  const { title = 'Подтвердите действие', description, confirmText = 'Подтвердить', cancelText = 'Отмена', variant = 'default', askReason, reasonPlaceholder } = merged
  const isDanger = variant === 'danger'
  const descToShow = description ?? (isDanger ? 'Это действие может быть опасным.' : 'Проверьте данные и подтвердите выполнение действия.')

  React.useEffect(() => { if (state.open) setReason('') }, [state.open, preset])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Drawer open={state.open} onOpenChange={(open) => { if (!open) onCancel() }}>
        <DrawerContent className="w-full sm:max-w-xl sm:mx-auto rounded-t-3xl sm:rounded-2xl border border-[#2a2a35] bg-[#16161c] text-white [&>div:first-child]:hidden">
          <DrawerHeader className="px-5 pt-5 pb-2 sm:px-6">
            <div className="flex items-center gap-3">
              {(() => {
                const Cls = preset === 'logout' ? LogOut : preset === 'ban' ? BanIcon : preset === 'delete' ? Trash2 : (isDanger ? AlertTriangle : Info)
                const color = isDanger ? '#ef4444' : '#00a3ff'
                return <Cls className="w-6 h-6" style={{ color }} />
              })()}
              <DrawerTitle className="text-white text-2xl md:text-xl font-semibold leading-tight">{title}</DrawerTitle>
            </div>
            {descToShow && (
              <DrawerDescription className={cn(isDanger ? 'text-red-400' : 'text-white/70', 'text-base md:text-base leading-relaxed mt-1')}>{descToShow}</DrawerDescription>
            )}
          </DrawerHeader>
          {askReason && (
            <div className="px-5 sm:px-6 pb-2">
              <textarea
                value={reason}
                onChange={(e)=>setReason(e.target.value)}
                placeholder={reasonPlaceholder || 'Причина (необязательно)'}
                className="w-full mt-2 bg-[#0f0f14] border border-[#2a2a35] rounded-xl text-white/90 px-3 py-2 min-h-[72px] placeholder:text-white/40 outline-none focus:border-[#00a3ff]"
              />
            </div>
          )}
          <DrawerFooter className="flex-col-reverse md:flex-row md:justify-end gap-3 md:gap-2 px-5 pb-5 sm:px-6">
            <DrawerClose asChild>
              <Button onClick={onCancel} variant="outline" className="w-full md:w-auto h-11 rounded-xl bg-transparent border border-white/15 text-white hover:bg-white/10">
                {cancelText}
              </Button>
            </DrawerClose>
            <Button
              onClick={onConfirm}
              className={cn(
                'w-full md:w-auto h-11 rounded-xl font-medium',
                isDanger
                  ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white'
                  : 'bg-[#00a3ff] hover:bg-[#0088cc] text-black',
              )}
            >
              {confirmText}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm должен использоваться внутри ConfirmProvider')
  return ctx
}
