import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { GraduationCap, CheckCircle2, AlertCircle, Loader2, Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function validarTokenVerificacao(token: string | null | undefined): {
  valido: boolean
  erro?: string
} {
  if (!token || !token.trim()) {
    return { valido: false, erro: 'Token de verificação ausente ou incompleto na URL.' }
  }
  return { valido: true }
}

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { confirmVerification, requestVerification } = useAuth()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [resendEmail, setResendEmail] = useState('')
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [resendMsg, setResendMsg] = useState('')

  useEffect(() => {
    const validacao = validarTokenVerificacao(token)
    if (!validacao.valido) {
      setStatus('error')
      setMessage(validacao.erro || 'Token de verificação ausente na URL.')
      return
    }

    confirmVerification(token)
      .then(({ error }) => {
        if (error) {
          throw error
        }
        setStatus('success')
        setMessage('E-mail verificado com sucesso. Você já pode entrar.')
      })
      .catch((err) => {
        console.error('Erro na confirmação de verificação:', err)
        setStatus('error')
        setMessage('O link de verificação expirou ou o token é inválido.')
      })
  }, [token, confirmVerification])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resendEmail.trim()) return

    setResendStatus('loading')
    try {
      await requestVerification(resendEmail.trim())
    } catch (err: unknown) {
      console.error('Erro ao reenviar verificação:', err)
    } finally {
      setResendStatus('done')
      setResendMsg('Se o e-mail estiver cadastrado, um novo link de confirmação foi enviado.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0f2b48] via-[#16385c] to-[#0a1e33] p-4 text-slate-100">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1d4ed8] text-white shadow-xl ring-4 ring-white/10">
            <GraduationCap className="h-10 w-10" />
          </div>
          <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Controle de Horas
          </h1>
          <p className="mt-1 text-sm text-slate-300">Coordenação do Curso de Psicologia — FAUSP</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white p-6 shadow-2xl text-slate-900 sm:p-8 text-center space-y-4">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-10 w-10 animate-spin text-[#1d4ed8]" />
              <p className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                Validando seu e-mail...
              </p>
              <p className="text-xs text-slate-500">
                Aguarde enquanto confirmamos o token de verificação.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4 py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                E-mail Verificado com Sucesso!
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {message || 'E-mail verificado com sucesso. Você já pode entrar.'}
              </p>
              <div className="pt-3">
                <Link
                  to="/login"
                  state={{ message: 'E-mail verificado com sucesso. Você já pode entrar.' }}
                  className="inline-block w-full"
                >
                  <Button className="w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af] text-xs">
                    Entrar no Sistema
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
                    Falha na Verificação
                  </h2>
                  <p className="text-xs text-slate-600">{message}</p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-700">
                  Deseja reenviar o link de confirmação?
                </p>

                {resendMsg ? (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2.5">
                    {resendMsg}
                  </div>
                ) : (
                  <form onSubmit={handleResend} className="space-y-2.5">
                    <div className="space-y-1">
                      <Label htmlFor="resendEmail" className="text-[11px] text-slate-600">
                        E-mail cadastrado
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          id="resendEmail"
                          type="email"
                          required
                          placeholder="seu.email@fausp.app"
                          value={resendEmail}
                          onChange={(e) => setResendEmail(e.target.value)}
                          className="pl-8 text-xs h-9 bg-white"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={resendStatus === 'loading'}
                      className="w-full bg-[#0f2b48] hover:bg-[#16385c] text-white text-xs h-8"
                    >
                      {resendStatus === 'loading' ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Reenviando...
                        </>
                      ) : (
                        'Reenviar Link de Verificação'
                      )}
                    </Button>
                  </form>
                )}
              </div>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Voltar para tela de login
                </Link>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Acesso restrito à coordenação do curso de Psicologia.
        </p>
      </div>
    </div>
  )
}
