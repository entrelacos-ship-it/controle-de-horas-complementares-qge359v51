import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { CheckCircle2, AlertCircle, Loader2, Lock, ArrowLeft, ShieldCheck } from 'lucide-react'
import { LogoFausp } from '@/components/LogoFausp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
        {/* Header Branding */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3">
            <LogoFausp
              variant="circular"
              theme="dark"
              size="xl"
              className="h-20 w-20 shadow-2xl ring-4 ring-white/20 p-2.5"
            />
          </div>
          <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Controle de Horas Complementares
          </h1>
          <p className="mt-1 text-sm text-slate-300">Coordenação do Curso de Psicologia — FAUSP</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white p-6 shadow-2xl text-slate-900 sm:p-8 text-center space-y-4">
          {status === 'prompt' && (
            <>
              <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4 text-left">
                <div>
                  <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                    Confirmar Novo E-mail
                  </h2>
                  <p className="text-xs text-slate-500">
                    Digite sua senha atual para validar a alteração.
                  </p>
                </div>
                <LogoFausp
                  variant="horizontal"
                  theme="light"
                  size="sm"
                  className="hidden sm:block opacity-90 h-6"
                />
              </div>

              <form onSubmit={handleConfirm} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="current-password"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Sua Senha Atual
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="current-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 text-sm focus-visible:ring-[#1d4ed8]"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af] font-semibold shadow-sm"
                >
                  Confirmar Alteração
                </Button>
              </form>

              <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Cancelar e voltar ao login
                </Link>
              </div>
            </>
          )}

          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-10 w-10 animate-spin text-[#1d4ed8]" />
              <p className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                Confirmando novo e-mail...
              </p>
              <p className="text-xs text-slate-500">
                Aguarde enquanto autenticamos os dados junto ao servidor.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4 py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                E-mail Atualizado!
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">{message}</p>
              <div className="pt-3">
                <Link to="/login">
                  <Button className="w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af] text-xs font-semibold">
                    Ir para o Login
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4 py-2 text-left">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-['Outfit'] text-lg font-bold text-red-700">
                    Falha na Confirmação
                  </h2>
                  <p className="text-xs text-slate-600">{message}</p>
                </div>
              </div>
              <div className="pt-2">
                <Link to="/login">
                  <Button variant="outline" className="w-full text-xs">
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    Voltar ao Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 text-center space-y-1">
          <p className="flex items-center justify-center gap-1.5 text-xs text-slate-300 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-300" />
            Acesso restrito à coordenação do curso.
          </p>
          <p className="text-[11px] text-slate-400">
            Faculdade Unida de São Paulo — FAUSP · Psicologia
          </p>
        </div>
      </div>
    </div>
  )
}
