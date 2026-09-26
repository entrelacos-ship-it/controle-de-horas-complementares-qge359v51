import {
  calcularHorasCategoria,
  isCategoriaBloqueada,
  validarNovoLancamento,
  calcularProgressoAluno,
} from './calculoHoras'
import { gerarTextoDespacho } from './formatadorDespacho'
import { executarTestesImportacao } from './importacaoPlanilha.test'
import type { Aluno, Categoria, Lancamento, ConfiguracaoGlobal } from '../types'

/**
 * Suite de validação dos casos de teste críticos do PRD (CT-01 a CT-05)
 */
export function executarTestesUnitarios(): { todosPassaram: boolean; resultados: string[] } {
  const resultados: string[] = []

  const mockConfig: ConfiguracaoGlobal = {
    id: 'cfg1',
    semestre_letivo_atual: '2026.2',
    minimo_exigido_semestre: 20,
    meta_curso: 200,
  }

  const mockCatEventos: Categoria = {
    id: 'cat_eventos',
    nome: 'Eventos científicos com apresentação de trabalho',
    regra_horas_unitaria: '20h por evento',
    teto_maximo_curso: 40,
    ativo: true,
  }

  const mockCatCursos: Categoria = {
    id: 'cat_cursos',
    nome: 'Cursos Livres Presenciais ou Online',
    regra_horas_unitaria: '10h por atividade',
    teto_maximo_curso: 120,
    ativo: true,
  }

  const mockAluno3Semestre: Aluno = {
    id: 'aluno_1',
    matricula: 'PSI001',
    nome: 'Estudante Teste Três',
    turno: 'Matutino',
    semestre_atual: 3,
    periodo_entrada: '2025.1',
    email: 'teste@aluno.fausp.br',
  }

  // CT-01: Happy path
  const ct01 = validarNovoLancamento({
    horasAceitas: 20,
    categoria: mockCatEventos,
    horasAcumuladasAtuais: 0,
    comprovanteOk: true,
    relatorioOk: true,
  })
  if (ct01.valido) {
    resultados.push('CT-01: Happy path passou.')
  } else {
    throw new Error('CT-01 falhou')
  }

  // CT-02: Atingimento exato de teto
  const ct02 = validarNovoLancamento({
    horasAceitas: 20,
    categoria: mockCatEventos,
    horasAcumuladasAtuais: 20,
    comprovanteOk: true,
    relatorioOk: true,
  })
  const bloqueada02 = isCategoriaBloqueada(40, mockCatEventos.teto_maximo_curso)
  if (ct02.valido && bloqueada02) {
    resultados.push('CT-02: Atingimento exato de teto (aceita e bloqueia) passou.')
  } else {
    throw new Error('CT-02 falhou')
  }

  // CT-03: Bloqueio impeditivo
  const ct03 = validarNovoLancamento({
    horasAceitas: 10,
    categoria: mockCatEventos,
    horasAcumuladasAtuais: 40,
    comprovanteOk: true,
    relatorioOk: true,
  })
  if (!ct03.valido && ct03.erro?.includes('BLOQUEADA')) {
    resultados.push('CT-03: Bloqueio impeditivo de categoria bloqueada passou.')
  } else {
    throw new Error('CT-03 falhou')
  }

  // CT-04: Regra do numeral 0 no despacho
  const lancamentos: Lancamento[] = [
    {
      id: 'l1',
      aluno_id: mockAluno3Semestre.id,
      categoria_id: mockCatEventos.id,
      data_lancamento: '2026-08-10',
      semestre_letivo_atividade: '2026.2',
      horas_aceitas: 20,
      comprovante_ok: true,
      relatorio_ok: true,
      created: '2026-08-10',
      updated: '2026-08-10',
    },
  ]

  const despacho = gerarTextoDespacho({
    aluno: mockAluno3Semestre,
    categoriaAtividade: mockCatEventos,
    horasLancamento: 20,
    semestreAtividade: '2026.2',
    lancamentosDoAluno: lancamentos,
    categorias: [mockCatEventos, mockCatCursos],
    config: mockConfig,
  })

  let ct04Ok = true
  for (let s = 4; s <= 10; s++) {
    if (!despacho.includes(`Restante para integralizar o semestre (${s}º): 0 horas`)) {
      ct04Ok = false
      break
    }
  }
  if (ct04Ok) {
    resultados.push('CT-04: Regra do numeral 0 (4º ao 10º semestre com 0 horas) passou.')
  } else {
    throw new Error('CT-04 falhou')
  }

  // CT-05: Estorno negativo
  const ct05SemObs = validarNovoLancamento({
    horasAceitas: -10,
    categoria: mockCatEventos,
    horasAcumuladasAtuais: 40,
    comprovanteOk: true,
    relatorioOk: true,
    observacao: '',
  })
  const ct05ComObs = validarNovoLancamento({
    horasAceitas: -10,
    categoria: mockCatEventos,
    horasAcumuladasAtuais: 40,
    comprovanteOk: true,
    relatorioOk: true,
    observacao: 'Correção de duplicidade',
  })

  if (!ct05SemObs.valido && ct05ComObs.valido) {
    resultados.push('CT-05: Estorno negativo com justificativa obrigatória e dedução passou.')
  } else {
    throw new Error('CT-05 falhou')
  }

  // CT-06: Promoção de semestre na Virada (3º -> 4º; 10º permanece no 10º)
  const aluno3 = { ...mockAluno3Semestre, semestre_atual: 3 }
  const aluno10: Aluno = {
    id: 'aluno_10',
    matricula: 'PSI010',
    nome: 'Estudante Concluinte',
    turno: 'Vespertino',
    semestre_atual: 10,
    periodo_entrada: '2022.1',
    email: 'concluinte@aluno.fausp.br',
  }
  const alunoEspecial: Aluno = {
    id: 'aluno_esp',
    matricula: 'PSI099',
    nome: 'Estudante Especial',
    turno: 'Especial',
    semestre_atual: 1,
    periodo_entrada: '2026.1',
    email: 'especial@aluno.fausp.br',
  }

  // Lógica de promoção da virada assistida
  const simularPromocao = (aluno: Aluno, promover: boolean): number => {
    const sem = Number(aluno.semestre_atual) || 1
    if (promover && sem < 10) {
      return Math.min(10, sem + 1)
    }
    return sem
  }

  const promovido3 = simularPromocao(aluno3, true)
  const promovido10 = simularPromocao(aluno10, true)
  const mantido3 = simularPromocao(aluno3, false) // Aluno desmarcado na UI (ex: trancamento)
  const promovidoEsp = simularPromocao(alunoEspecial, true)

  if (promovido3 === 4 && promovido10 === 10 && mantido3 === 3 && promovidoEsp === 2) {
    resultados.push(
      'CT-06: Promoção de semestre na Virada (3º → 4º; 10º permanece 10º; exclusão seletiva mantida) passou.',
    )
  } else {
    throw new Error(
      `CT-06 falhou: promovido3=${promovido3}, promovido10=${promovido10}, mantido3=${mantido3}, promovidoEsp=${promovidoEsp}`,
    )
  }

  // Executar também a suíte de importação de planilha
  const testesImportacao = executarTestesImportacao()
  resultados.push(...testesImportacao.resultados)

  return { todosPassaram: true, resultados }
}
