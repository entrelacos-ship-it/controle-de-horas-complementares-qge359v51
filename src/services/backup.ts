import pb from '@/lib/pocketbase/client'
import type { Aluno, Categoria, Lancamento, ConfiguracaoGlobal, TurnoAluno } from '@/types'

export interface BackupData {
  versao: string
  criadoEm: string
  app: string
  configuracao: ConfiguracaoGlobal
  categorias: Categoria[]
  alunos: Aluno[]
  lancamentos: Lancamento[]
}

export interface ResultadoRestauracao {
  sucesso: boolean
  totalCategorias: number
  totalAlunos: number
  totalLancamentos: number
  mensagem: string
}

/**
 * Exporta cópia de segurança completa do sistema em formato JSON padronizado.
 */
export async function exportarBackupCompleto(): Promise<BackupData> {
  const [configRecords, categorias, alunos, lancamentos] = await Promise.all([
    pb.collection('configuracao_global').getFullList<ConfiguracaoGlobal>({ sort: '-created' }),
    pb.collection('categorias').getFullList<Categoria>({ sort: 'nome' }),
    pb.collection('alunos').getFullList<Aluno>({ sort: 'nome' }),
    pb.collection('lancamentos').getFullList<Lancamento>({ sort: 'created' }),
  ])

  const configuracao: ConfiguracaoGlobal =
    configRecords.length > 0
      ? configRecords[0]
      : {
          id: '',
          semestre_letivo_atual: '2026.2',
          minimo_exigido_semestre: 20,
          meta_curso: 200,
          nome_da_coordenadora: 'Roberta Andrea de Oliveira',
          crp_coordenadora: '06/77114',
        }

  const backup: BackupData = {
    versao: '1.0',
    criadoEm: new Date().toISOString(),
    app: 'Controle de Horas Complementares — Psicologia FAUSP',
    configuracao,
    categorias,
    alunos,
    lancamentos,
  }

  return backup
}

/**
 * Dispara o download de um arquivo JSON de backup no navegador.
 */
