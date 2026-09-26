import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { GraduationCap, Lock, Mail, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const successMessage = (location.state as { message?: string })?.message || null
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      console.error('Falha de login:', err)
      setError('Credenciais inválidas. Verifique e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const fillDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword('Skip@Pass')
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

        {/* Card Form */}
        <div className="rounded-xl border border-white/10 bg-white p-6 shadow-2xl text-slate-900 sm:p-8">
          <div className="mb-5">
            <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
              Acesso à Coordenação
            </h2>
            <p className="text-xs text-slate-500">
              Informe suas credenciais institucionais para continuar.
            </p>
          </div>

          {successMessage && (
            <Alert className="mb-5 border-emerald-200 bg-emerald-50 text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-xs font-medium">{successMessage}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-5 border-red-200 bg-red-50 text-red-900">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
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
                  className="pl-9 text-sm"
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
                  className="text-xs text-[#1d4ed8] hover:underline font-medium"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af] transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar no Sistema'
              )}
            </Button>

            <div className="pt-1 text-center">
              <Link
                to="/esqueci-senha"
                className="text-xs text-[#1d4ed8] hover:underline font-medium"
              >
                Esqueci minha senha
              </Link>
            </div>
          </form>

          {/* Seed demo quick links */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-medium text-slate-500 mb-2">
              Contas de demonstração pré-configuradas:
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => fillDemoAccount('entre.lacos.psi.cursos@gmail.com')}
                className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <span>Prof.ª Roberta (Coordenadora)</span>
                <span className="font-mono text-[10px] text-blue-600">Preencher</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('tati@fausp.app')}
                className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <span>Tatiane (Administradora NDE)</span>
                <span className="font-mono text-[10px] text-purple-600">Preencher</span>
              </button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Acesso restrito à coordenação do curso de Psicologia.
        </p>
      </div>
    </div>
  )
}
