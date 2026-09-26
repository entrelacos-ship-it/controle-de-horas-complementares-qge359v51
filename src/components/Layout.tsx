import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useApp } from '@/contexts/AppContext'
import {
  GraduationCap,
  LayoutDashboard,
  Zap,
  Users,
  Building2,
  Settings,
  FileSpreadsheet,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  AlertTriangle,
  MailCheck,
  Loader2,
  Database,
  WifiOff,
  RefreshCw,
  HardDriveDownload,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function Layout() {
  const { user, logout, requestVerification } = useAuth()
  const {
    isOfflineMode,
    offlineLoadedAt,
    ultimoBackupSalvoEm,
    recarregarDados,
    forcarBackupLocal,
  } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null)
  const [tentandoReconectar, setTentandoReconectar] = useState(false)
  const [backupManualFeedback, setBackupManualFeedback] = useState(false)

  const handleTentarReconectar = async () => {
    try {
      setTentandoReconectar(true)
      await recarregarDados()
    } finally {
      setTentandoReconectar(false)
    }
  }

  const handleForcarBackupManual = () => {
    const ok = forcarBackupLocal()
    if (ok) {
      setBackupManualFeedback(true)
      setTimeout(() => setBackupManualFeedback(false), 2000)
    }
  }

  const formatarHoraBackup = (isoString?: string | null) => {
    if (!isoString) return 'nenhum'
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return 'recente'
    }
  }

  const handleResendVerification = async () => {
    if (!user?.email || resendingVerification) return
    setResendingVerification(true)
    setVerificationFeedback(null)
    try {
      await requestVerification(user.email)
      setVerificationFeedback('E-mail de verificação enviado! Confira sua caixa de entrada.')
    } catch (err: unknown) {
      console.error('Erro ao reenviar verificação:', err)
      setVerificationFeedback('Não foi possível reenviar agora. Tente novamente mais tarde.')
    } finally {
      setResendingVerification(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { label: 'Início', path: '/', icon: LayoutDashboard },
    { label: 'Lançamento Rápido', path: '/lancamento', icon: Zap },
    { label: 'Alunos', path: '/alunos', icon: Users },
    { label: 'Turmas', path: '/turmas', icon: Building2 },
    { label: 'Importação Legada', path: '/importacao', icon: FileSpreadsheet },
    { label: 'Configurações', path: '/configuracoes', icon: Settings },
  ]

  const getInitials = (name?: string) => {
    if (!name) return 'RA'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-[#0f172a]">
      {/* ========================================================
          DESKTOP SIDEBAR (fixa à esquerda, ~260px, fundo navy #0f2b48)
         ======================================================== */}
      <aside className="hidden md:flex md:w-[260px] md:flex-col md:fixed md:inset-y-0 z-40 bg-[#0f2b48] text-white shadow-xl border-r border-[#1a3d61]">
        {/* Brand / Logo Topo */}
        <div className="flex h-20 shrink-0 items-center px-5 border-b border-[#1b3e63]/70">
          <NavLink to="/" className="flex items-center gap-3 transition-opacity hover:opacity-95">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1d4ed8] text-white shadow-md ring-2 ring-white/10">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="font-['Outfit'] text-[15px] font-bold leading-tight tracking-tight text-white line-clamp-2">
                Horas Complementares
              </span>
              <span className="text-[11px] font-medium text-blue-200/80">Psicologia · FAUSP</span>
            </div>
          </NavLink>
        </div>

        {/* Navigation Items (verticais com destaque do ativo) */}
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400/80">
            Menu Principal
          </div>
          <nav className="flex flex-col space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`group flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#1d4ed8] text-white shadow-sm ring-1 ring-white/20'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-105 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-blue-300 shadow-sm" />
                  )}
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Perfil do Usuário na Base da Sidebar */}
        {user && (
          <div className="shrink-0 border-t border-[#1b3e63]/70 bg-[#0c2238] p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1d4ed8] text-xs font-bold text-white shadow-md ring-2 ring-white/15">
                {getInitials(user.name)}
              </div>
              <div className="flex flex-1 min-w-0 flex-col">
                <span className="truncate text-xs font-semibold leading-tight text-white">
                  {user.name}
                </span>
                <span className="truncate text-[11px] text-slate-300">{user.email}</span>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] py-0 px-1.5 h-4 font-normal ${
                      user.role === 'Administrador'
                        ? 'bg-purple-900/60 text-purple-200 border border-purple-400/30'
                        : 'bg-blue-900/60 text-blue-200 border border-blue-400/30'
                    }`}
                  >
                    <ShieldCheck className="mr-1 h-2.5 w-2.5" />
                    {user.role || 'Coordenador'}
                  </Badge>
                  {/* Status indicador discreto do backup local no perfil da sidebar */}
                  <span
                    title={
                      ultimoBackupSalvoEm
                        ? `Backup local ativo (salvo às ${formatarHoraBackup(ultimoBackupSalvoEm)})`
                        : 'Backup local aguardando dados'
                    }
                    className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
                    onClick={handleForcarBackupManual}
                  >
                    <Database className="h-2.5 w-2.5 text-blue-400" />
                    <span>
                      {backupManualFeedback ? 'Salvo!' : formatarHoraBackup(ultimoBackupSalvoEm)}
                    </span>
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Sair do sistema"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-red-500/20 hover:text-red-300 focus:outline-none focus:ring-1 focus:ring-red-400"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ========================================================
          MOBILE TOPBAR + SLIDE-IN DRAWER
         ======================================================== */}
      <div className="flex flex-1 flex-col md:pl-[260px]">
        {/* Mobile Header (visível apenas em telas menores) */}
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#1b3e63] bg-[#0f2b48] px-4 text-white shadow-md md:hidden">
          <NavLink to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1d4ed8] text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-['Outfit'] text-sm font-bold leading-tight text-white">
                Horas Complementares
              </span>
              <span className="text-[10px] text-slate-300">Psicologia · FAUSP</span>
            </div>
          </NavLink>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md p-1 text-slate-200 hover:bg-white/10"
            aria-label="Abrir menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Mobile Drawer Backdrop & Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Lateral Drawer deslizante */}
            <div className="fixed inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-[#0f2b48] text-white shadow-2xl transition-transform">
              {/* Drawer Top */}
              <div className="flex h-16 items-center justify-between border-b border-[#1b3e63] px-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1d4ed8] text-white">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <span className="font-['Outfit'] text-sm font-bold text-white">
                    Psicologia · FAUSP
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                  aria-label="Fechar menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Navigation Links */}
              <div className="flex-1 overflow-y-auto px-3 py-4">
                <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Navegação
                </div>
                <nav className="flex flex-col space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive =
                      item.path === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(item.path)
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium ${
                          isActive
                            ? 'bg-[#1d4ed8] text-white font-semibold'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    )
                  })}
                </nav>
              </div>

              {/* Drawer Footer com perfil do usuário */}
              {user && (
                <div className="shrink-0 border-t border-[#1b3e63] bg-[#0c2238] p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d4ed8] text-xs font-bold text-white">
                      {getInitials(user.name)}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold text-white">{user.name}</span>
                      <span className="truncate text-[11px] text-slate-400">{user.email}</span>
                      <span className="text-[10px] text-blue-300">
                        {user.role || 'Coordenador'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleLogout()
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-red-600/80 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair da Conta
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            MAIN CONTENT AREA
           ======================================================== */}
        <main className="flex-1">
          {/* Banner de Modo Offline / Resiliência por LocalStorage */}
          {isOfflineMode && (
            <div className="border-b border-amber-300 bg-amber-100/90 px-4 py-2 text-xs text-amber-950 shadow-xs backdrop-blur-xs">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                  <WifiOff className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>
                    <strong>Modo offline:</strong> exibindo dados do último salvamento local (
                    {formatarHoraBackup(offlineLoadedAt)}). Modo leitura temporário a partir do
                    cache local.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTentarReconectar}
                    disabled={tentandoReconectar}
                    className="h-6 border-amber-400 bg-white px-2 text-[11px] font-semibold text-amber-900 hover:bg-amber-50"
                  >
                    {tentandoReconectar ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Reconectando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Tentar reconectar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Banner discreto e não bloqueante de verificação pendente */}
          {user && user.verified === false && (
            <div className="border-b border-amber-200 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-900 shadow-xs backdrop-blur-xs">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Seu endereço de e-mail <strong>({user.email})</strong> ainda não foi verificado.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {verificationFeedback ? (
                    <span className="flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <MailCheck className="h-3.5 w-3.5" />
                      {verificationFeedback}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResendVerification}
                      disabled={resendingVerification}
                      className="h-7 border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100 hover:text-amber-950"
                    >
                      {resendingVerification ? (
                        <>
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                          Reenviando...
                        </>
                      ) : (
                        'Reenviar verificação'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>

        {/* Slim institutional footer com indicador de confiança de backup local */}
        <footer className="border-t border-slate-200 bg-[#e2e8f0] py-2.5 text-xs text-slate-600">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row">
            <div>
              © 2026 Coordenação do Curso de Psicologia — FAUSP · Prof.ª Roberta Andrea de Oliveira
              (CRP 06/77114)
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Database className="h-3.5 w-3.5 text-blue-600" />
                <span>
                  Último backup local:{' '}
                  <strong className="text-slate-700">
                    {ultimoBackupSalvoEm ? formatarHoraBackup(ultimoBackupSalvoEm) : 'Iniciando...'}
                  </strong>
                </span>
              </span>
              <button
                type="button"
                onClick={handleForcarBackupManual}
                title="Forçar salvamento imediato no localStorage"
                className="text-[10px] text-blue-700 hover:underline inline-flex items-center gap-0.5 ml-1"
              >
                <HardDriveDownload className="h-3 w-3" />
                <span>{backupManualFeedback ? 'Salvo!' : 'Salvar agora'}</span>
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
