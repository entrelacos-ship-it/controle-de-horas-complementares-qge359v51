import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  GraduationCap,
  LayoutDashboard,
  Zap,
  Users,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  User as UserIcon,
  ShieldCheck,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { label: 'Início', path: '/', icon: LayoutDashboard },
    { label: 'Lançamento Rápido', path: '/lancamento', icon: Zap },
    { label: 'Alunos', path: '/alunos', icon: Users },
    { label: 'Turmas', path: '/turmas', icon: Building2 },
    { label: 'Configurações', path: '/configuracoes', icon: Settings },
  ]

  const getInitials = (name?: string) => {
    if (!name) return 'RA'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] text-[#0f172a]">
      {/* Top Navigation Bar in deep institutional navy #0f2b48 */}
      <header className="sticky top-0 z-40 w-full bg-[#0f2b48] text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Left */}
          <NavLink to="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1d4ed8] text-white shadow-inner">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-['Outfit'] text-base font-bold tracking-tight text-white sm:text-lg">
                Controle de Horas Complementares
              </span>
              <span className="text-xs font-normal text-slate-300">
                Curso de Psicologia · FAUSP
              </span>
            </div>
          </NavLink>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-1 md:flex">
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
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/20'
                      : 'text-slate-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* User Profile / Mobile Toggle */}
          <div className="flex items-center gap-3">
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full p-1 text-left ring-2 ring-transparent transition hover:ring-white/20 focus:outline-none focus:ring-[#1d4ed8]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1d4ed8] text-xs font-bold text-white shadow-sm">
                      {getInitials(user.name)}
                    </div>
                    <div className="hidden flex-col pr-1 text-left sm:flex">
                      <span className="text-xs font-semibold leading-tight text-white">
                        {user.name}
                      </span>
                      <span className="text-[11px] font-normal leading-tight text-slate-300">
                        {user.role || 'Coordenador'}
                      </span>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white text-slate-900 shadow-lg">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none text-slate-900">
                        {user.name}
                      </p>
                      <p className="text-xs leading-none text-slate-500">{user.email}</p>
                      <div className="pt-1.5">
                        <Badge
                          variant="secondary"
                          className={
                            user.role === 'Administrador'
                              ? 'bg-purple-100 text-purple-700 hover:bg-purple-100 text-[11px]'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-100 text-[11px]'
                          }
                        >
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          {user.role || 'Coordenador'}
                        </Badge>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile Hamburger button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-md p-1 text-slate-200 hover:bg-white/10 md:hidden"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile slide-in Drawer / Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-700 bg-[#0f2b48] px-4 py-3 md:hidden">
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
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-slate-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
              <div className="pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full justify-start text-xs"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair da Conta
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>

      {/* Slim institutional footer */}
      <footer className="border-t border-slate-200 bg-[#e2e8f0] py-3 text-center text-xs text-slate-600">
        <div className="mx-auto max-w-7xl px-4">
          © 2026 Coordenação do Curso de Psicologia — FAUSP · Prof.ª Roberta Andrea de Oliveira (CRP
          06/77114)
        </div>
      </footer>
    </div>
  )
}
