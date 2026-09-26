import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { LogoFausp } from '@/components/LogoFausp'
import { Button } from '@/components/ui/button'

export default function ConfirmEmailChange() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'prompt' | 'loading' | 'success' | 'error'>('prompt')
  const [message, setMessage] = useState('')

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setStatus('error')
      setMessage('Token de alteração ausente na URL.')
      return
    }

    setStatus('loading')
    try {
      await pb.collection('users').confirmEmailChange(token, password)
      setStatus('success')
      setMessage('Seu novo e-mail foi confirmado com sucesso!')
    } catch (err) {
      console.error(err)
      setStatus('error')
      setMessage(
        'Não foi possível confirmar o novo e-mail. Verifique a senha ou se o link expirou.',
      )
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0f2b48] via-[#16385c] to-[#0a1e33] p-4 text-slate-100">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-white/10 bg-white p-6 shadow-2xl text-slate-900 sm:p-8 text-center space-y-4">
          <div className="mx-auto">
            <LogoFausp variant="circular" theme="light" size="lg" className="h-14 w-14 mx-auto" />
          </div>

          {status === 'prompt' && (
            <form onSubmit={handleConfirm} className="space-y-4 text-left">
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48] text-center">
                Confirmar Novo E-mail
              </h2>
              <p className="text-xs text-slate-500 text-center">
                Digite sua senha atual para confirmar a alteração do e-mail institucional.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Sua Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#1d4ed8] focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af]">
                Confirmar Alteração
              </Button>
            </form>
          )}

          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#1d4ed8]" />
              <p className="text-sm font-medium text-slate-700">Confirmando novo e-mail...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                E-mail Atualizado!
              </h2>
              <p className="text-xs text-slate-600">{message}</p>
              <div className="pt-2">
                <Link to="/login">
                  <Button className="w-full bg-[#1d4ed8] text-white">Ir para o Login</Button>
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h2 className="font-['Outfit'] text-xl font-bold text-red-700">
                Falha na Confirmação
              </h2>
              <p className="text-xs text-slate-600">{message}</p>
              <div className="pt-2">
                <Link to="/login">
                  <Button variant="outline" className="w-full">
                    Voltar ao Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
