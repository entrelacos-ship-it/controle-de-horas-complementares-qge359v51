import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import type { Aluno, Lancamento, Categoria, ConfiguracaoGlobal } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  PieChart as PieIcon,
  Layers,
  Sparkles,
  Info,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
} from 'lucide-react'

export interface TurmaVisualizacaoGraficosProps {
  alunosFiltrados: Aluno[]
  lancamentos: Lancamento[]
  categorias: Categoria[]
  config: ConfiguracaoGlobal | null
  metricasPorAluno: Map<
    string,
    {
      totalGeral: number
      horasSemestre: number
      restanteSemestre: number
      cumpriu: boolean
      porcentagemCurso: number
    }
  >
  semestreAtual: string
  minimoSemestral: number
}

// Cores da paleta institucional FAUSP
const CORES = {
  navy: '#0f2b48',
  primary: '#1d4ed8',
  emerald: '#16a34a',
  amber: '#f59e0b',
  amberDark: '#d97706',
  sky: '#0284c7',
  indigo: '#4f46e5',
  teal: '#0d9488',
  rose: '#e11d48',
  slate: '#64748b',
}

const PALETA_CATEGORIAS = [
  '#1d4ed8', // azul royal
  '#0f2b48', // azul navy institucional
  '#0d9488', // teal
  '#f59e0b', // âmbar
  '#4f46e5', // índigo
  '#0284c7', // sky blue
  '#16a34a', // emerald
  '#8b5cf6', // roxo
  '#e11d48', // rose
  '#64748b', // slate
]

