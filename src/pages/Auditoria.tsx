import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  ShieldCheck,
  Calendar,
  User as UserIcon,
  HardDriveDownload,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Database,
  History,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  listarAtasNDE,
  listarAtasNDEPocketBase,
  salvarAtaNDEAsync,
  listarLogsAuditoriaRegistrados,
  listarLogsAuditoriaPocketBase,
  consolidarTrilhaAuditoriaGlobal,
  calcularBalancoAoVivoSemestre,
} from '@/services/auditoria'
import { gerarAtaNdePdf } from '@/lib/exportacaoAtaNdePdf'
import { calcularProgressoAluno } from '@/lib/calculoHoras'
import type { AtaNDE, TipoEventoAuditoria } from '@/types/auditoria'

export default function Auditoria() {
  const { config, alunos, lancamentos, categorias, ultimoBackupSalvoEm, forcarBackupLocal } =
    useApp()
  const { user } = useAuth()
  const { toast } = useToast()

  const [abaAtiva, setAbaAtiva] = useState<'fechamento' | 'trilha'>('fechamento')
  const [atas, setAtas] = useState<AtaNDE[]>(() => listarAtasNDE())
  const [logsRegistrados, setLogsRegistrados] = useState<any[]>(() =>
    listarLogsAuditoriaRegistrados(),
  )
  const [modalHomologarAberto, setModalHomologarAberto] = useState(false)
  const [homologando, setHomologando] = useState(false)

  // Carrega atas e logs do PocketBase ao montar
  React.useEffect(() => {
    let ativo = true
    Promise.all([listarAtasNDEPocketBase(), listarLogsAuditoriaPocketBase()]).then(
      ([atasPb, logsPb]) => {
        if (!ativo) return
        if (atasPb && atasPb.length > 0) setAtas(atasPb)
        if (logsPb && logsPb.length > 0) setLogsRegistrados(logsPb)
      },
    )
    return () => {
      ativo = false
    }
  }, [])

  // Filtros da Trilha de Auditoria
  const [buscaTrilha, setBuscaTrilha] = useState('')
  const [filtroTipoEvento, setFiltroTipoEvento] = useState<string>('todos')

  // Semestre ativo e coordenadora
  const semestreAtivo = config?.semestre_letivo_atual || '2026.2'
  const minimoSemestral = Number(config?.minimo_exigido_semestre) || 20
  const metaCurso = Number(config?.meta_curso) || 200
  const nomeCoordenadora = config?.nome_da_coordenadora || 'Roberta Andrea de Oliveira'
  const crpCoordenadora = config?.crp_coordenadora || '06/77114'

  // Aluno em foco para o cabeçalho superior
  const [alunoFocoId, setAlunoFocoId] = useState<string>(() => {
    return alunos.length > 0 ? alunos[0].id : ''
  })

  // Se o alunoFocoId estiver vazio mas houver alunos, seleciona o primeiro
  const alunoFoco = useMemo(() => {
    if (alunoFocoId) {
      const a = alunos.find((x) => x.id === alunoFocoId)
      if (a) return a
    }
    return alunos[0] || null
  }, [alunoFocoId, alunos])

  // Progresso do aluno em foco
  const progressoAlunoFoco = useMemo(() => {
    if (!alunoFoco) return null
    const lancs = lancamentos.filter((l) => l.aluno_id === alunoFoco.id)
    return calcularProgressoAluno(alunoFoco, lancs, categorias, config)
  }, [alunoFoco, lancamentos, categorias, config])

  // Balanço ao vivo do semestre ativo
  const balanco = useMemo(() => {
    return calcularBalancoAoVivoSemestre({
      semestreAtivo,
      alunos,
      lancamentos,
      categorias,
      config,
    })
  }, [semestreAtivo, alunos, lancamentos, categorias, config])

  // Verifica se o semestre ativo já foi homologado
  const ataDoSemestreAtivo = useMemo(() => {
    return atas.find((a) => a.semestre_letivo === semestreAtivo)
  }, [atas, semestreAtivo])

  const semestreEstaFechado = Boolean(ataDoSemestreAtivo)

  // Trilha global de auditoria consolidada
  const trilhaGlobal = useMemo(() => {
    return consolidarTrilhaAuditoriaGlobal({
      lancamentos,
      alunos,
      categorias,
      atas,
      logsRegistrados,
    })
  }, [lancamentos, alunos, categorias, atas, logsRegistrados])

  // Filtragem da trilha
  const trilhaFiltrada = useMemo(() => {
    return trilhaGlobal.filter((item) => {
      if (filtroTipoEvento !== 'todos' && item.tipo_evento !== filtroTipoEvento) {
        return false
      }
      if (buscaTrilha.trim()) {
        const q = buscaTrilha.toLowerCase()
        const matchDesc = item.descricao.toLowerCase().includes(q)
        const matchAluno = item.aluno_nome?.toLowerCase().includes(q)
        const matchMat = item.aluno_matricula?.toLowerCase().includes(q)
        const matchAtor = item.ator_nome?.toLowerCase().includes(q)
        if (!matchDesc && !matchAluno && !matchMat && !matchAtor) {
          return false
        }
      }
      return true
    })
  }, [trilhaGlobal, filtroTipoEvento, buscaTrilha])

  // Formatação da hora do backup
  const formatarHoraBackup = (isoString?: string | null) => {
    if (!isoString) return 'recente'
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

  // Executar homologação do semestre ativo
  const handleConfirmarHomologacao = async () => {
    setHomologando(true)
    try {
      // Calcular número sequencial para o ano da homologação
      const anoAtual = new Date().getFullYear()
      const totalAtasAno = atas.filter((a) => a.numero_ata.includes(String(anoAtual))).length
      const proximoNumero = String(totalAtasAno + 1).padStart(2, '0')
      const numeroAta = `${proximoNumero}/${anoAtual}`

      const novaAta = await salvarAtaNDEAsync({
        numero_ata: numeroAta,
        semestre_letivo: semestreAtivo,
        data_homologacao: new Date().toISOString(),
        status: 'HOMOLOGADA',
        total_alunos_avaliados: balanco.totalAlunosAvaliados,
        total_concluintes_aptos: balanco.totalAptosColacao,
        total_cumpriram_meta: balanco.totalCumpriramMeta,
        total_alerta_pedagogico: balanco.totalAlertaPedagogico,
        total_horas_deferidas: balanco.totalHorasDeferidasSemestre,
        presidente_coordenadora: nomeCoordenadora,
        crp_coordenadora: crpCoordenadora,
        resumo_deliberacao: `Ata ordinária de fechamento do semestre letivo ${semestreAtivo}. Homologadas ${balanco.totalHorasDeferidasSemestre} horas complementares deferidas pelo NDE com certificação oficial para a Secretaria Acadêmica Geral.`,
        dados_balanco: balanco.balancoAlunos,
      })

      setAtas((prev) => [novaAta, ...prev.filter((a) => a.id !== novaAta.id)])
      setModalHomologarAberto(false)

      // Atualiza logs registrados para refletir na trilha
      const logsAtualizados = await listarLogsAuditoriaPocketBase()
      setLogsRegistrados(logsAtualizados)

      toast({
        title: `Semestre ${semestreAtivo} homologado com sucesso!`,
        description: `Ata NDE N° ${numeroAta} gerada e arquivada formalmente no sistema.`,
      })
    } catch (e) {
      console.error('Erro ao homologar:', e)
      toast({
        title: 'Erro na homologação',
        description: 'Não foi possível registrar a ata no momento.',
        variant: 'destructive',
      })
    } finally {
      setHomologando(false)
    }
  }

  // Baixar Ata Oficial em PDF
  const handleBaixarAta = (ata: AtaNDE) => {
    try {
      gerarAtaNdePdf({
        ata,
        alunos,
        lancamentos,
        categorias,
        config,
        salvarArquivo: true,
      })
      toast({
        title: 'Download iniciado',
        description: `Ata NDE N° ${ata.numero_ata} gerada em PDF oficial.`,
      })
    } catch (e) {
      console.error('Erro ao gerar PDF da ata:', e)
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Falha na compilação do relatório da ata.',
        variant: 'destructive',
      })
    }
  }

  // Exportar Trilha de Auditoria em CSV
  const handleExportarTrilhaCsv = () => {
    if (trilhaFiltrada.length === 0) return

    const cabecalho = [
      'ID',
      'Data/Hora',
      'Tipo do Evento',
      'Ator Responsável',
      'Estudante',
      'Matrícula',
      'Semestre',
      'Descrição',
    ]
    const linhas = trilhaFiltrada.map((item) => [
      item.id,
      new Date(item.created).toLocaleString('pt-BR'),
      item.tipo_evento,
      item.ator_nome,
      item.aluno_nome || '—',
      item.aluno_matricula || '—',
      item.semestre_letivo || '—',
      `"${item.descricao.replace(/"/g, '""')}"`,
    ])

    const csvContent =
      '\uFEFF' + [cabecalho.join(';'), ...linhas.map((l) => l.join(';'))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `trilha-auditoria-nde-${semestreAtivo}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Trilha exportada',
      description: 'Arquivo CSV com o log global de auditoria foi gerado com sucesso.',
    })
  }

  // Badge visual por tipo de evento da auditoria
  const renderBadgeEvento = (tipo: TipoEventoAuditoria) => {
    switch (tipo) {
      case 'HOMOLOGACAO_SEMESTRE':
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] py-0 px-2 font-medium">
            <ShieldCheck className="mr-1 h-3 w-3" />
            Homologação NDE
          </Badge>
        )
      case 'ESTORNO_REGISTRADO':
        return (
          <Badge className="bg-red-600 hover:bg-red-700 text-white text-[10px] py-0 px-2 font-medium">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Estorno
          </Badge>
        )
      case 'IMPORTACAO_LEGADA':
        return (
          <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] py-0 px-2 font-medium">
            <FileSpreadsheet className="mr-1 h-3 w-3" />
            Importação Legada
          </Badge>
        )
      case 'VIRADA_SEMESTRE':
        return (
          <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] py-0 px-2 font-medium">
            <Sparkles className="mr-1 h-3 w-3" />
            Virada Semestre
          </Badge>
        )
      case 'CONFIGURACAO_ALTERADA':
        return (
          <Badge className="bg-slate-700 hover:bg-slate-800 text-white text-[10px] py-0 px-2 font-medium">
            Regulamento NDE
          </Badge>
        )
      case 'ALUNO_EXCLUIDO':
        return (
          <Badge className="bg-rose-700 hover:bg-rose-800 text-white text-[10px] py-0 px-2 font-medium">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Aluno Excluído
          </Badge>
        )
      case 'LANCAMENTO_CRIADO':
      default:
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] py-0 px-2 font-medium">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Lançamento
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================
          CABEÇALHO SUPERIOR (Fiel ao layout de referência)
          Breadcrumb + Título + Barra de Ações (Semestre, Aluno em Foco, Backup)
         ======================================================== */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0f2b48]">
            Auditoria & Fechamento de Semestre Letivo
          </h1>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>FAUSP</span>
            <span>·</span>
            <span>Psicologia</span>
            <span>·</span>
            <span className="text-[#1d4ed8] font-semibold">NDE</span>
          </div>
        </div>

        {/* Barra de Controles à direita do topo */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Chip do Semestre Letivo Ativo */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span>
              Semestre: <strong className="text-slate-900 font-mono">{semestreAtivo}</strong>
            </span>
          </div>

          {/* Seletor Aluno em Foco */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-2xs">
            <UserIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span className="text-slate-500 hidden sm:inline">Aluno em Foco:</span>
            <Select value={alunoFocoId} onValueChange={setAlunoFocoId}>
              <SelectTrigger className="h-7 border-0 bg-transparent p-0 text-xs font-semibold text-slate-800 shadow-none focus:ring-0 w-[180px] sm:w-[220px]">
                <SelectValue placeholder="Selecione um aluno..." />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {alunos.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.nome} ({a.matricula} · {a.semestre_atual}º Sem)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Total do Aluno em Foco + Badge Cumpriu */}
            {progressoAlunoFoco && (
              <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                <span className="font-mono font-bold text-slate-800 text-[11px]">
                  {progressoAlunoFoco.totalGeralHoras}h / {metaCurso}h
                </span>
                {progressoAlunoFoco.cumpriuSemestre ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[9px] py-0 px-1.5 h-4 font-semibold">
                    CUMPRIU
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[9px] py-0 px-1.5 h-4 font-semibold">
                    NÃO CUMPRIU
                  </Badge>
                )}
                {alunoFoco && (
                  <Link
                    to={`/alunos/${alunoFoco.id}`}
                    title="Ver perfil completo do aluno"
                    className="text-slate-400 hover:text-blue-600 ml-0.5"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Indicador de Backup Local */}
          <div
            onClick={forcarBackupLocal}
            title="Clique para forçar salvamento imediato do backup local"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-2xs cursor-pointer hover:bg-emerald-100/80 transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Backup Ativo ({formatarHoraBackup(ultimoBackupSalvoEm)})</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          BANNER DE GOVERNANÇA NDE (Navy escuro #0f2b48)
         ======================================================== */}
      <div className="relative overflow-hidden rounded-xl bg-[#0f2b48] p-6 sm:p-8 text-white shadow-lg border border-[#1a3d61]">
        {/* Detalhe estético em degradê institucional */}
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-[#1d4ed8]/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold uppercase tracking-wider text-[10px] py-0.5 px-2">
                GOVERNANÇA NDE
              </Badge>
              <span className="text-xs text-blue-200 font-medium">
                Regimento CNE/CES · Semestre Ativo: <strong>{semestreAtivo}</strong>
              </span>
            </div>

            <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              Auditoria & Fechamento de Semestre Letivo
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Consolidação formal de horas complementares, emissão da Ata Oficial NDE para a
              Secretaria Acadêmica e rastreabilidade imutável de deferimentos e estornos.
            </p>
          </div>

          {/* Botão de Destaque Âmbar: Homologar Semestre */}
          <div className="shrink-0">
            <Button
              onClick={() => setModalHomologarAberto(true)}
              className="bg-[#f59e0b] hover:bg-[#d97706] text-slate-950 font-bold text-sm px-6 py-5 shadow-lg flex items-center gap-2 transition-all hover:scale-[1.02] border border-amber-300"
            >
              <ShieldCheck className="h-5 w-5 text-slate-950" />
              <span>Homologar Semestre {semestreAtivo}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================
          DUAS ABAS PRINCIPAIS:
          1. Fechamento & Atas NDE ({atas.length})
          2. Trilha Global de Auditoria ({trilhaGlobal.length})
         ======================================================== */}
      <Tabs
        value={abaAtiva}
        onValueChange={(v) => setAbaAtiva(v as 'fechamento' | 'trilha')}
        className="space-y-5"
      >
        <div className="border-b border-slate-200">
          <TabsList className="bg-transparent h-10 p-0 space-x-6">
            <TabsTrigger
              value="fechamento"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#1d4ed8] data-[state=active]:text-[#0f2b48] rounded-none px-1 pb-2.5 font-semibold text-xs sm:text-sm text-slate-500 hover:text-slate-800 flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              <span>Fechamento & Atas NDE</span>
              <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-bold">
                {atas.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="trilha"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#1d4ed8] data-[state=active]:text-[#0f2b48] rounded-none px-1 pb-2.5 font-semibold text-xs sm:text-sm text-slate-500 hover:text-slate-800 flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              <span>Trilha Global de Auditoria</span>
              <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-bold">
                {trilhaGlobal.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ========================================================
            ABA 1: FECHAMENTO & ATAS NDE
           ======================================================== */}
        <TabsContent value="fechamento" className="space-y-6 m-0">
          {/* Card: BALANÇO AO VIVO DO SEMESTRE */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    BALANÇO AO VIVO DO SEMESTRE
                  </span>
                  <CardTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48] flex items-center gap-2">
                    <span>Semestre Letivo {semestreAtivo}</span>
                    <span className="text-slate-500 font-normal">
                      {semestreEstaFechado ? '(Homologado)' : '(Em Andamento)'}
                    </span>
                  </CardTitle>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  <span>
                    Meta semestral de acompanhamento:{' '}
                    <strong className="text-slate-900">{minimoSemestral}h</strong>
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-5">
              {/* 4 Cards de Métricas ao Vivo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Total de Alunos Avaliados */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
                  <span className="text-xs font-semibold text-slate-600 block">
                    Total de Alunos Avaliados
                  </span>
                  <div className="font-['Outfit'] text-3xl font-extrabold text-[#0f2b48]">
                    {balanco.totalAlunosAvaliados}
                  </div>
                  <span className="text-[11px] text-slate-500 block">{balanco.turnosTexto}</span>
                </div>

                {/* 2. Aptos à Colação (≥ 200h) em verde */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-1">
                  <span className="text-xs font-semibold text-emerald-900 block">
                    Aptos à Colação (≥ {metaCurso}h)
                  </span>
                  <div className="font-['Outfit'] text-3xl font-extrabold text-emerald-700">
                    {balanco.totalAptosColacao}
                  </div>
                  <span className="text-[11px] text-emerald-800 font-medium block">
                    Integralização de 100% atingida
                  </span>
                </div>

                {/* 3. Cumpriram a Meta Semestral em azul */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-1">
                  <span className="text-xs font-semibold text-blue-900 block">
                    Cumpriram a Meta Semestral
                  </span>
                  <div className="font-['Outfit'] text-3xl font-extrabold text-[#1d4ed8]">
                    {balanco.totalCumpriramMeta}
                  </div>
                  <span className="text-[11px] text-blue-800 font-medium block">
                    ≥ {minimoSemestral}h deferidas em {semestreAtivo}
                  </span>
                </div>

                {/* 4. Em Alerta Pedagógico em âmbar */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-1">
                  <span className="text-xs font-semibold text-amber-900 block">
                    Em Alerta Pedagógico
                  </span>
                  <div className="font-['Outfit'] text-3xl font-extrabold text-amber-600">
                    {balanco.totalAlertaPedagogico}
                  </div>
                  <span className="text-[11px] text-amber-800 font-medium block">
                    &lt; {minimoSemestral}h (não gera DP)
                  </span>
                </div>
              </div>

              {/* Aviso: Nota Pedagógica de Fechamento */}
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-950">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Nota Pedagógica de Fechamento:</strong> A homologação do semestre gera a
                  Ata Oficial NDE impressa/digital com certificação das horas para a Secretaria
                  Acadêmica Geral. Alunos que não atingiram {minimoSemestral}h permanecem sob
                  orientação formativa, podendo compensar a carga nos semestres subsequentes.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: ATAS OFICIAIS DE HOMOLOGAÇÃO HOMOLOGADAS PELO NDE */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="font-['Outfit'] text-base font-bold text-[#0f2b48]">
                Atas Oficiais de Homologação Homologadas pelo NDE
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Documentos oficiais arquivados com assinatura da coordenação e termos de
                deliberação.
              </CardDescription>
            </CardHeader>

            <CardContent className="divide-y divide-slate-100 p-0">
              {atas.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Nenhuma ata arquivada até o momento.
                </div>
              ) : (
                atas.map((ata) => {
                  const dataAtaFormatada = new Date(ata.data_homologacao).toLocaleDateString(
                    'pt-BR',
                    {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    },
                  )

                  return (
                    <div
                      key={ata.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Linha de Título com Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-['Outfit'] text-base font-bold text-[#0f2b48]">
                            Ata NDE N° {ata.numero_ata}
                          </span>
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-800 text-[11px] font-mono py-0 px-2"
                          >
                            Semestre {ata.semestre_letivo}
                          </Badge>
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-0 px-2 uppercase tracking-wide">
                            {ata.status}
                          </Badge>
                        </div>

                        {/* Resumo da Deliberação */}
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {ata.resumo_deliberacao}
                        </p>

                        {/* Metadados: Data, Alunos, Concluintes, Presidente */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-0.5">
                          <span>Data: {dataAtaFormatada}</span>
                          <span>•</span>
                          <span>{ata.total_alunos_avaliados} Alunos Avaliados</span>
                          <span>•</span>
                          <span>{ata.total_concluintes_aptos} Concluinte(s) Apto(s)</span>
                          <span>•</span>
                          <span>Presidente: {ata.presidente_coordenadora}</span>
                        </div>
                      </div>

                      {/* Botão Baixar Ata em PDF */}
                      <div className="shrink-0">
                        <Button
                          onClick={() => handleBaixarAta(ata)}
                          className="bg-[#0f2b48] hover:bg-[#1a3d61] text-white text-xs font-semibold px-4 py-2 shadow-sm flex items-center gap-2"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Baixar Ata em PDF</span>
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================
            ABA 2: TRILHA GLOBAL DE AUDITORIA
           ======================================================== */}
        <TabsContent value="trilha" className="space-y-4 m-0">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="font-['Outfit'] text-base font-bold text-[#0f2b48] flex items-center gap-2">
                    <History className="h-4 w-4 text-[#1d4ed8]" />
                    Trilha Global de Auditoria & Imutabilidade
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Registro cronológico completo de deferimentos, estornos, homologações e viradas
                    de semestre.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportarTrilhaCsv}
                    disabled={trilhaFiltrada.length === 0}
                    className="text-xs text-slate-700 flex items-center gap-1.5"
                  >
                    <HardDriveDownload className="h-3.5 w-3.5 text-slate-500" />
                    <span>Exportar CSV</span>
                  </Button>
                </div>
              </div>

              {/* Filtros da Trilha */}
              <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Buscar por estudante, matrícula, ator ou detalhe..."
                    value={buscaTrilha}
                    onChange={(e) => setBuscaTrilha(e.target.value)}
                    className="h-8 pl-8 text-xs bg-slate-50"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-slate-400 hidden sm:inline" />
                  <Select value={filtroTipoEvento} onValueChange={setFiltroTipoEvento}>
                    <SelectTrigger className="h-8 w-[200px] text-xs bg-slate-50">
                      <SelectValue placeholder="Tipo de Evento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos" className="text-xs">
                        Todos os Eventos ({trilhaGlobal.length})
                      </SelectItem>
                      <SelectItem value="HOMOLOGACAO_SEMESTRE" className="text-xs">
                        Homologações NDE
                      </SelectItem>
                      <SelectItem value="LANCAMENTO_CRIADO" className="text-xs">
                        Lançamentos
                      </SelectItem>
                      <SelectItem value="ESTORNO_REGISTRADO" className="text-xs">
                        Estornos Registrados
                      </SelectItem>
                      <SelectItem value="IMPORTACAO_LEGADA" className="text-xs">
                        Carga Legada (Excel)
                      </SelectItem>
                      <SelectItem value="VIRADA_SEMESTRE" className="text-xs">
                        Virada de Semestre
                      </SelectItem>
                      <SelectItem value="ALUNO_EXCLUIDO" className="text-xs">
                        Exclusão de Estudante
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
                {trilhaFiltrada.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    Nenhum registro encontrado com os filtros informados.
                  </div>
                ) : (
                  trilhaFiltrada.map((item) => {
                    const dataHora = new Date(item.created).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })

                    return (
                      <div
                        key={item.id}
                        className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-start gap-3"
                      >
                        {/* Coluna 1: Badge do Evento */}
                        <div className="sm:w-40 shrink-0">
                          {renderBadgeEvento(item.tipo_evento)}
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                            <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{dataHora}</span>
                          </div>
                        </div>

                        {/* Coluna 2: Detalhe e Aluno */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-xs text-slate-800 leading-snug font-medium">
                            {item.descricao}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                            {item.aluno_nome && (
                              <span>
                                Estudante:{' '}
                                <strong className="text-slate-700">{item.aluno_nome}</strong>
                                {item.aluno_matricula && (
                                  <span className="font-mono text-slate-500 ml-1">
                                    ({item.aluno_matricula})
                                  </span>
                                )}
                              </span>
                            )}
                            {item.semestre_letivo && (
                              <span>
                                Semestre:{' '}
                                <strong className="text-slate-700">{item.semestre_letivo}</strong>
                              </span>
                            )}
                            <span>
                              Ator: <span className="text-slate-600">{item.ator_nome}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========================================================
          MODAL DE CONFIRMAÇÃO: HOMOLOGAR SEMESTRE ATIVO
         ======================================================== */}
      <Dialog open={modalHomologarAberto} onOpenChange={setModalHomologarAberto}>
        <DialogContent className="sm:max-w-[580px]">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] text-lg font-bold text-[#0f2b48] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#f59e0b]" />
              Homologar e Fechar Semestre Letivo {semestreAtivo}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              A homologação consolida as horas deferidas e gera a Ata Oficial NDE para envio à
              Secretaria Acadêmica Geral.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {/* Quadro Síntese do Fechamento */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <h4 className="font-bold text-[#0f2b48] uppercase tracking-wider text-[11px]">
                Balanço do Fechamento · Semestre {semestreAtivo}
              </h4>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-600">Total de Alunos Avaliados:</span>
                  <span className="font-bold text-slate-900">{balanco.totalAlunosAvaliados}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-600">Horas Totais Deferidas:</span>
                  <span className="font-bold text-[#1d4ed8]">
                    {balanco.totalHorasDeferidasSemestre}h
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-600">Cumpriram a Meta (≥{minimoSemestral}h):</span>
                  <span className="font-bold text-emerald-700">{balanco.totalCumpriramMeta}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-600">
                    Em Alerta Pedagógico (&lt;{minimoSemestral}h):
                  </span>
                  <span className="font-bold text-amber-700">{balanco.totalAlertaPedagogico}</span>
                </div>
                <div className="flex justify-between col-span-2 pt-1">
                  <span className="text-slate-600">
                    Concluintes Aptos à Colação (≥{metaCurso}h):
                  </span>
                  <span className="font-bold text-emerald-700">
                    {balanco.totalAptosColacao} aluno(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Aviso de Imutabilidade */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-blue-950 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1 text-[#1d4ed8]">
                <ShieldCheck className="h-4 w-4" />
                Garantia Institucional de Imutabilidade
              </div>
              <p className="text-[11px] text-blue-900 leading-relaxed">
                A homologação é registrada de forma <strong>definitiva e imutável</strong>. Nenhum
                lançamento do histórico será apagado ou alterado. Novos lançamentos poderão ser
                adicionados normalmente nos semestres subsequentes.
              </p>
            </div>

            <div className="text-[11px] text-slate-500">
              Presidente da Homologação: <strong>{nomeCoordenadora}</strong> (CRP {crpCoordenadora})
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalHomologarAberto(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarHomologacao}
              disabled={homologando}
              className="bg-[#f59e0b] hover:bg-[#d97706] text-slate-950 font-bold text-xs shadow-sm"
            >
              {homologando ? 'Homologando...' : `Confirmar Homologação ${semestreAtivo}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
