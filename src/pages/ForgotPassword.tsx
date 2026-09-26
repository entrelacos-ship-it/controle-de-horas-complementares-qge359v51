import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { GraduationCap, Mail, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await pb.collection('users').requestPasswordReset(email.trim())
      setSubmitted(true)
    } catch (err: unknown) {
      console.error(err)
      setError('Não foi possível enviar o e-mail de redefinição. Verifique o endereço digitado.')
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
            Recuperação de Acesso
          </h1>
        </div>

        <div className="rounded-xl border border-white/10 bg-white p-6 shadow-2xl text-slate-900 sm:p-8">
          {submitted ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                Instruções Enviadas!
              </h2>
              <p className="text-xs text-slate-600">
                Se o e-mail <strong>{email}</strong> estiver cadastrado em nossa base, você receberá
                um link com as instruções para cadastrar uma nova senha.
              </p>
              <Link to="/login" className="inline-block pt-2">
                <Button variant="outline" className="w-full text-xs">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para o Login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                  Redefinir Senha
                </h2>
                <p className="text-xs text-slate-500">
                  Digite seu e-mail institucional para receber o link de recuperação.
                </p>
              </div>

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
                      required
                      placeholder="coordenacao@fausp.app"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                      Enviando...
                    </>
                  ) : (
                    'Enviar Link de Recuperação'
                  )}
                </Button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs text-slate-500 hover:text-slate-800"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Voltar para tela de login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
