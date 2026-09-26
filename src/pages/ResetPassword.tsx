import React, { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { GraduationCap, Lock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Token de recuperação inválido ou ausente na URL.')
      return
    }

    if (password.length < 8) {
      setError('A nova senha deve possuir pelo menos 8 caracteres.')
      return
    }

    if (password !== passwordConfirm) {
      setError('As senhas não coincidem.')
      return
    }

    setIsLoading(true)
    try {
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 2500)
    } catch (err: unknown) {
      console.error(err)
      setError('Não foi possível redefinir a senha. O link pode ter expirado.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0f2b48] via-[#16385c] to-[#0a1e33] p-4 text-slate-100">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1d4ed8] text-white shadow-xl ring-4 ring-white/10">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-white">
            Criar Nova Senha
          </h1>
        </div>

        <div className="rounded-xl border border-white/10 bg-white p-6 shadow-2xl text-slate-900 sm:p-8">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                Senha Alterada com Sucesso!
              </h2>
              <p className="text-xs text-slate-600">Redirecionando para o login em instantes...</p>
              <Link to="/login" className="inline-block pt-2">
                <Button className="w-full bg-[#1d4ed8] text-xs">Ir para o Login Agora</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-900">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="pass" className="text-xs font-semibold text-slate-700">
                  Nova Senha (mínimo 8 caracteres)
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="pass"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="passConf" className="text-xs font-semibold text-slate-700">
                  Confirmação da Nova Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="passConf"
                    type="password"
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Nova Senha'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
