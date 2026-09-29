import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoFausp } from '@/components/LogoFausp'
import { useAuth } from '@/contexts/AuthContext'
import { useApp } from '@/contexts/AppContext'
import { getConfiguracaoGlobal } from '@/services/configuracao'
import { listarCategorias } from '@/services/categorias'
import { listarAlunos } from '@/services/alunos'
import { listarTodosLancamentos, listarLancamentosRecentes } from '@/services/lancamentos'
import { calcularHorasCategoria, isCategoriaBloqueada } from '@/lib/calculoHoras'
import { formatarMesAno } from '@/lib/formatadorDespacho'
import type { ConfiguracaoGlobal, Categoria, Aluno, Lancamento } from '@/types'
import {
  Users,
  Clock,
  Ban,
  AlertTriangle,
  Zap,
  ArrowRight,
  Settings,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function Index() {
  const { user } = useAuth()
  const appContext = useApp()
  const [config, setConfig] = useState<ConfiguracaoGlobal | null>(appContext.config)
  const [alunos, setAlunos] = useState<Aluno[]>(appContext.alunos)
  const [categorias, setCategorias] = useState<Categoria[]>(appContext.categorias)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(appContext.lancamentos)
  const [recentes, setRecentes] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(appContext.loading)

  // Sincroniza com o AppContext quando este atualizar
  useEffect(() => {
    if (appContext.config) setConfig(appContext.config)
    if (appContext.alunos.length > 0) setAlunos(appContext.alunos)
    if (appContext.categorias.length > 0) setCategorias(appContext.categorias)
    if (appContext.lancamentos.length > 0) {
      setLancamentos(appContext.lancamentos)
      setRecentes(appContext.lancamentos.slice(0, 5))
    }
    setLoading(appContext.loading)
  }, [
    appContext.config,
    appContext.alunos,
    appContext.categorias,
    appContext.lancamentos,
    appContext.loading,
  ])

  useEffect(() => {
    async function loadData() {
      try {
        // Se o AppContext já tiver os dados carregados, apenas puxa recentes caso necessário
        if (appContext.lancamentos.length > 0) {
          setRecentes(appContext.lancamentos.slice(0, 5))
          return
        }
        setLoading(true)
        const [cfg, als, cats, allLancs, recs] = await Promise.all([
          getConfiguracaoGlobal(),
          listarAlunos(),
          listarCategorias(),
          listarTodosLancamentos(),
          listarLancamentosRecentes(5),
        ])
        setConfig(cfg)
        setAlunos(als)
        setCategorias(cats)
        setLancamentos(allLancs)
        setRecentes(recs)
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err)
        // Fallback: usar dados do AppContext se disponíveis
        if (appContext.lancamentos.length > 0) {
          setRecentes(appContext.lancamentos.slice(0, 5))
        }
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [appContext.lancamentos])

  // Métricas
  const totalAlunos = alunos.length

  // Total de horas lançadas (soma absoluta das horas)
  const totalHorasLancadas = lancamentos.reduce((sum, l) => sum + (Number(l.horas_aceitas) || 0), 0)

  // Categorias bloqueadas (quantas categorias atingiram teto para pelo menos 1 aluno)
  const categoriasBloqueadasSet = new Set<string>()
  for (const a of alunos) {
    const lancsAluno = lancamentos.filter((l) => l.aluno_id === a.id)
    for (const cat of categorias) {
      const h = calcularHorasCategoria(cat.id, lancsAluno)
      if (isCategoriaBloqueada(h, cat.teto_maximo_curso)) {
        categoriasBloqueadasSet.add(`${a.id}_${cat.id}`)
      }
    }
  }
  const totalCategoriasBloqueadas = categoriasBloqueadasSet.size

  // Alunos com NÃO CUMPRIU no semestre letivo atual
  const semestreAtual = config?.semestre_letivo_atual || '2026.2'
  const minSemestral = config?.minimo_exigido_semestre || 20

  let alunosNaoCumpriu = 0
  for (const a of alunos) {
    const lancsAlunoSemestre = lancamentos.filter(
      (l) => l.aluno_id === a.id && l.semestre_letivo_atividade === semestreAtual,
    )
    const horasSemestre = lancsAlunoSemestre.reduce(
      (sum, l) => sum + (Number(l.horas_aceitas) || 0),
      0,
    )
    if (horasSemestre < minSemestral) {
      alunosNaoCumpriu++
    }
  }

  // Horas por categoria para o gráfico horizontal (semestre atual)
  const horasPorCategoriaAtual = categorias.map((cat, idx) => {
    const totalSemestre = lancamentos
      .filter((l) => l.categoria_id === cat.id && l.semestre_letivo_atividade === semestreAtual)
      .reduce((s, l) => s + Math.max(0, Number(l.horas_aceitas) || 0), 0)
    return {
      cat,
      horas: totalSemestre,
      color: ['#1d4ed8', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][idx % 6],
    }
  })
  const maxHorasCat = Math.max(...horasPorCategoriaAtual.map((c) => c.horas), 1)

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0f2b48] sm:text-3xl">
            Olá, {user?.name || 'Prof.ª Roberta'}
          </h1>
          <p className="text-sm text-slate-600">
            Painel Geral de Atividades Complementares de Psicologia (200h)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LogoFausp
            variant="horizontal"
            theme="light"
            size="sm"
            className="hidden md:block opacity-90 h-6"
          />
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-blue-900"
          >
            <Calendar className="h-3.5 w-3.5 text-[#1d4ed8]" />
            <span>
              Semestre Letivo Atual: <strong>{semestreAtual}</strong>
            </span>
          </Badge>
        </div>
      </div>

      {/* Summary Stat Cards (4 cards) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Alunos */}
        <Card className="border-slate-200 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total de Alunos
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#1d4ed8]">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-['Outfit'] text-3xl font-bold text-[#0f2b48]">
              {loading ? '—' : totalAlunos}
            </div>
            <p className="text-xs text-slate-500 mt-1">Estudantes matriculados ativos</p>
          </CardContent>
        </Card>

        {/* Card 2: Total de Horas Lançadas */}
        <Card className="border-slate-200 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total de Horas Lançadas
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-700">
              <Clock className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-['Outfit'] text-3xl font-bold text-[#0f2b48]">
              {loading ? '—' : `${totalHorasLancadas}h`}
            </div>
            <p className="text-xs text-slate-500 mt-1">Horas computadas no histórico geral</p>
          </CardContent>
        </Card>

        {/* Card 3: Categorias Bloqueadas */}
        <Card className="border-slate-200 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tetos Atingidos
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <Ban className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-['Outfit'] text-3xl font-bold text-red-700">
              {loading ? '—' : totalCategoriasBloqueadas}
            </div>
            <p className="text-xs text-slate-500 mt-1">Casos de categoria ⛔ BLOQUEADA</p>
          </CardContent>
        </Card>

        {/* Card 4: Alunos com NÃO CUMPRIU */}
        <Card className="border-slate-200 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Não Cumpriu Semestre
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-['Outfit'] text-3xl font-bold text-amber-600">
              {loading ? '—' : alunosNaoCumpriu}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Abaixo de {minSemestral}h em {semestreAtual} (alerta pedagógico)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions (3 shortcut cards) */}
      <div className="space-y-3">
        <h2 className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">Ações Rápidas</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            to="/lancamento"
            className="group flex items-center justify-between rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50/50 to-white p-5 shadow-sm transition-all duration-200 hover:border-[#1d4ed8] hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1d4ed8] text-white shadow-sm transition-transform group-hover:scale-105">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-['Outfit'] text-base font-bold text-[#0f2b48] group-hover:text-[#1d4ed8]">
                  Lançamento Rápido
                </h3>
                <p className="text-xs text-slate-500">
                  Deferir horas e gerar despacho oficial em 20s
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-[#1d4ed8]" />
          </Link>

          <Link
            to="/alunos"
            className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-transform group-hover:scale-105">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-['Outfit'] text-base font-bold text-[#0f2b48] group-hover:text-[#1d4ed8]">
                  Painel dos Alunos
                </h3>
                <p className="text-xs text-slate-500">
                  Gerenciar matrículas e visualizar prontuários individuais
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-[#1d4ed8]" />
          </Link>

          <Link
            to="/configuracoes"
            className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-transform group-hover:scale-105">
                <Settings className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-['Outfit'] text-base font-bold text-[#0f2b48] group-hover:text-[#1d4ed8]">
                  Configurações NDE
                </h3>
                <p className="text-xs text-slate-500">
                  Semestre letivo, metas e tabela de tetos de atividades
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-[#1d4ed8]" />
          </Link>
        </div>
      </div>

      {/* Two columns: Recent Activity (left) & Hours per Category Chart (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent Activity List (7 cols) */}
        <div className="lg:col-span-7">
          <Card className="border-slate-200 shadow-sm h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="font-['Outfit'] text-base font-bold text-[#0f2b48]">
                  Lançamentos Recentes
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Últimas atividades registradas no sistema
                </CardDescription>
              </div>
              <Link to="/lancamento">
                <Button variant="ghost" size="sm" className="text-xs text-[#1d4ed8]">
                  Novo Lançamento
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentes.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Nenhum lançamento registrado até o momento.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentes.map((l) => {
                    const aluno = l.expand?.aluno_id
                    const cat = l.expand?.categoria_id
                    const horas = Number(l.horas_aceitas) || 0
                    const isNegativo = horas < 0

                    return (
                      <div
                        key={l.id}
                        className="flex items-center justify-between py-3 transition hover:bg-slate-50/80 px-2 rounded-md"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-bold text-xs ${
                              isNegativo ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {isNegativo ? `${horas}h` : `+${horas}h`}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900 line-clamp-1">
                              {aluno?.nome || 'Estudante'}
                            </span>
                            <span className="text-xs text-slate-500 line-clamp-1">
                              {cat?.nome || 'Atividade'} · Semestre {l.semestre_letivo_atividade}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-slate-500 font-mono font-medium block">
                            {formatarMesAno(l.data_lancamento)}
                          </span>
                          {aluno && (
                            <Link
                              to={`/alunos/${aluno.id}`}
                              className="text-[11px] text-[#1d4ed8] hover:underline"
                            >
                              Ver painel
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Categories Bar Chart (5 cols) */}
        <div className="lg:col-span-5">
          <Card className="border-slate-200 shadow-sm h-full">
            <CardHeader className="pb-3">
              <CardTitle className="font-['Outfit'] text-base font-bold text-[#0f2b48]">
                Horas por Categoria no Semestre Atual ({semestreAtual})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Distribuição das atividades deferidas em {semestreAtual}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 pt-1">
                {horasPorCategoriaAtual.map(({ cat, horas, color }) => {
                  const perc = maxHorasCat > 0 ? (horas / maxHorasCat) * 100 : 0
                  return (
                    <div key={cat.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 truncate pr-2" title={cat.nome}>
                          {cat.nome}
                        </span>
                        <span className="font-semibold text-slate-900 shrink-0">{horas}h</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(horas > 0 ? 4 : 0, perc)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
