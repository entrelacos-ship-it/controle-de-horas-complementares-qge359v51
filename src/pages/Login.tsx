import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  Lock,
  Mail,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  MailWarning,
} from 'lucide-react'
import { LogoFausp } from '@/components/LogoFausp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function Login() {
  const { login, requestVerification } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showResendVerification, setShowResendVerification] = useState(false)
  const [isResendingVerification, setIsResendingVerification] = useState(false)
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const successMessage = (location.state as { message?: string })?.message || null
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setShowResendVerification(false)
    setVerificationFeedback(null)

    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setError('Por favor, informe seu e-mail institucional.')
      return
    }
    if (!password) {
      setError('Por favor, digite sua senha de acesso.')
      return
    }

    setIsLoading(true)

    try {
      await login(cleanEmail, password)
      navigate(from, { replace: true })
    } catch (err: any) {
      console.error('Falha de login:', err)
      const rawMessage = (err?.message || '').toLowerCase()
      const dataMessage = (err?.data?.message || '').toLowerCase()

      // Caso a conta precise de validação ou verificação pendente
      if (rawMessage.includes('verified') || dataMessage.includes('verified')) {
        setError('Esta conta ainda não confirmou o endereço de e-mail institucional.')
        setShowResendVerification(true)
      } else if (
        err?.status === 400 ||
        rawMessage.includes('failed to authenticate') ||
        rawMessage.includes('invalid')
      ) {
        setError('Credenciais inválidas. Verifique o e-mail e a senha informados.')
      } else {
        setError(
          'Não foi possível conectar ao sistema. Verifique suas credenciais ou tente novamente em instantes.',
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendEmailVerification = async () => {
    if (!email.trim() || isResendingVerification) return
    setIsResendingVerification(true)
    setVerificationFeedback(null)
    try {
      await requestVerification(email.trim())
      setVerificationFeedback(
        'E-mail de confirmação reenviado com sucesso! Verifique sua caixa de entrada.',
      )
    } catch (err) {
      console.error('Erro ao reenviar confirmação:', err)
      setVerificationFeedback('Se a conta existir, o link foi reenviado para sua caixa de entrada.')
    } finally {
      setIsResendingVerification(false)
    }
  }

  const fillDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword('Skip@Pass')
    setError(null)
    setShowResendVerification(false)
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

        {/* Card Form */}
        <div className="rounded-xl border border-white/10 bg-white p-6 shadow-2xl text-slate-900 sm:p-8">
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                Acesso à Coordenação
              </h2>
              <p className="text-xs text-slate-500">
                Informe suas credenciais institucionais para continuar.
              </p>
            </div>
            <LogoFausp
              variant="horizontal"
              theme="light"
              size="sm"
              className="hidden sm:block opacity-90 h-6"
            />
          </div>

          {successMessage && (
            <Alert className="mb-5 border-emerald-200 bg-emerald-50 text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-xs font-medium">{successMessage}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-5 border-red-200 bg-red-50 text-red-900">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <div className="space-y-2">
                <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                {showResendVerification && (
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResendEmailVerification}
                      disabled={isResendingVerification}
                      className="h-7 text-[11px] bg-white border-red-300 text-red-900 hover:bg-red-100"
                    >
                      {isResendingVerification ? (
                        <>
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                          Reenviando confirmação...
                        </>
                      ) : (
                        <>
                          <MailWarning className="mr-1.5 h-3.5 w-3.5" />
                          Reenviar e-mail de ativação
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </Alert>
          )}

          {verificationFeedback && (
            <Alert className="mb-5 border-blue-200 bg-blue-50 text-blue-950">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-xs font-medium">
                {verificationFeedback}
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
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-sm focus-visible:ring-[#1d4ed8]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Senha
                </Label>
                <Link
                  to="/esqueci-senha"
                  className="text-xs text-[#1d4ed8] hover:text-[#1e40af] hover:underline font-medium"
                >
                  Esqueci minha senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-9 text-sm focus-visible:ring-[#1d4ed8]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af] transition-colors shadow-sm font-semibold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando no sistema...
                </>
              ) : (
                'Entrar'
              )}
            </Button>

            <div className="pt-1 text-center">
              <Link
                to="/esqueci-senha"
                className="text-xs text-slate-600 hover:text-[#1d4ed8] hover:underline font-medium inline-flex items-center gap-1"
              >
                Esqueci minha senha?
              </Link>
            </div>
          </form>

          {/* Seed demo quick links */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-medium text-slate-500 mb-2 flex items-center justify-between">
              <span>Contas de demonstração pré-configuradas:</span>
              <span className="text-[10px] text-slate-400">Clique para testar</span>
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => fillDemoAccount('entre.lacos.psi.cursos@gmail.com')}
                className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 hover:bg-blue-50/70 hover:border-blue-200 transition-colors group"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800 group-hover:text-blue-900">
                    Prof.ª Roberta Andrea de Oliveira
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Coordenadora de Curso · entre.lacos.psi.cursos@gmail.com
                  </span>
                </div>
                <span className="font-mono text-[10px] text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded font-semibold">
                  Preencher
                </span>
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('tati@fausp.app')}
                className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 hover:bg-purple-50/70 hover:border-purple-200 transition-colors group"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800 group-hover:text-purple-900">
                    Tatiane Administradora
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Administradora NDE · tati@fausp.app
                  </span>
                </div>
                <span className="font-mono text-[10px] text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded font-semibold">
                  Preencher
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Nota institucional de rodapé */}
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
