import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { GraduationCap, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Token de verificação ausente na URL.')
      return
    }

    pb.collection('users')
      .confirmVerification(token)
      .then(() => {
        setStatus('success')
        setMessage('Seu e-mail institucional foi confirmado com sucesso!')
      })
      .catch((err) => {
        console.error(err)
        setStatus('error')
        setMessage('O link de verificação expirou ou já foi utilizado.')
      })
  }, [token])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0f2b48] via-[#16385c] to-[#0a1e33] p-4 text-slate-100">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-white/10 bg-white p-6 shadow-2xl text-slate-900 sm:p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1d4ed8] text-white shadow-lg">
            <GraduationCap className="h-8 w-8" />
          </div>

          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#1d4ed8]" />
              <p className="text-sm font-medium text-slate-700">Verificando e-mail...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
                E-mail Verificado!
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
                Falha na Verificação
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
