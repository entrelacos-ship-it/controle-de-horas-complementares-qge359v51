migrate(
  (app) => {
    const catCol = app.findCollectionByNameOrId('categorias')
    const agora = new Date().toISOString()

    // 1. Definição exata das 13 categorias oficiais NDE fornecidas pela coordenação do curso de Psicologia
    const categoriasOficiais = [
      {
        nome: 'Eventos científicos internacionais com apresentação de trabalho',
        regra: '15 horas cada',
        teto: 40,
      },
      {
        nome: 'Eventos científicos nacionais, regionais ou locais com apresentação de trabalho',
        regra: '10 horas cada',
        teto: 40,
      },
      {
        nome: 'Eventos científicos internacionais ou nacionais sem apresentação de trabalho',
        regra: '5 horas cada',
        teto: 30,
      },
      {
        nome: 'Eventos científicos regionais ou locais sem apresentação de trabalho',
        regra: '3 horas',
        teto: 30,
      },
      {
        nome: 'Publicação autoria ou coautoria livro, capítulo de livro, artigo ou aceite de artigo para publicação',
        regra: '25 horas cada',
        teto: 50,
      },
      {
        nome: 'Monitoria em disciplinas do curso de psicologia',
        regra: '20 horas por semestre',
        teto: 60,
      },
      {
        nome: 'Artes e cultura cinema, espetáculos, teatro, etc.',
        regra: '10 horas cada evento',
        teto: 150,
      },
      {
        nome: 'Visitas técnicas em clínicas, hospitais, unidades de saúde, etc, com psicólogo no local',
        regra: '10 horas cada',
        teto: 40,
      },
      {
        nome: 'Estágio remunerado em psicologia com supervisor no local',
        regra: '15 horas a cada 4 meses',
        teto: 150,
      },
      {
        nome: 'Cursos livres presenciais ou online de até 8h',
        regra: '5 horas',
        teto: 120,
      },
      {
        nome: 'Cursos livres presenciais ou online de 9 a 20 horas',
        regra: '10 horas',
        teto: 120,
      },
      {
        nome: 'Cursos livres presenciais ou online de 21 ou mais',
        regra: '15 horas',
        teto: 120,
      },
      {
        nome: "Livros lidos de forma coletiva exclusivamente no Clube de Leitura Mulheres Força da R'Existência (segundo regras estabelecidas)",
        regra: '10 horas para um livro de no máximo 200 páginas por semestre',
        teto: 80,
      },
    ]

    // 2. Mapeamento de categorias antigas existentes para suas correspondências oficiais:
    // - "Artes e Cultura" -> Item 7: "Artes e cultura cinema, espetáculos, teatro, etc." (10h cada evento / máx 150h)
    // - "Cursos Livres Presenciais ou Online" -> Item 11: "Cursos livres presenciais ou online de 9 a 20 horas" (10 horas / máx 120h)
    // - "Eventos científicos com apresentação de trabalho" (sem lançamentos vinculados) -> Item 2: "Eventos científicos nacionais, regionais ou locais com apresentação de trabalho" (10h cada / máx 40h)
    //
    // Categorias fora da lista oficial com histórico mantido:
    // - "Estágio supervisionado extracurricular" (id: 88t6dx24hxx6ikh): mantida intacta
    // - "Iniciação Científica" (id: tbmb83h8ip4fm51): mantida intacta

    try {
      // 2.a Atualizar "Artes e Cultura" (se existir com esse nome)
      const catArtes = app.findFirstRecordByData('categorias', 'nome', 'Artes e Cultura')
      catArtes.set('nome', 'Artes e cultura cinema, espetáculos, teatro, etc.')
      catArtes.set('regra_horas_unitaria', '10 horas cada evento')
      catArtes.set('teto_maximo_curso', 150)
      catArtes.set('ativo', true)
      app.save(catArtes)
    } catch (_) {}

    try {
      // 2.b Atualizar "Cursos Livres Presenciais ou Online" (se existir com esse nome)
      const catCursos = app.findFirstRecordByData(
        'categorias',
        'nome',
        'Cursos Livres Presenciais ou Online',
      )
      catCursos.set('nome', 'Cursos livres presenciais ou online de 9 a 20 horas')
      catCursos.set('regra_horas_unitaria', '10 horas')
      catCursos.set('teto_maximo_curso', 120)
      catCursos.set('ativo', true)
      app.save(catCursos)
    } catch (_) {}

    try {
      // 2.c Atualizar "Eventos científicos com apresentação de trabalho" (se existir com esse nome)
      const catEventosAntiga = app.findFirstRecordByData(
        'categorias',
        'nome',
        'Eventos científicos com apresentação de trabalho',
      )
      catEventosAntiga.set(
        'nome',
        'Eventos científicos nacionais, regionais ou locais com apresentação de trabalho',
      )
      catEventosAntiga.set('regra_horas_unitaria', '10 horas cada')
      catEventosAntiga.set('teto_maximo_curso', 40)
      catEventosAntiga.set('ativo', true)
      app.save(catEventosAntiga)
    } catch (_) {}

    // 3. Garantir que todas as 13 categorias oficiais existam com os valores exatos (upsert idempotente)
    for (let i = 0; i < categoriasOficiais.length; i++) {
      const item = categoriasOficiais[i]
      try {
        const existente = app.findFirstRecordByData('categorias', 'nome', item.nome)
        existente.set('regra_horas_unitaria', item.regra)
        existente.set('teto_maximo_curso', item.teto)
        existente.set('ativo', true)
        app.save(existente)
      } catch (_) {
        const nova = new Record(catCol)
        nova.set('nome', item.nome)
        nova.set('regra_horas_unitaria', item.regra)
        nova.set('teto_maximo_curso', item.teto)
        nova.set('ativo', true)
        app.save(nova)
      }
    }

    // 4. Registro obrigatório de auditoria estrutural do NDE
    try {
      const logsCol = app.findCollectionByNameOrId('auditoria_logs')
      const log = new Record(logsCol)
      log.set('tipo_evento', 'CONFIGURACAO_ALTERADA')
      log.set('ator_nome', 'Roberta Andrea de Oliveira (Coordenação Psicologia)')
      log.set('ator_email', 'roberta.oliveira@fausp.br')
      log.set('semestre_letivo', '2026.2')
      log.set(
        'descricao',
        'Tabela NDE de categorias de horas complementares atualizada para a versão oficial 2026 fornecida pela coordenação de Psicologia: 13 categorias homologadas com valores unitários e tetos regulamentares exatos.',
      )
      log.set('detalhes_json', {
        versao: '2026-OFICIAL-NDE',
        total_categorias_oficiais: 13,
        atualizado_em: agora,
      })
      app.save(log)
    } catch (e) {
      console.log('Erro ao registrar log de auditoria na migration 0012:', e)
    }
  },
  (app) => {
    // Reversão não recomendada para dados oficiais homologados pelo NDE
  },
)
