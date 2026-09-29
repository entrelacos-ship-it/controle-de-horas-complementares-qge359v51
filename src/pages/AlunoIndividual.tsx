import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { buscarAlunoPorId } from '@/services/alunos'
import { listarCategorias } from '@/services/categorias'
import { listarLancamentosPorAluno } from '@/services/lancamentos'
import { getConfiguracaoGlobal } from '@/services/configuracao'
import {
  calcularProgressoAluno,
  calcularHorasCategoria,
  isCategoriaBloqueada,
} from '@/lib/calculoHoras'
import { gerarTextoDespacho, formatarMesAno } from '@/lib/formatadorDespacho'
import { gerarRelatorioAlunoPdf } from '@/lib/exportacaoRelatorioAlunoPdf'
import { LogoFausp } from '@/components/LogoFausp'
import type { Aluno, Categoria, Lancamento, ConfiguracaoGlobal, AlunoProgresso } from '@/types'
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Zap,
  Calendar,
  Clock,
  AlertTriangle,
  FileText,
  User,
  Loader2,
  HelpCircle,
  Download,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

export default function AlunoIndividual() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [config, setConfig] = useState<ConfiguracaoGlobal | null>(null)
  const [progresso, setProgresso] = useState<AlunoProgresso | null>(null)
  const [loading, setLoading] = useState(true)

  // Despacho Completo Modal
  const [despachoCompletoModal, setDespachoCompletoModal] = useState(false)
  const [textoDespacho, setTextoDespacho] = useState('')
  const [copied, setCopied] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  const carregarDadosAluno = async () => {
    if (!id) return
    try {
      setLoading(true)
      const [al, cats, lcs, cfg] = await Promise.all([
        buscarAlunoPorId(id),
        listarCategorias(),
        listarLancamentosPorAluno(id),
        getConfiguracaoGlobal(),
      ])
      setAluno(al)
      setCategorias(cats)
      setLancamentos(lcs)
      setConfig(cfg)

      const prog = calcularProgressoAluno(al, lcs, cats, cfg)
      setProgresso(prog)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao carregar prontuário',
        description: 'Não foi possível encontrar as informações deste estudante.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDadosAluno()
  }, [id])

  const handleGerarDespachoCompleto = () => {
    if (!aluno || !config) return

    // Pega a categoria com mais horas ou a primeira para abertura
    const catReferencia = categorias[0] || {
      id: '',
      nome: 'Geral',
      regra_horas_unitaria: '',
      teto_maximo_curso: 0,
      ativo: true,
    }

    const despacho = gerarTextoDespacho({
      aluno,
      categoriaAtividade: catReferencia,
      horasLancamento: 0,
      semestreAtividade: config.semestre_letivo_atual,
      lancamentosDoAluno: lancamentos,
      categorias,
      config,
      dataDespacho: new Date(),
    })

    setTextoDespacho(despacho)
    setDespachoCompletoModal(true)
  }

  const handleGerarRelatorioPdf = () => {
    if (!aluno) return
    try {
      setGerandoPdf(true)
      const { nomeArquivo } = gerarRelatorioAlunoPdf({
        aluno,
        lancamentos,
        categorias,
        config,
        salvarArquivo: true,
      })
      toast({
        title: 'Relatório em PDF gerado!',
        description: `Arquivo ${nomeArquivo} gerado e baixado com sucesso.`,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao gerar relatório PDF',
        description: 'Ocorreu uma falha ao renderizar o documento do aluno.',
        variant: 'destructive',
      })
    } finally {
      setGerandoPdf(false)
    }
  }

  const handleCopiarDespacho = async () => {
    if (!textoDespacho) return
    try {
      await navigator.clipboard.writeText(textoDespacho)
      setCopied(true)
      toast({
        title: 'Texto copiado!',
        description: 'Despacho oficial copiado para a área de transferência.',
      })
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1d4ed8]" />
      </div>
    )
  }

  if (!aluno || !config || !progresso) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-bold text-slate-800">Estudante não encontrado</h2>
        <Link to="/alunos" className="mt-4 inline-block text-sm text-[#1d4ed8] underline">
          Voltar para a lista de alunos
        </Link>
      </div>
    )
  }

  const restanteParaCurso = Math.max(0, progresso.metaCurso - progresso.totalGeralHoras)

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Back button and quick actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/alunos"
          className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Voltar para Lista de Alunos
        </Link>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleGerarRelatorioPdf}
            disabled={gerandoPdf}
            variant="outline"
            size="sm"
            className="text-xs text-[#0f2b48] border-[#0f2b48]/30 hover:bg-blue-50/70 font-semibold shadow-xs"
            title="Gerar e baixar documento PDF oficial de balanço pedagógico deste estudante"
          >
            {gerandoPdf ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-[#1d4ed8]" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5 text-[#1d4ed8]" />
            )}
            Gerar Relatório PDF
          </Button>

          <Button
            onClick={handleGerarDespachoCompleto}
            variant="outline"
            size="sm"
            className="text-xs text-[#0f2b48]"
          >
            <FileText className="mr-1.5 h-3.5 w-3.5 text-[#1d4ed8]" />
            Despacho Texto
          </Button>

          <Link to="/lancamento">
            <Button size="sm" className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs">
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              Novo Lançamento
            </Button>
          </Link>
        </div>
      </div>

      {/* Header Card: Student Personal & Academic Details */}
      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <LogoFausp
                variant="circular"
                theme="light"
                size="lg"
                className="h-12 w-12 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-['Outfit'] text-2xl font-bold text-[#0f2b48]">
                    {aluno.nome}
                  </h1>
                  <Badge className="bg-[#1d4ed8] text-white text-xs font-mono">
                    {aluno.matricula}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  {aluno.email} · Turno {aluno.turno} · Entrada {aluno.periodo_entrada} ·{' '}
                  {aluno.semestre_atual}º Semestre Atual
                </p>
              </div>
            </div>

            {/* Semester Balance Tag with pedagogical note */}
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">
                  Balanço Semestre {config.semestre_letivo_atual}:
                </span>
                {progresso.cumpriuSemestre ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 font-semibold text-xs px-2.5 py-0.5">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-green-600" />
                    CUMPRIU ({progresso.horasSemestreAtual}h / {progresso.minimoSemestral}h)
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-semibold text-xs px-2.5 py-0.5">
                    <AlertTriangle className="mr-1 h-3.5 w-3.5 text-amber-600" />
                    NÃO CUMPRIU ({progresso.horasSemestreAtual}h / {progresso.minimoSemestral}h)
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Alerta pedagógico — não gera DP ou reprovação
              </span>
            </div>
          </div>
        </div>

        {/* Global Progress Bar 0 to 200h */}
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">
                Progresso do Curso (200h Psicologia)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-['Outfit'] text-2xl font-bold text-[#0f2b48]">
                  {progresso.totalGeralHoras}h
                </span>
                <span className="text-xs text-slate-500">/ {progresso.metaCurso}h</span>
                <span className="text-xs font-semibold text-[#16a34a]">
                  ({progresso.porcentagemCurso}%)
                </span>
              </div>
            </div>

            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#16a34a] transition-all duration-500"
                style={{ width: `${progresso.porcentagemCurso}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-slate-500">
              <span>{progresso.totalGeralHoras} horas aceitas deferidas</span>
              <span>
                {restanteParaCurso > 0
                  ? `${restanteParaCurso}h restantes para integralizar o curso`
                  : 'Meta de 200h integralizada! 🎉'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards Grid by Category: shows cap, accumulated, progress bar, lock badge */}
      <div className="space-y-4">
        <div>
          <h2 className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
            Quadro de Categorias e Tetos Máximos
          </h2>
          <p className="text-xs text-slate-500">
            Acompanhamento individualizado por grupo de atividades e aplicação automática de travas
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {progresso.categoriasProgresso.map((cp) => {
            const isRed = cp.bloqueada || cp.porcentagem >= 100
            const isAmber = !isRed && cp.porcentagem >= 80

            let barColor = '#16a34a' // verde
            if (isAmber) barColor = '#f59e0b' // ambar
            if (isRed) barColor = '#dc2626' // vermelho

            return (
              <Card
                key={cp.categoria.id}
                className={`border-slate-200 shadow-sm transition-all duration-200 ${
                  cp.bloqueada ? 'border-l-4 border-l-red-600 bg-red-50/20' : ''
                }`}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-bold text-[#0f2b48] line-clamp-2">
                      {cp.categoria.nome}
                    </CardTitle>
                    {cp.bloqueada && (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] font-bold shrink-0">
                        <Ban className="mr-1 h-3 w-3" />⛔ BLOQUEADA
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-[11px] text-slate-500">
                    Regra: {cp.categoria.regra_horas_unitaria}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Teto: {cp.teto}h</span>
                    <span className="font-bold text-slate-900">
                      {cp.horasAcumuladas}h / {cp.teto}h
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, cp.porcentagem)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">{cp.porcentagem}% atingido</span>
                    <span className="font-medium text-slate-600">
                      {cp.bloqueada
                        ? 'Limite atingido'
                        : `Restam ${Math.max(0, cp.teto - cp.horasAcumuladas)}h`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Lançamentos History Table (Newest first, immutable - no edit/delete buttons) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-['Outfit'] text-lg font-bold text-[#0f2b48]">
              Histórico de Lançamentos
            </h2>
            <p className="text-xs text-slate-500">
              Registros imutáveis auditáveis. Correções são feitas exclusivamente por estorno
              negativo.
            </p>
          </div>
          <Badge variant="outline" className="text-xs text-slate-600">
            {lancamentos.length} {lancamentos.length === 1 ? 'registro' : 'registros'}
          </Badge>
        </div>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Mês/Ano</th>
                  <th className="px-4 py-3">Semestre</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Horas</th>
                  <th className="px-4 py-3 text-center">Comprovante</th>
                  <th className="px-4 py-3 text-center">Relatório</th>
                  <th className="px-4 py-3">Observação / Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lancamentos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                      Nenhum lançamento registrado para este estudante até o momento.
                    </td>
                  </tr>
                ) : (
                  lancamentos.map((l) => {
                    const horas = Number(l.horas_aceitas) || 0
                    const isNegativo = horas < 0
                    const catNome =
                      l.expand?.categoria_id?.nome ||
                      categorias.find((c) => c.id === l.categoria_id)?.nome ||
                      'Atividade'

                    return (
                      <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap font-mono font-medium">
                          {formatarMesAno(l.data_lancamento)}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-800">
                          {l.semestre_letivo_atividade}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-900 font-medium">{catNome}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                              isNegativo ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {isNegativo ? `${horas}h` : `+${horas}h`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {l.comprovante_ok ? (
                            <CheckCircle2 className="mx-auto h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="mx-auto h-4 w-4 text-slate-300" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {l.relatorio_ok ? (
                            <CheckCircle2 className="mx-auto h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="mx-auto h-4 w-4 text-slate-300" />
                          )}
                        </td>
                        <td
                          className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate"
                          title={l.observacao}
                        >
                          {l.observacao || <span className="text-slate-400 italic">—</span>}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal Despacho Completo */}
      <Dialog open={despachoCompletoModal} onOpenChange={setDespachoCompletoModal}>
        <DialogContent className="bg-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] text-xl font-bold text-[#0f2b48]">
              Despacho Oficial Completo — {aluno.nome}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Texto oficial padronizado com extrato completo das atividades para comunicação ao
              estudante.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-blue-200 bg-[#eef2f7] p-4 my-2">
            <pre className="font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap select-all">
              {textoDespacho}
            </pre>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDespachoCompletoModal(false)}
              className="text-xs"
            >
              Fechar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCopiarDespacho}
              className={`text-xs font-semibold ${
                copied
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-[#1d4ed8] text-white hover:bg-[#1e40af]'
              }`}
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" />
                  Texto copiado!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copiar Texto do Despacho
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