export function TurmaVisualizacaoGraficos({
  alunosFiltrados,
  lancamentos,
  categorias,
  config,
  metricasPorAluno,
  semestreAtual,
  minimoSemestral,
}: TurmaVisualizacaoGraficosProps) {
  // Controle de alternância de visualização por turma (Horas x Alunos Cumpriu/Não)
  const [modoTurma, setModoTurma] = useState<'horas' | 'status'>('horas')
  // Tipo de gráfico para categoria (Barras Horizontais x Rosca)
  const [modoCategoria, setModoCategoria] = useState<'barras' | 'rosca'>('barras')

  // Conjunto com IDs dos alunos filtrados para cálculo rápido
  const alunoIdsFiltradosSet = useMemo(() => {
    return new Set(alunosFiltrados.map((a) => a.id))
  }, [alunosFiltrados])

  // Lançamentos pertencentes aos alunos filtrados
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((l) => alunoIdsFiltradosSet.has(l.aluno_id))
  }, [lancamentos, alunoIdsFiltradosSet])

  // =========================================================================
  // 1. Dados de Distribuição por TURMA (Grupo: Período de Entrada + Turno)
  // Ex: "2024.2 Mat.", "2025.1 Not."
  // =========================================================================
  const dadosPorTurma = useMemo(() => {
    if (alunosFiltrados.length === 0) return []

    // Agrupar alunos por chave "Entrada - Turno"
    const grupos = new Map<
      string,
      {
        turmaKey: string
        entrada: string
        turno: string
        alunos: Aluno[]
        horasTotalGeral: number
        horasSemestreAtual: number
        totalAlunos: number
        cumpriram: number
        naoCumpriram: number
      }
    >()

    alunosFiltrados.forEach((aluno) => {
      const entrada = aluno.periodo_entrada || 'Indef.'
      const turno = aluno.turno || 'Geral'
      const chave = `${entrada} (${turno.slice(0, 4)}.)`

      if (!grupos.has(chave)) {
        grupos.set(chave, {
          turmaKey: chave,
          entrada,
          turno,
          alunos: [],
          horasTotalGeral: 0,
          horasSemestreAtual: 0,
          totalAlunos: 0,
          cumpriram: 0,
          naoCumpriram: 0,
        })
      }

      const g = grupos.get(chave)!
      g.alunos.push(aluno)
      g.totalAlunos += 1

      const met = metricasPorAluno.get(aluno.id)
      if (met) {
        g.horasTotalGeral += met.totalGeral
        g.horasSemestreAtual += met.horasSemestre
        if (met.cumpriu) {
          g.cumpriram += 1
        } else {
          g.naoCumpriram += 1
        }
      }
    })

    // Ordenar turmas por entrada cronológica reversa e nome
    return Array.from(grupos.values())
      .map((g) => {
        const mediaSemestre =
          g.totalAlunos > 0 ? Math.round((g.horasSemestreAtual / g.totalAlunos) * 10) / 10 : 0
        const mediaGeral =
          g.totalAlunos > 0 ? Math.round((g.horasTotalGeral / g.totalAlunos) * 10) / 10 : 0
        const percCumpriu = g.totalAlunos > 0 ? Math.round((g.cumpriram / g.totalAlunos) * 100) : 0

        return {
          turma: g.turmaKey,
          entrada: g.entrada,
          turno: g.turno,
          horasSemestre: g.horasSemestreAtual,
          horasTotal: g.horasTotalGeral,
          mediaSemestre,
          mediaGeral,
          totalAlunos: g.totalAlunos,
          cumpriu: g.cumpriram,
          naoCumpriu: g.naoCumpriram,
          percCumpriu,
        }
      })
      .sort((a, b) => b.entrada.localeCompare(a.entrada))
  }, [alunosFiltrados, metricasPorAluno])

  // =========================================================================
  // 2. Dados de Distribuição por CATEGORIA NDE no recorte filtrado
  // =========================================================================
  const dadosPorCategoria = useMemo(() => {
    if (alunosFiltrados.length === 0 || lancamentosFiltrados.length === 0) return []

    // Mapear categorias por id e nome
    const mapaCategorias = new Map<string, { nome: string; teto: number }>()
    categorias.forEach((c) => {
      mapaCategorias.set(c.id, { nome: c.nome, teto: c.teto_maximo_curso })
    })

    // Somar horas e contar atividades por categoria
    const somaPorCat = new Map<
      string,
      {
        categoriaId: string
        nome: string
        totalHoras: number
        horasSemestre: number
        qtdLancamentos: number
      }
    >()

    lancamentosFiltrados.forEach((l) => {
      const catId = l.categoria_id || 'outras'
      const catInfo = mapaCategorias.get(catId) || {
        nome: l.expand?.categoria_id?.nome || 'Outras Atividades',
        teto: 40,
      }

      if (!somaPorCat.has(catId)) {
        somaPorCat.set(catId, {
          categoriaId: catId,
          nome: catInfo.nome,
          totalHoras: 0,
          horasSemestre: 0,
          qtdLancamentos: 0,
        })
      }

      const item = somaPorCat.get(catId)!
      const h = Number(l.horas_aceitas) || 0
      item.totalHoras += h
      item.qtdLancamentos += 1
      if (l.semestre_letivo_atividade === semestreAtual) {
        item.horasSemestre += h
      }
    })

    // Retorna categorias com horas > 0 ou ordenadas decrescente de horas
    const lista = Array.from(somaPorCat.values())
      .filter((c) => c.totalHoras !== 0 || c.qtdLancamentos > 0)
      .sort((a, b) => b.totalHoras - a.totalHoras)

    const totalGeralSomado = lista.reduce((acc, cur) => acc + Math.max(0, cur.totalHoras), 0)

    return lista.map((c, idx) => ({
      ...c,
      nomeCurto: c.nome.length > 28 ? `${c.nome.slice(0, 26)}...` : c.nome,
      cor: PALETA_CATEGORIAS[idx % PALETA_CATEGORIAS.length],
      percentual:
        totalGeralSomado > 0 ? Math.round((Math.max(0, c.totalHoras) / totalGeralSomado) * 100) : 0,
    }))
  }, [alunosFiltrados, lancamentosFiltrados, categorias, semestreAtual])

  // Total geral acumulado pelas turmas filtradas
  const totalHorasFiltradas = useMemo(() => {
    return lancamentosFiltrados.reduce((sum, l) => sum + (Number(l.horas_aceitas) || 0), 0)
  }, [lancamentosFiltrados])

  const totalHorasSemestreAtualFiltradas = useMemo(() => {
    return lancamentosFiltrados
      .filter((l) => l.semestre_letivo_atividade === semestreAtual)
      .reduce((sum, l) => sum + (Number(l.horas_aceitas) || 0), 0)
  }, [lancamentosFiltrados, semestreAtual])

  const temAlunos = alunosFiltrados.length > 0
  const temLancamentos = lancamentosFiltrados.length > 0

  return (
    <div className="space-y-4">
      {/* Título de seção e cabeçalho informativo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f2b48] text-white shadow-xs">
            <BarChart3 className="h-5 w-5 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-['Outfit'] text-base font-bold tracking-tight text-[#0f2b48] sm:text-lg">
                Painel Visual de Horas por Turma & Categoria NDE
              </h2>
              <Badge
                variant="outline"
                className="bg-blue-50/70 border-blue-200 text-blue-800 text-[10px] font-semibold"
              >
                Recharts
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Análise comparativa das turmas e aderência das atividades pedagógicas no recorte atual
            </p>
          </div>
        </div>

        {/* Mini sumário rápido do recorte */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto text-xs">
          <div className="rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-slate-700">
            <span className="text-[11px] text-slate-500">Horas Semestre ({semestreAtual}): </span>
            <strong className="text-[#0f2b48] font-bold">
              {totalHorasSemestreAtualFiltradas}h
            </strong>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-slate-700">
            <span className="text-[11px] text-slate-500">Total Histórico: </span>
            <strong className="text-[#1d4ed8] font-bold">{totalHorasFiltradas}h</strong>
          </div>
        </div>
      </div>

      {/* Grid com os 2 Gráficos Recharts (Turma + Categoria) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* =========================================================================
            GRÁFICO 1: DISTRIBUIÇÃO POR TURMA (Entrada + Turno)
            ========================================================================= */}
        <Card className="border-slate-200 shadow-xs flex flex-col">
          <CardHeader className="p-4 pb-2 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="font-['Outfit'] text-sm font-bold text-[#0f2b48] flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-[#1d4ed8]" />
                  Distribuição por Turma (Entrada & Turno)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {modoTurma === 'horas'
                    ? `Comparação de horas aceitas no semestre ${semestreAtual} vs total acumulado`
                    : `Contagem de discentes CUMPRIU (≥ ${minimoSemestral}h) vs NÃO CUMPRIU`}
                </CardDescription>
              </div>

              {/* Botões alternadores de métrica */}
              <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setModoTurma('horas')}
                  className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
                    modoTurma === 'horas'
                      ? 'bg-white text-[#0f2b48] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Exibir volume de horas acumuladas e do semestre por turma"
                >
                  Horas (h)
                </button>
                <button
                  type="button"
                  onClick={() => setModoTurma('status')}
                  className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
                    modoTurma === 'status'
                      ? 'bg-white text-[#0f2b48] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Exibir contagem de discentes cumpriram vs não cumpriram"
                >
                  Alunos (Balanço)
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 flex-1 flex flex-col justify-center">
            {!temAlunos ? (
              <div className="py-12 text-center text-xs text-slate-500 space-y-1">
                <BarChart3 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">Sem dados para o filtro atual</p>
                <p className="text-slate-400">
                  Ajuste os filtros de Entrada, Turno ou Status para visualizar o gráfico por turma.
                </p>
              </div>
            ) : dadosPorTurma.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <p className="font-medium text-slate-600">Nenhuma turma com dados cadastrados.</p>
              </div>
            ) : (
              <div className="w-full">
                <div className="h-64 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {modoTurma === 'horas' ? (
                      <BarChart
                        data={dadosPorTurma}
                        margin={{ top: 10, right: 12, left: -10, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="turma"
                          stroke="#64748b"
                          fontSize={11}
                          tickLine={false}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                          height={40}
                        />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="h" />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              return (
                                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs space-y-1">
                                  <p className="font-bold text-[#0f2b48] border-b border-slate-100 pb-1">
                                    Turma {label} ({data.totalAlunos} discentes)
                                  </p>
                                  <p className="text-emerald-700 font-semibold flex items-center justify-between gap-4">
                                    <span>Semestre {semestreAtual}:</span>
                                    <span>
                                      {data.horasSemestre}h (média {data.mediaSemestre}h/aluno)
                                    </span>
                                  </p>
                                  <p className="text-[#1d4ed8] font-semibold flex items-center justify-between gap-4">
                                    <span>Total Geral Histórico:</span>
                                    <span>
                                      {data.horasTotal}h (média {data.mediaGeral}h/aluno)
                                    </span>
                                  </p>
                                  <p className="text-slate-500 text-[11px] pt-1 border-t border-slate-100">
                                    Cumpriram meta semestral: <strong>{data.cumpriu}</strong> de{' '}
                                    {data.totalAlunos} ({data.percCumpriu}%)
                                  </p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                        />
                        <Bar
                          dataKey="horasSemestre"
                          name={`Horas Semestre (${semestreAtual})`}
                          fill="#16a34a"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="horasTotal"
                          name="Total Geral Acumulado"
                          fill="#1d4ed8"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    ) : (
                      <BarChart
                        data={dadosPorTurma}
                        margin={{ top: 10, right: 12, left: -15, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="turma"
                          stroke="#64748b"
                          fontSize={11}
                          tickLine={false}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                          height={40}
                        />
                        <YAxis
                          stroke="#64748b"
                          fontSize={11}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              return (
                                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs space-y-1">
                                  <p className="font-bold text-[#0f2b48] border-b border-slate-100 pb-1">
                                    Turma {label} ({data.totalAlunos} discentes)
                                  </p>
                                  <p className="text-emerald-700 font-semibold flex items-center justify-between gap-4">
                                    <span>CUMPRIU (≥ {minimoSemestral}h):</span>
                                    <span>
                                      {data.cumpriu} ({data.percCumpriu}%)
                                    </span>
                                  </p>
                                  <p className="text-amber-700 font-semibold flex items-center justify-between gap-4">
                                    <span>NÃO CUMPRIU (&lt; {minimoSemestral}h):</span>
                                    <span>
                                      {data.naoCumpriu} ({100 - data.percCumpriu}%)
                                    </span>
                                  </p>
                                  <p className="text-slate-500 text-[11px] pt-1 border-t border-slate-100">
                                    Horas aceitas no semestre:{' '}
                                    <strong>{data.horasSemestre}h</strong>
                                  </p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                        />
                        <Bar
                          dataKey="cumpriu"
                          name={`CUMPRIU (≥ ${minimoSemestral}h)`}
                          fill="#16a34a"
                          stackId="status"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="naoCumpriu"
                          name={`NÃO CUMPRIU (< ${minimoSemestral}h)`}
                          fill="#f59e0b"
                          stackId="status"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Agrupamento por turma ({dadosPorTurma.length} grupos ativos no filtro)
                  </span>
                  <span className="text-[#0f2b48] font-medium">
                    Meta: {minimoSemestral}h semestrais
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* =========================================================================
            GRÁFICO 2: DISTRIBUIÇÃO POR CATEGORIA NDE NO RECORTE
            ========================================================================= */}
        <Card className="border-slate-200 shadow-xs flex flex-col">
          <CardHeader className="p-4 pb-2 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="font-['Outfit'] text-sm font-bold text-[#0f2b48] flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-[#1d4ed8]" />
                  Distribuição por Categoria NDE
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Horas complementares aceitas agrupadas pelas categorias da matriz curricular
                </CardDescription>
              </div>

              {/* Botões alternadores de tipo de visualização */}
              <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setModoCategoria('barras')}
                  className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
                    modoCategoria === 'barras'
                      ? 'bg-white text-[#0f2b48] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Exibir gráfico de barras horizontais ordenadas por horas"
                >
                  Barras
                </button>
                <button
                  type="button"
                  onClick={() => setModoCategoria('rosca')}
                  className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
                    modoCategoria === 'rosca'
                      ? 'bg-white text-[#0f2b48] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Exibir gráfico de rosca com distribuição percentual"
                >
                  Pizza / Rosca
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 flex-1 flex flex-col justify-center">
            {!temAlunos || !temLancamentos || dadosPorCategoria.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 space-y-1">
                <PieIcon className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">Sem dados para o filtro atual</p>
                <p className="text-slate-400">
                  Não há lançamentos de horas registrados para os alunos selecionados neste filtro.
                </p>
              </div>
            ) : (
              <div className="w-full">
                <div className="h-64 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {modoCategoria === 'barras' ? (
                      <BarChart
                        layout="vertical"
                        data={dadosPorCategoria}
                        margin={{ top: 5, right: 25, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" stroke="#64748b" fontSize={11} unit="h" />
                        <YAxis
                          type="category"
                          dataKey="nomeCurto"
                          stroke="#64748b"
                          fontSize={11}
                          tickLine={false}
                          width={140}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              return (
                                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs space-y-1 max-w-xs">
                                  <p className="font-bold text-[#0f2b48] border-b border-slate-100 pb-1">
                                    {data.nome}
                                  </p>
                                  <p className="text-[#1d4ed8] font-semibold flex items-center justify-between gap-4">
                                    <span>Total de Horas Aceitas:</span>
                                    <span>
                                      {data.totalHoras}h ({data.percentual}%)
                                    </span>
                                  </p>
                                  <p className="text-emerald-700 font-medium flex items-center justify-between gap-4">
                                    <span>Semestre {semestreAtual}:</span>
                                    <span>{data.horasSemestre}h</span>
                                  </p>
                                  <p className="text-slate-500 text-[11px]">
                                    {data.qtdLancamentos} atividades homologadas
                                  </p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Bar dataKey="totalHoras" name="Horas Aceitas" radius={[0, 4, 4, 0]}>
                          {dadosPorCategoria.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.cor} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : (
                      <PieChart>
                        <Pie
                          data={dadosPorCategoria}
                          dataKey="totalHoras"
                          nameKey="nome"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={2}
                        >
                          {dadosPorCategoria.map((entry, index) => (
                            <Cell key={`cell-pie-${index}`} fill={entry.cor} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              return (
                                <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-md text-xs space-y-1">
                                  <p className="font-bold text-[#0f2b48]">{data.nome}</p>
                                  <p className="text-[#1d4ed8] font-semibold">
                                    {data.totalHoras}h ({data.percentual}% do recorte)
                                  </p>
                                  <p className="text-slate-500 text-[11px]">
                                    Semestre {semestreAtual}: {data.horasSemestre}h
                                  </p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* Legenda compacta das categorias mais relevantes */}
                <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                  {dadosPorCategoria.slice(0, 5).map((cat) => (
                    <div key={cat.categoriaId} className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat.cor }}
                      />
                      <span
                        className="truncate max-w-[120px] sm:max-w-[140px] text-slate-700"
                        title={cat.nome}
                      >
                        {cat.nome}
                      </span>
                      <strong className="text-slate-900 font-bold">{cat.totalHoras}h</strong>
                    </div>
                  ))}
                  {dadosPorCategoria.length > 5 && (
                    <span className="text-[10px] text-slate-400">
                      +{dadosPorCategoria.length - 5} outras
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
