import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listarAlunos, promoverTodosAlunos } from '@/services/alunos'
import { listarTodosLancamentos } from '@/services/lancamentos'
import { getConfiguracaoGlobal } from '@/services/configuracao'
import type { Aluno, Lancamento, ConfiguracaoGlobal } from '@/types'
import {
  Building2,
  Users,
  Filter,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

export default function Turmas() {
  const { toast } = useToast()

  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [config, setConfig] = useState<ConfiguracaoGlobal | null>(null)
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroEntrada, setFiltroEntrada] = useState('Todas')
  const [filtroTurno, setFiltroTurno] = useState('Todos')
  const [promovendo, setPromovendo] = useState(false)

  const carregarDados = async () => {
    try {
      setLoading(true)
      const [als, lcs, cfg] = await Promise.all([
        listarAlunos(),
        listarTodosLancamentos(),
        getConfiguracaoGlobal(),
      ])
      setAlunos(als)
      setLancamentos(lcs)
      setConfig(cfg)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao carregar dados da turma',
        description: 'Não foi possível carregar as turmas.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Lista de períodos de entrada distintos para o dropdown
  const periodosEntradaDistintos = Array.from(new Set(alunos.map((a) => a.periodo_entrada)))
    .filter(Boolean)
    .sort()
    .reverse()

  // Alunos filtrados
  const alunosFiltrados = alunos.filter((a) => {
    const matchEntrada = filtroEntrada === 'Todas' || a.periodo_entrada === filtroEntrada
    const matchTurno = filtroTurno === 'Todos' || a.turno === filtroTurno
    return matchEntrada && matchTurno
  })

  // Cálculos por aluno
  const semestreAtual = config?.semestre_letivo_atual || '2026.2'
  const minimoSemestral = config?.minimo_exigido_semestre || 20
  const metaCurso = config?.meta_curso || 200

  const calcularMetricasAluno = (alunoId: string) => {
    const lancsAluno = lancamentos.filter((l) => l.aluno_id === alunoId)
    const totalGeral = lancsAluno.reduce((sum, l) => sum + (Number(l.horas_aceitas) || 0), 0)
    const horasSemestre = lancsAluno
      .filter((l) => l.semestre_letivo_atividade === semestreAtual)
      .reduce((sum, l) => sum + (Number(l.horas_aceitas) || 0), 0)

    const restanteSemestre = Math.max(0, minimoSemestral - horasSemestre)
    const cumpriu = horasSemestre >= minimoSemestral
    const porcentagemCurso =
      metaCurso > 0 ? Math.min(100, Math.round((totalGeral / metaCurso) * 100)) : 0

    return {
      totalGeral,
      horasSemestre,
      restanteSemestre,
      cumpriu,
      porcentagemCurso,
    }
  }

  const handlePromoverSemestres = async () => {
    try {
      setPromovendo(true)
      const count = await promoverTodosAlunos()
      toast({
        title: 'Promoção semestral realizada!',
        description: `${count} alunos avançaram de semestre. Alunos no 10º permaneceram no 10º.`,
      })
      carregarDados()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao promover alunos',
        description: 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setPromovendo(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0f2b48] sm:text-3xl">
            Painel por Turma
          </h1>
          <p className="text-sm text-slate-600">
            Visão gerencial e balanço semestral das turmas ({semestreAtual})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs text-slate-700">
                <TrendingUp className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                Promover Semestres
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
                  Confirmar Promoção Semestral em Lote?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-slate-600 leading-relaxed">
                  Isso promoverá todos os alunos para o próximo semestre. Alunos no 10º semestre
                  permanecerão no 10º.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handlePromoverSemestres}
                  className="bg-[#1d4ed8] hover:bg-[#1e40af] text-xs font-semibold"
                >
                  {promovendo ? 'Promovendo...' : 'Sim, Promover Todos'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Filter by Período de Entrada */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Entrada / Turma:</span>
              <select
                value={filtroEntrada}
                onChange={(e) => setFiltroEntrada(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-[#1d4ed8] focus:outline-none"
              >
                <option value="Todas">Todas as Entradas</option>
                {periodosEntradaDistintos.map((p) => (
                  <option key={p} value={p}>
                    Turma {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Turno */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Turno:</span>
              <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                {['Todos', 'Matutino', 'Noturno'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFiltroTurno(t)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                      filtroTurno === t
                        ? 'bg-white text-[#0f2b48] shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Exibindo <strong>{alunosFiltrados.length}</strong> estudantes
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Grouped / Class View */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Estudante / Matrícula</th>
                <th className="px-4 py-3">Semestre</th>
                <th className="px-4 py-3">Total Geral (200h)</th>
                <th className="px-4 py-3">Horas Semestre ({semestreAtual})</th>
                <th className="px-4 py-3">Restante Semestre</th>
                <th className="px-4 py-3 text-center">Balanço Semestral</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#1d4ed8]" />
                    Carregando dados das turmas...
                  </td>
                </tr>
              ) : alunosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    Nenhum aluno encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                alunosFiltrados.map((aluno) => {
                  const { totalGeral, horasSemestre, restanteSemestre, cumpriu, porcentagemCurso } =
                    calcularMetricasAluno(aluno.id)

                  return (
                    <tr key={aluno.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          to={`/alunos/${aluno.id}`}
                          className="font-medium text-slate-900 hover:text-[#1d4ed8] hover:underline"
                        >
                          {aluno.nome}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span className="font-mono">{aluno.matricula}</span>
                          <span>•</span>
                          <span>{aluno.turno}</span>
                          <span>•</span>
                          <span>Entrada {aluno.periodo_entrada}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                        {aluno.semestre_atual}º Semestre
                      </td>

                      <td className="px-4 py-3 min-w-[150px]">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1">
                          <span>
                            {totalGeral}h / {metaCurso}h
                          </span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            {porcentagemCurso}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#16a34a]"
                            style={{ width: `${porcentagemCurso}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs font-semibold text-slate-800">
                        {horasSemestre}h
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-600">
                        {restanteSemestre > 0 ? (
                          <span className="text-amber-700 font-medium">
                            Faltam {restanteSemestre}h (mín {minimoSemestral}h)
                          </span>
                        ) : (
                          <span className="text-green-700 font-medium">Integralizado</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {cumpriu ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            <CheckCircle2 className="h-3 w-3" />
                            CUMPRIU
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            NÃO CUMPRIU
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Link to={`/alunos/${aluno.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-[#1d4ed8]">
                            Painel
                            <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pedagogical Note Amber Banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-amber-900 shadow-xs flex items-start gap-3">
        <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-amber-950">Aviso Pedagógico Institucional</p>
          <p className="text-amber-800 leading-relaxed">
            O status <strong>"NÃO CUMPRIU"</strong> é um <u>alerta pedagógico</u> de acompanhamento
            semestral e <strong>não gera DP (dependência) ou reprovação</strong>. O estudante pode
            compensar as horas nos semestres subsequentes até a integralização das 200h totais do
            curso de Psicologia.
          </p>
        </div>
      </div>
    </div>
  )
}