export function baixarArquivoJson(dados: BackupData, nomeArquivo?: string) {
  const dataIso = new Date().toISOString().slice(0, 10)
  const defaultNome = `backup-horas-psicologia-${dados.configuracao.semestre_letivo_atual || 'atual'}-${dataIso}.json`
  const blob = new Blob([JSON.stringify(dados, null, 2)], {
    type: 'application/json;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo || defaultNome
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Valida a estrutura de um JSON de backup antes da restauração.
 */
export function validarArquivoBackup(json: unknown): {
  valido: boolean
  erro?: string
  dados?: BackupData
} {
  if (!json || typeof json !== 'object') {
    return { valido: false, erro: 'Arquivo JSON inválido ou vazio.' }
  }

  const obj = json as Record<string, unknown>

  if (!obj.configuracao || typeof obj.configuracao !== 'object') {
    return { valido: false, erro: 'Backup não contém a seção de configuração global válida.' }
  }

  if (!Array.isArray(obj.categorias)) {
    return { valido: false, erro: 'Backup não contém a lista de categorias NDE (esperado array).' }
  }

  if (!Array.isArray(obj.alunos)) {
    return { valido: false, erro: 'Backup não contém a lista de alunos (esperado array).' }
  }

  if (!Array.isArray(obj.lancamentos)) {
    return { valido: false, erro: 'Backup não contém a lista de lançamentos (esperado array).' }
  }

  return { valido: true, dados: obj as unknown as BackupData }
}

/**
 * Restaura o banco de dados a partir do arquivo JSON de backup.
 * ATENÇÃO: Esta é uma operação de emergência/recuperação que substitui os registros atuais.
 */
export async function restaurarBackupJson(
  backup: BackupData,
  onProgress?: (mensagem: string, percentual: number) => void,
): Promise<ResultadoRestauracao> {
  onProgress?.('Validando estrutura e preparando restauração...', 5)

  // 1. Restaurar ou atualizar a configuração global
  onProgress?.('Restaurando parâmetros da configuração global...', 15)
  const configsAtuais = await pb.collection('configuracao_global').getFullList<ConfiguracaoGlobal>()
  const cfgPayload = {
    semestre_letivo_atual: backup.configuracao.semestre_letivo_atual || '2026.2',
    minimo_exigido_semestre: Number(backup.configuracao.minimo_exigido_semestre) || 20,
    meta_curso: Number(backup.configuracao.meta_curso) || 200,
    nome_da_coordenadora: backup.configuracao.nome_da_coordenadora || 'Roberta Andrea de Oliveira',
    crp_coordenadora: backup.configuracao.crp_coordenadora || '06/77114',
    ultima_virada_semestre: backup.configuracao.ultima_virada_semestre || '',
    ultima_virada_data: backup.configuracao.ultima_virada_data || '',
    ultima_virada_alunos_promovidos:
      Number(backup.configuracao.ultima_virada_alunos_promovidos) || 0,
  }

  if (configsAtuais.length > 0) {
    await pb.collection('configuracao_global').update(configsAtuais[0].id, cfgPayload)
  } else {
    await pb.collection('configuracao_global').create(cfgPayload)
  }

  // 2. Restaurar / Upsert Categorias (mapeando id antigo -> id novo/existente)
  onProgress?.('Restaurando categorias NDE...', 30)
  const mapaCategoriasAntigasParaNovas = new Map<string, string>()
  const categoriasAtuais = await pb.collection('categorias').getFullList<Categoria>()
  const categoriasPorNome = new Map<string, Categoria>()
  categoriasAtuais.forEach((c) => categoriasPorNome.set(c.nome.trim().toLowerCase(), c))

  for (const cat of backup.categorias) {
    const nomeNorm = cat.nome.trim().toLowerCase()
    const existente = categoriasPorNome.get(nomeNorm)
    if (existente) {
      await pb.collection('categorias').update(existente.id, {
        regra_horas_unitaria: cat.regra_horas_unitaria,
        teto_maximo_curso: Number(cat.teto_maximo_curso),
        ativo: cat.ativo !== false,
      })
      mapaCategoriasAntigasParaNovas.set(cat.id, existente.id)
      mapaCategoriasAntigasParaNovas.set(nomeNorm, existente.id)
    } else {
      const criada = await pb.collection('categorias').create<Categoria>({
        nome: cat.nome.trim(),
        regra_horas_unitaria: cat.regra_horas_unitaria,
        teto_maximo_curso: Number(cat.teto_maximo_curso),
        ativo: cat.ativo !== false,
      })
      categoriasPorNome.set(nomeNorm, criada)
      mapaCategoriasAntigasParaNovas.set(cat.id, criada.id)
      mapaCategoriasAntigasParaNovas.set(nomeNorm, criada.id)
    }
  }

  // 3. Restaurar / Upsert Alunos (chave única: matrícula)
  onProgress?.('Restaurando prontuários de estudantes...', 55)
  const mapaAlunosAntigosParaNovos = new Map<string, string>()
  const alunosAtuais = await pb.collection('alunos').getFullList<Aluno>()
  const alunosPorMatricula = new Map<string, Aluno>()
  alunosAtuais.forEach((a) => alunosPorMatricula.set(a.matricula.trim().toUpperCase(), a))

  for (const aluno of backup.alunos) {
    const matNorm = aluno.matricula.trim().toUpperCase()
    const existente = alunosPorMatricula.get(matNorm)
    const payloadAluno = {
      matricula: matNorm,
      nome: aluno.nome.trim(),
      turno: (aluno.turno as TurnoAluno) || 'Matutino',
      semestre_atual: Number(aluno.semestre_atual) || 1,
      periodo_entrada: aluno.periodo_entrada.trim(),
      email: aluno.email.trim().toLowerCase(),
    }

    if (existente) {
      await pb.collection('alunos').update(existente.id, payloadAluno)
      mapaAlunosAntigosParaNovos.set(aluno.id, existente.id)
      mapaAlunosAntigosParaNovos.set(matNorm, existente.id)
    } else {
      const criado = await pb.collection('alunos').create<Aluno>(payloadAluno)
      alunosPorMatricula.set(matNorm, criado)
      mapaAlunosAntigosParaNovos.set(aluno.id, criado.id)
      mapaAlunosAntigosParaNovos.set(matNorm, criado.id)
    }
  }

  // 4. Restaurar Lançamentos
  onProgress?.('Restaurando histórico de lançamentos...', 75)
  // Como lançamentos são imutáveis na regra de negócio (sem update/delete direto por usuário),
  // identificamos se o lançamento já existe buscando por chave composta: aluno_id, categoria_id, semestre, data, horas
  const lancamentosAtuais = await pb.collection('lancamentos').getFullList<Lancamento>()
  const chaveLanc = (alunoId: string, catId: string, sem: string, data: string, horas: number) =>
    `${alunoId}_${catId}_${sem}_${data.slice(0, 10)}_${horas}`

  const lancamentosExistentes = new Set<string>()
  for (const l of lancamentosAtuais) {
    lancamentosExistentes.add(
      chaveLanc(
        l.aluno_id,
        l.categoria_id,
        l.semestre_letivo_atividade,
        l.data_lancamento || '',
        Number(l.horas_aceitas),
      ),
    )
  }

  let lancamentosInseridos = 0
  for (const l of backup.lancamentos) {
    // Resolver aluno_id e categoria_id mapeados
    const targetAlunoId = mapaAlunosAntigosParaNovos.get(l.aluno_id) || l.aluno_id
    const targetCatId = mapaCategoriasAntigasParaNovas.get(l.categoria_id) || l.categoria_id

    // Verificar se o aluno e categoria existem de fato
    if (!targetAlunoId || !targetCatId) continue

    const key = chaveLanc(
      targetAlunoId,
      targetCatId,
      l.semestre_letivo_atividade,
      l.data_lancamento || '',
      Number(l.horas_aceitas),
    )

    if (!lancamentosExistentes.has(key)) {
      try {
        await pb.collection('lancamentos').create({
          aluno_id: targetAlunoId,
          categoria_id: targetCatId,
          data_lancamento: l.data_lancamento,
          semestre_letivo_atividade: l.semestre_letivo_atividade,
          horas_aceitas: Number(l.horas_aceitas),
          comprovante_ok: l.comprovante_ok ?? true,
          relatorio_ok: l.relatorio_ok ?? true,
          observacao: l.observacao || '',
        })
        lancamentosExistentes.add(key)
        lancamentosInseridos++
      } catch (err) {
        console.warn('Erro ao inserir lançamento durante restauração:', err)
      }
    }
  }

  onProgress?.('Concluindo restauração...', 100)

  return {
    sucesso: true,
    totalCategorias: backup.categorias.length,
    totalAlunos: backup.alunos.length,
    totalLancamentos: lancamentosExistentes.size,
    mensagem: `Restauração concluída: ${backup.categorias.length} categorias, ${backup.alunos.length} alunos e ${lancamentosInseridos} novos lançamentos sincronizados.`,
  }
}

/**
 * Conjunto de dados de demonstração originais do projeto FAUSP Psicologia.
 */
export const DADOS_DEMO_SEED = {
  configuracao: {
    semestre_letivo_atual: '2026.2',
    minimo_exigido_semestre: 20,
    meta_curso: 200,
    nome_da_coordenadora: 'Roberta Andrea de Oliveira',
    crp_coordenadora: '06/77114',
    ultima_virada_semestre: '',
    ultima_virada_data: '',
    ultima_virada_alunos_promovidos: 0,
  },
  categorias: [
    {
      nome: 'Eventos científicos com apresentação de trabalho',
      regra_horas_unitaria: '20h por evento',
      teto_maximo_curso: 40,
      ativo: true,
    },
    {
      nome: 'Cursos Livres Presenciais ou Online',
      regra_horas_unitaria: '10h por atividade',
      teto_maximo_curso: 120,
      ativo: true,
    },
    {
      nome: 'Artes e Cultura',
      regra_horas_unitaria: '10h por atividade',
      teto_maximo_curso: 40,
      ativo: true,
    },
    {
      nome: 'Estágio supervisionado extracurricular',
      regra_horas_unitaria: '30h por semestre',
      teto_maximo_curso: 60,
      ativo: true,
    },
    {
      nome: 'Iniciação Científica',
      regra_horas_unitaria: '20h por semestre',
      teto_maximo_curso: 80,
      ativo: true,
    },
  ],
  alunos: [
    {
      matricula: 'PSI2024201',
      nome: 'Mariana Costa Silveira',
      turno: 'Matutino' as TurnoAluno,
      semestre_atual: 4,
      periodo_entrada: '2024.2',
      email: 'mariana.silveira@aluno.fausp.br',
    },
    {
      matricula: 'PSI2025102',
      nome: 'Lucas Gabriel dos Santos',
      turno: 'Noturno' as TurnoAluno,
      semestre_atual: 3,
      periodo_entrada: '2025.1',
      email: 'lucas.santos@aluno.fausp.br',
    },
    {
      matricula: 'PSI2026103',
      nome: 'Beatriz Ramos Albuquerque',
      turno: 'Matutino' as TurnoAluno,
      semestre_atual: 2,
      periodo_entrada: '2026.1',
      email: 'beatriz.ramos@aluno.fausp.br',
    },
    {
      matricula: 'PSI2023104',
      nome: 'Felipe Augusto Nogueira',
      turno: 'Noturno' as TurnoAluno,
      semestre_atual: 7,
      periodo_entrada: '2023.1',
      email: 'felipe.nogueira@aluno.fausp.br',
    },
    {
      matricula: 'PSI2026205',
      nome: 'Camila Fernandes Lopes',
      turno: 'Matutino' as TurnoAluno,
      semestre_atual: 1,
      periodo_entrada: '2026.2',
      email: 'camila.lopes@aluno.fausp.br',
    },
  ],
  lancamentos: [
    {
      matriculaAluno: 'PSI2024201',
      nomeCategoria: 'Eventos científicos com apresentação de trabalho',
      data: '2025-05-10 10:00:00.000Z',
      semestre: '2025.1',
      horas: 20,
      comprovante: true,
      relatorio: true,
      obs: 'Apresentação no Congresso Brasileiro de Psicologia do Desenvolvimento',
    },
    {
      matriculaAluno: 'PSI2024201',
      nomeCategoria: 'Eventos científicos com apresentação de trabalho',
      data: '2025-11-20 10:00:00.000Z',
      semestre: '2025.2',
      horas: 20,
      comprovante: true,
      relatorio: true,
      obs: 'Simpósio Regional de Neuropsicologia Aplicada - Trabalho Completo',
    },
    {
      matriculaAluno: 'PSI2024201',
      nomeCategoria: 'Cursos Livres Presenciais ou Online',
      data: '2026-08-15 10:00:00.000Z',
      semestre: '2026.2',
      horas: 10,
      comprovante: true,
      relatorio: true,
      obs: 'Curso de Atualização em TCC - 20h certificadas (10h aproveitadas)',
    },
    {
      matriculaAluno: 'PSI2025102',
      nomeCategoria: 'Cursos Livres Presenciais ou Online',
      data: '2026-08-20 14:00:00.000Z',
      semestre: '2026.2',
      horas: 20,
      comprovante: true,
      relatorio: true,
      obs: 'Curso Psicologia Hospitalar e Cuidados Paliativos',
    },
    {
      matriculaAluno: 'PSI2025102',
      nomeCategoria: 'Artes e Cultura',
      data: '2026-09-05 16:00:00.000Z',
      semestre: '2026.2',
      horas: 10,
      comprovante: true,
      relatorio: true,
      obs: 'Visita mediada à Bienal de Arte e Ensaio Reflexivo',
    },
    {
      matriculaAluno: 'PSI2026103',
      nomeCategoria: 'Artes e Cultura',
      data: '2026-04-12 11:00:00.000Z',
      semestre: '2026.1',
      horas: 10,
      comprovante: true,
      relatorio: true,
      obs: 'Mostra Cultural de Cinema e Psicologia',
    },
    {
      matriculaAluno: 'PSI2023104',
      nomeCategoria: 'Estágio supervisionado extracurricular',
      data: '2025-10-18 10:00:00.000Z',
      semestre: '2025.2',
      horas: 30,
      comprovante: true,
      relatorio: true,
      obs: 'Estágio Extracurricular em Clínica Comunitária',
    },
    {
      matriculaAluno: 'PSI2023104',
      nomeCategoria: 'Iniciação Científica',
      data: '2026-03-25 10:00:00.000Z',
      semestre: '2026.1',
      horas: 20,
      comprovante: true,
      relatorio: true,
      obs: 'Iniciação Científica PIBIC - Relatório Semestral Aprovado',
    },
    {
      matriculaAluno: 'PSI2023104',
      nomeCategoria: 'Cursos Livres Presenciais ou Online',
      data: '2026-08-10 10:00:00.000Z',
      semestre: '2026.2',
      horas: 20,
      comprovante: true,
      relatorio: true,
      obs: 'Formação em Psicodiagnóstico Infantil',
    },
    {
      matriculaAluno: 'PSI2023104',
      nomeCategoria: 'Cursos Livres Presenciais ou Online',
      data: '2026-08-12 10:00:00.000Z',
      semestre: '2026.2',
      horas: -5,
      comprovante: true,
      relatorio: true,
      obs: 'Estorno de 5h lançado a maior por duplicidade de certificado do curso infantil',
    },
  ],
}

/**
 * Restaura os dados de demonstração originais do sistema (seed FAUSP).
 */
export async function restaurarDadosDemonstracao(
  onProgress?: (mensagem: string, percentual: number) => void,
): Promise<ResultadoRestauracao> {
  onProgress?.('Restaurando parâmetros padrões da demonstração...', 10)

  // 1. Configuração Global
  const configsAtuais = await pb.collection('configuracao_global').getFullList<ConfiguracaoGlobal>()
  if (configsAtuais.length > 0) {
    await pb
      .collection('configuracao_global')
      .update(configsAtuais[0].id, DADOS_DEMO_SEED.configuracao)
  } else {
    await pb.collection('configuracao_global').create(DADOS_DEMO_SEED.configuracao)
  }

  // 2. Categorias Seed
  onProgress?.('Restaurando categorias oficiais do NDE...', 30)
  const categoriasAtuais = await pb.collection('categorias').getFullList<Categoria>()
  const catMap = new Map<string, string>() // nome -> id
  categoriasAtuais.forEach((c) => catMap.set(c.nome.trim().toLowerCase(), c.id))

  for (const c of DADOS_DEMO_SEED.categorias) {
    const key = c.nome.trim().toLowerCase()
    const existenteId = catMap.get(key)
    if (existenteId) {
      await pb.collection('categorias').update(existenteId, {
        regra_horas_unitaria: c.regra_horas_unitaria,
        teto_maximo_curso: c.teto_maximo_curso,
        ativo: c.ativo,
      })
    } else {
      const criada = await pb.collection('categorias').create<Categoria>({
        nome: c.nome,
        regra_horas_unitaria: c.regra_horas_unitaria,
        teto_maximo_curso: c.teto_maximo_curso,
        ativo: c.ativo,
      })
      catMap.set(key, criada.id)
    }
  }

  // 3. Alunos Seed
  onProgress?.('Restaurando estudantes exemplo da demonstração...', 60)
  const alunosAtuais = await pb.collection('alunos').getFullList<Aluno>()
  const alunoMap = new Map<string, string>() // matricula -> id
  alunosAtuais.forEach((a) => alunoMap.set(a.matricula.trim().toUpperCase(), a.id))

  for (const a of DADOS_DEMO_SEED.alunos) {
    const key = a.matricula.trim().toUpperCase()
    const existenteId = alunoMap.get(key)
    if (existenteId) {
      await pb.collection('alunos').update(existenteId, {
        nome: a.nome,
        turno: a.turno,
        semestre_atual: a.semestre_atual,
        periodo_entrada: a.periodo_entrada,
        email: a.email,
      })
    } else {
      const criado = await pb.collection('alunos').create<Aluno>({
        matricula: a.matricula,
        nome: a.nome,
        turno: a.turno,
        semestre_atual: a.semestre_atual,
        periodo_entrada: a.periodo_entrada,
        email: a.email,
      })
      alunoMap.set(key, criado.id)
    }
  }

  // 4. Lançamentos Seed
  onProgress?.('Garantindo lançamentos e estornos da demonstração...', 85)
  const lancamentosAtuais = await pb.collection('lancamentos').getFullList<Lancamento>()
  const lancExistentes = new Set<string>()
  lancamentosAtuais.forEach((l) => {
    lancExistentes.add(
      `${l.aluno_id}_${l.categoria_id}_${l.semestre_letivo_atividade}_${(l.data_lancamento || '').slice(0, 10)}_${Number(l.horas_aceitas)}`,
    )
  })

  let inseridos = 0
  for (const l of DADOS_DEMO_SEED.lancamentos) {
    const alunoId = alunoMap.get(l.matriculaAluno.trim().toUpperCase())
    const catId = catMap.get(l.nomeCategoria.trim().toLowerCase())
    if (!alunoId || !catId) continue

    const key = `${alunoId}_${catId}_${l.semestre}_${l.data.slice(0, 10)}_${l.horas}`
    if (!lancExistentes.has(key)) {
      try {
        await pb.collection('lancamentos').create({
          aluno_id: alunoId,
          categoria_id: catId,
          data_lancamento: l.data,
          semestre_letivo_atividade: l.semestre,
          horas_aceitas: l.horas,
          comprovante_ok: l.comprovante,
          relatorio_ok: l.relatorio,
          observacao: l.obs,
        })
        lancExistentes.add(key)
        inseridos++
      } catch (err) {
        console.warn('Erro ao inserir lançamento demo:', err)
      }
    }
  }

  onProgress?.('Demonstração restabelecida com sucesso!', 100)

  return {
    sucesso: true,
    totalCategorias: DADOS_DEMO_SEED.categorias.length,
    totalAlunos: DADOS_DEMO_SEED.alunos.length,
    totalLancamentos: lancamentosAtuais.length + inseridos,
    mensagem: 'Dados de demonstração originais restaurados com sucesso.',
  }
}
