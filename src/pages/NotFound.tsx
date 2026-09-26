import React from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center px-4 animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-[#0f2b48] mb-4 shadow-xs">
        <AlertCircle className="h-8 w-8 text-blue-600" />
      </div>
      <h1 className="font-['Outfit'] text-4xl font-extrabold text-[#0f2b48]">404</h1>
      <h2 className="mt-2 text-lg font-bold text-slate-800">Página não encontrada</h2>
      <p className="mt-1 max-w-sm text-xs text-slate-500">
        O endereço que você tentou acessar não existe ou foi movido na plataforma da FAUSP.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Link to="/">
          <Button size="sm" className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs">
            <Home className="mr-1.5 h-3.5 w-3.5" />
            Voltar ao Início
          </Button>
        </Link>
      </div>
    </div>
  )
}
