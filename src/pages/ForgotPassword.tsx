import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { GraduationCap, Mail, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Chama o endpoint nativo do PocketBase
      await requestPasswordReset(email.trim())
    } catch (err: unknown) {
      console.error('Erro ao solicitar redefinição de senha:', err)
    } finally {
      setIsLoading(false)
      // Mensagem neutra de segurança: não revela se o e-mail existe ou não
      setSubmitted(true)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0f2b48] via-[#16385c] to-[#0a1e33] p-4 text-slate-100">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1d4ed8] text-white shadow-xl ring-4 ring-white/10">
            <GraduationCap className="h-10 w-10" />
          </div>
          <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Controle de Horas
          </h1>
          <p className="mt-1 text-sm text-slate-300">Coordenação do Curso de Psicologia — FAUSP</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white p-6 shadow-2xl text-slate-900 sm:p-8">
          {submitted ? (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                Instruções de Redefinição
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Se o e-mail estiver cadastrado, você receberá as instruções de redefinição com um
                link para criar uma nova senha.
              </p>
              <div className="pt-3">
                <Link to="/login" className="inline-block w-full">
                  <Button className="w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af] text-xs">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para o Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                  Esqueci minha senha
                </h2>
                <p className="text-xs text-slate-500">
                  Informe o seu e-mail institucional para receber as instruções de recuperação.
                </p>
              </div>

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
                  className="w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af] transition-colors"
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
                  className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Voltar para tela de login
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Acesso restrito à coordenação do curso de Psicologia.
        </p>
      </div>
    </div>
  )
}
