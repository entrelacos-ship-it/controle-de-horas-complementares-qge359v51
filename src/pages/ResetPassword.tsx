import React, { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react'
import { LogoFausp } from '@/components/LogoFausp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function validarFormularioRedefinicao(
  token: string,
  pass: string,
  passConf: string,
): { valido: boolean; erro?: string } {
  if (!token || !token.trim()) {
    return { valido: false, erro: 'Token de recuperação ausente ou inválido no link.' }
  }
  if (!pass || pass.length < 8) {
    return { valido: false, erro: 'A nova senha deve possuir pelo menos 8 caracteres.' }
  }
  if (pass !== passConf) {
    return { valido: false, erro: 'As senhas informadas não são iguais.' }
  }
  return { valido: true }
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { confirmPasswordReset } = useAuth()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const validacao = validarFormularioRedefinicao(token, password, passwordConfirm)
    if (!validacao.valido) {
      setError(validacao.erro || 'Dados inválidos')
      return
    }

    setIsLoading(true)
    try {
      const { error: resetErr } = await confirmPasswordReset(token, password)
      if (resetErr) {
        throw resetErr
      }
      setSuccess(true)
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            message: 'Senha redefinida com sucesso. Faça login com suas novas credenciais.',
          },
        })
      }, 2000)
    } catch (err: unknown) {
      console.error('Erro na confirmação de redefinição:', err)
      setError(
        'Não foi possível redefinir a senha. O link pode estar expirado ou já ter sido utilizado.',
      )
    } finally {
      setIsLoading(false)
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
          {success ? (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                Senha Alterada com Sucesso!
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sua credencial de acesso foi atualizada. Redirecionando para a tela de login...
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  state={{
                    message: 'Senha redefinida com sucesso. Faça login com suas novas credenciais.',
                  }}
                  className="inline-block w-full"
                >
                  <Button className="w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af] text-xs">
                    Entrar Agora
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                    Redefinir senha
                  </h2>
                  <p className="text-xs text-slate-500">
                    Crie uma nova senha de no mínimo 8 caracteres para a sua conta.
                  </p>
                </div>
                <LogoFausp
                  variant="horizontal"
                  theme="light"
                  size="sm"
                  className="hidden sm:block opacity-90 h-6"
                />
              </div>

              {!token && (
                <Alert
                  variant="destructive"
                  className="mb-5 border-amber-200 bg-amber-50 text-amber-900"
                >
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs font-medium">
                    Link de redefinição incompleto ou sem token. Solicite um novo link se
                    necessário.
                  </AlertDescription>
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
                  <Label htmlFor="pass" className="text-xs font-semibold text-slate-700">
                    Nova Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="pass"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder="Mínimo 8 caracteres"
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

                <div className="space-y-1.5">
                  <Label htmlFor="passConf" className="text-xs font-semibold text-slate-700">
                    Confirmar Nova Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="passConf"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder="Repita a nova senha"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="pl-9 text-sm focus-visible:ring-[#1d4ed8]"
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
                      Redefinindo senha...
                    </>
                  ) : (
                    'Salvar Nova Senha'
                  )}
                </Button>
              </form>

              <div className="mt-5 text-center border-t border-slate-100 pt-4">
                <Link
                  to="/esqueci-senha"
                  className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Solicitar novo link de redefinição
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
