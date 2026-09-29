migrate(
  (app) => {
    const catCol = app.findCollectionByNameOrId('categorias')
    const agora = new Date().toISOString()

    // 1. Definição exata das 13 categorias oficiais NDE fornecidas pela coordenação do curso de Psicologia:
    // 1. Eventos científicos internacionais com apresentação de trabalho — 15 horas cada / máx 40h
    // 2. Eventos científicos nacionais, regionais ou locais com apresentação de trabalho — 10 horas cada / máx 40h
    // 3. Eventos científicos internacionais ou nacionais sem apresentação de trabalho — 5 horas cada / máx 30h
    // 4. Eventos científicos regionais ou locais sem apresentação de trabalho — 3 horas / máx 30h
    // 5. Publicação autoria ou coautoria livro, capítulo de livro, artigo ou aceite de artigo para publicação — 25 horas cada / máx 50h
    // 6. Monitoria em disciplinas do curso de psicologia — 20 horas por semestre / máx 60h
    // 7. Artes e cultura cinema, espetáculos, teatro, etc. — 10 horas cada evento / máx 150h
    // 8. Visitas técnicas em clínicas, hospitais, unidades de saúde, etc, com psicólogo no local — 10 horas cada / máx 40h
    // 9. Estágio remunerado em psicologia com supervisor no local — 15 horas a cada 4 meses / máx 150h
    // 10. Cursos livres presenciais ou online de até 8h — 5 horas / máx 120h
    // 11. Cursos livres presenciais ou online de 9 a 20 horas — 10 horas / máx 120h
    // 12. Cursos livres presenciais ou online de 21 ou mais — 15 horas / máx 120h
    // 13. Livros lidos de forma coletiva exclusivamente no Clube de Leitura Mulheres Força da R'Existência (segundo regras estabelecidas) — 10 horas para um livro de no máximo 200 páginas por semestre / máx 80h
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

    // 2. Corrigir eventuais variações de nomes antigos ou incorretos (ex.: "Club de Leitura...")
    const variantesParaNormalizar = [
      "Club de Leitura Mulheres Força da R'Existência (segundo regras estabelecidas)",
      'Club de Leitura Mulheres Força da Resistência',
      'Clube de Leitura Mulheres Força da Resistência',
      "Clube de Leitura Mulheres Força da R'Existência",
    ]

    const nomeOficialClube =
      "Livros lidos de forma coletiva exclusivamente no Clube de Leitura Mulheres Força da R'Existência (segundo regras estabelecidas)"

    for (let i = 0; i < variantesParaNormalizar.length; i++) {
      try {
        const variante = app.findFirstRecordByData('categorias', 'nome', variantesParaNormalizar[i])
        // Se já existir a oficial, desativar ou apontar; caso contrário, renomear para a oficial
        try {
          app.findFirstRecordByData('categorias', 'nome', nomeOficialClube)
          // Oficial já existe, desativar variante antiga
          variante.set('ativo', false)
          app.save(variante)
        } catch (_) {
          variante.set('nome', nomeOficialClube)
          variante.set(
            'regra_horas_unitaria',
            '10 horas para um livro de no máximo 200 páginas por semestre',
          )
          variante.set('teto_maximo_curso', 80)
          variante.set('ativo', true)
          app.save(variante)
        }
      } catch (_) {}
    }

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

    // 4. Registro obrigatório na trilha de auditoria (auditoria_logs) assinado por Roberta Andrea de Oliveira
    try {
      const logsCol = app.findCollectionByNameOrId('auditoria_logs')
      const log = new Record(logsCol)
      log.set('tipo_evento', 'CONFIGURACAO_ALTERADA')
      log.set('ator_nome', 'Roberta Andrea de Oliveira (Coordenação Psicologia)')
      log.set('ator_email', 'roberta.oliveira@fausp.br')
      log.set('semestre_letivo', '2026.2')
      log.set(
        'descricao',
        'Revisão completa da Tabela NDE de categorias de horas complementares: conferência e validação das 13 categorias oficiais homologadas, valores unitários e tetos de curso.',
      )
      log.set('detalhes_json', {
        versao: '2026-REVISAO-NDE-OFICIAL',
        total_categorias_oficiais: 13,
        categorias: categoriasOficiais.map((c) => ({
          nome: c.nome,
          regra_horas_unitaria: c.regra,
          teto_maximo_curso: c.teto,
        })),
        revisado_em: agora,
      })
      app.save(log)
    } catch (e) {
      console.log('Erro ao registrar log de auditoria na migration 0013:', e)
    }
  },
  (app) => {
    // Reversão não recomendada para dados oficiais homologados pelo NDE
  },
)
