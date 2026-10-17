migrate(
  (app) => {
    // 1. Identificar o aluno Cleusa Cardoso Oliveira (matrícula 3936)
    const alunos = app.findRecordsByFilter('alunos', "matricula = '3936'", '', 1, 0)
    if (!alunos || alunos.length === 0) {
      console.log('Aluno matrícula 3936 não encontrado. Pulando correção de lançamento.')
      return
    }

    const aluno = alunos[0]
    const alunoId = aluno.id

    // 2. Buscar lançamentos do aluno com mês/ano 03/2026 e semestre_letivo_atividade '2026.2'
    // data_lancamento para 03/2026 começa com '2026-03'
    const lancamentos = app.findRecordsByFilter(
      'lancamentos',
      `aluno_id = '${alunoId}' && semestre_letivo_atividade = '2026.2' && data_lancamento ~ '2026-03'`,
      '',
      50,
      0,
    )

    if (lancamentos.length === 0) {
      console.log(
        'Nenhum lançamento divergente encontrado para aluno 3936 (já corrigido ou inexistente).',
      )
      return
    }

    const logsCol = app.findCollectionByNameOrId('auditoria_logs')

    for (const lancamento of lancamentos) {
      const lancamentoId = lancamento.id
      lancamento.set('semestre_letivo_atividade', '2026.1')
      app.save(lancamento)

      // 3. Registrar na trilha de auditoria
      const log = new Record(logsCol)
      log.set('tipo_evento', 'CORRECAO_LANCAMENTO')
      log.set('ator_nome', 'Roberta Andrea de Oliveira (Coordenação)')
      log.set('ator_email', 'roberta.oliveira@fausp.br')
      log.set('aluno_nome', aluno.getString('nome'))
      log.set('aluno_matricula', aluno.getString('matricula'))
      log.set('semestre_letivo', '2026.1')
      log.set(
        'descricao',
        `Correção de apuração de horas solicitada pela coordenação: Lançamento ${lancamentoId} de ${lancamento.getFloat('horas_aceitas')}h (realização 03/2026) realocado de 2026.2 para 2026.1 (1º semestre do curso).`,
      )
      log.set(
        'detalhes_json',
        JSON.stringify({
          lancamento_id: lancamentoId,
          aluno_id: alunoId,
          motivo:
            'Correção de apuração solicitada pela coordenação — atividade realizada em março pertence a 2026.1',
          semestre_anterior: '2026.2',
          semestre_corrigido: '2026.1',
          data_lancamento: lancamento.getString('data_lancamento'),
        }),
      )
      app.save(log)
    }

    console.log(
      `Corrigido(s) ${lancamentos.length} lançamento(s) da aluna matrícula 3936 para 2026.1.`,
    )
  },
  (app) => {
    // Reversão defensiva se necessário
    const alunos = app.findRecordsByFilter('alunos', "matricula = '3936'", '', 1, 0)
    if (!alunos || alunos.length === 0) return
    const alunoId = alunos[0].id
    const lancamentos = app.findRecordsByFilter(
      'lancamentos',
      `aluno_id = '${alunoId}' && semestre_letivo_atividade = '2026.1' && data_lancamento ~ '2026-03'`,
      '',
      50,
      0,
    )
    for (const lancamento of lancamentos) {
      lancamento.set('semestre_letivo_atividade', '2026.2')
      app.save(lancamento)
    }
  },
)
