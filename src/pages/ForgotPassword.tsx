import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Mail, CheckCircle2, Loader2, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react'
import { LogoFausp } from '@/components/LogoFausp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setValidationError('Por favor, informe seu e-mail institucional.')
      return
    }

    // Validação básica de formato de e-mail
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setValidationError('Por favor, insira um formato de e-mail válido.')
      return
    }

    setIsLoading(true)

    try {
      // Chama o endpoint nativo do PocketBase (requestPasswordReset)
      await requestPasswordReset(cleanEmail)
    } catch (err: unknown) {
      // Registra silenciosamente no console por segurança (timing & enumeração)
      console.warn('Processamento de recuperação de senha:', err)
    } finally {
      setIsLoading(false)
      // Mensagem neutra de segurança: não revela se o e-mail existe ou não na base
      setSubmitted(true)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0f2b48] via-[#16385c] to-[#0a1e33] p-4 text-slate-100">
      <div className="w-full max-w-md">
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

        <div className="rounded-xl border border-white/10 bg-white p-6 shadow-2xl text-slate-900 sm:p-8">
          {submitted ? (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                Instruções de Redefinição
              </h2>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-left text-xs text-slate-600 space-y-2">
                <p className="font-medium text-slate-700">
                  Se o endereço informado estiver cadastrado no sistema, você receberá um e-mail com
                  um link seguro para criar uma nova senha.
                </p>
                <p className="text-[11px] text-slate-500">
                  Lembre-se de verificar também a pasta de spam ou lixo eletrônico. O link é de uso
                  único e expira automaticamente.
                </p>
              </div>

              <div className="pt-3 space-y-2">
                <Link to="/login" className="inline-block w-full">
                  <Button className="w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af] text-xs font-semibold shadow-sm">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para o Login
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false)
                    setEmail('')
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline transition-colors"
                >
                  Tentar com outro e-mail
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                    Esqueci minha senha
                  </h2>
                  <p className="text-xs text-slate-500">
                    Informe seu e-mail cadastrado para receber o link seguro de recuperação.
                  </p>
                </div>
                <LogoFausp
                  variant="horizontal"
                  theme="light"
                  size="sm"
                  className="hidden sm:block opacity-90 h-6"
                />
              </div>

              {validationError && (
                <Alert variant="destructive" className="mb-4 border-red-200 bg-red-50 text-red-900">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-xs font-medium">
                    {validationError}
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    E-mail Institucional
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="coordenacao@fausp.app"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (validationError) setValidationError(null)
                      }}
                      className="pl-9 text-sm focus-visible:ring-[#1d4ed8]"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af] transition-colors font-semibold shadow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando instruções...
                    </>
                  ) : (
                    'Enviar instruções de redefinição'
                  )}
                </Button>
              </form>

              <div className="mt-5 text-center border-t border-slate-100 pt-4">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-[#1d4ed8] transition-colors"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Voltar para tela de login
                </Link>
              </div>
            </>
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
