import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'

// Pages
import Index from '@/pages/Index'
import Login from '@/pages/Login'
import LancamentoRapido from '@/pages/LancamentoRapido'
import AlunosList from '@/pages/AlunosList'
import AlunoIndividual from '@/pages/AlunoIndividual'
import Turmas from '@/pages/Turmas'
import Importacao from '@/pages/Importacao'
import ConfiguracoesNDE from '@/pages/ConfiguracoesNDE'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import VerifyEmail from '@/pages/VerifyEmail'
import ConfirmEmailChange from '@/pages/ConfirmEmailChange'
import NotFound from '@/pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/esqueci-senha" element={<ForgotPassword />} />
          <Route path="/forgot-password" element={<Navigate to="/esqueci-senha" replace />} />
          <Route path="/redefinir-senha" element={<ResetPassword />} />
          <Route path="/reset-password" element={<Navigate to="/redefinir-senha" replace />} />
          <Route path="/verificar-email" element={<VerifyEmail />} />
          <Route path="/verify-email" element={<Navigate to="/verificar-email" replace />} />
          <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />

          {/* Protected Main System Routes */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Index />} />
            <Route path="/lancamento" element={<LancamentoRapido />} />
            <Route path="/alunos" element={<AlunosList />} />
            <Route path="/alunos/:id" element={<AlunoIndividual />} />
            <Route path="/turmas" element={<Turmas />} />
            <Route path="/importacao" element={<Importacao />} />
            <Route path="/configuracoes" element={<ConfiguracoesNDE />} />
          </Route>

          {/* Fallback 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
