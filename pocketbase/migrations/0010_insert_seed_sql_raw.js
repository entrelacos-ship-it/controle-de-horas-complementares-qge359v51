migrate(
  (app) => {
    // Inserir registro inicial da ata 01/2026 e log de auditoria correspondente via SQL raw caso a tabela exista
    try {
      const agora = new Date().toISOString()
      app
        .db()
        .newQuery(`
        INSERT INTO atas_nde (
          id, numero_ata, semestre_letivo, data_homologacao, status,
          total_alunos_avaliados, total_concluintes_aptos, total_cumpriram_meta,
          total_alerta_pedagogico, total_horas_deferidas, presidente_coordenadora,
          crp_coordenadora, resumo_deliberacao, created, updated
        ) VALUES (
          'ata_seed_012026', '01/2026', '2026.1', '2026-07-08 10:00:00.000Z', 'HOMOLOGADA',
          6, 0, 5,
          1, 175, 'Roberta Andrea de Oliveira',
          '06/77114', 'Ata ordinária de fechamento do semestre letivo 2026.1. Homologadas 175 horas complementares deferidas pelo NDE com certificação oficial para a Secretaria Acadêmica Geral.',
          {:agora}, {:agora}
        )
      `)
        .bind({ agora })
        .execute()

      app
        .db()
        .newQuery(`
        INSERT INTO auditoria_logs (
          id, tipo_evento, ator_nome, ator_email, semestre_letivo, descricao, created, updated
        ) VALUES (
          'log_seed_012026', 'HOMOLOGACAO_SEMESTRE', 'Roberta Andrea de Oliveira', 'roberta.oliveira@fausp.br', '2026.1',
          'Homologação oficial do semestre letivo 2026.1 — Emissão da Ata NDE N° 01/2026 com 175h deferidas e 6 alunos avaliados.',
          {:agora}, {:agora}
        )
      `)
        .bind({ agora })
        .execute()
    } catch (e) {
      console.log('Seed raw sql ata 01/2026:', e)
    }
  },
  (app) => {},
)
