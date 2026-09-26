migrate(
  (app) => {
    // 1. Seed users
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // Seed Coordenador: entre.lacos.psi.cursos@gmail.com
    try {
      const existing = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'entre.lacos.psi.cursos@gmail.com',
      )
      if (!existing.get('role')) {
        existing.set('role', 'Coordenador')
        app.save(existing)
      }
    } catch (_) {
      const coord = new Record(users)
      coord.setEmail('entre.lacos.psi.cursos@gmail.com')
      coord.setPassword('Skip@Pass')
      coord.setVerified(true)
      coord.set('name', 'Prof.ª Roberta Andrea de Oliveira')
      coord.set('role', 'Coordenador')
      app.save(coord)
    }

    // Seed Administrador: tati@fausp.app
    try {
      const existingAdmin = app.findAuthRecordByEmail('_pb_users_auth_', 'tati@fausp.app')
      if (!existingAdmin.get('role')) {
        existingAdmin.set('role', 'Administrador')
        app.save(existingAdmin)
      }
    } catch (_) {
      const admin = new Record(users)
      admin.setEmail('tati@fausp.app')
      admin.setPassword('Skip@Pass')
      admin.setVerified(true)
      admin.set('name', 'Tatiane Administradora')
      admin.set('role', 'Administrador')
      app.save(admin)
    }

    // 2. Seed configuracao_global
    const configCol = app.findCollectionByNameOrId('configuracao_global')
    try {
      app.findFirstRecordByData('configuracao_global', 'semestre_letivo_atual', '2026.2')
    } catch (_) {
      const cfg = new Record(configCol)
      cfg.set('semestre_letivo_atual', '2026.2')
      cfg.set('minimo_exigido_semestre', 20)
      cfg.set('meta_curso', 200)
      app.save(cfg)
    }

    // 3. Seed categorias
    const catCol = app.findCollectionByNameOrId('categorias')
    const defaultCats = [
      {
        nome: 'Eventos científicos com apresentação de trabalho',
        regra: '20h por evento',
        teto: 40,
      },
      { nome: 'Cursos Livres Presenciais ou Online', regra: '10h por atividade', teto: 120 },
      { nome: 'Artes e Cultura', regra: '10h por atividade', teto: 40 },
      { nome: 'Estágio supervisionado extracurricular', regra: '30h por semestre', teto: 60 },
      { nome: 'Iniciação Científica', regra: '20h por semestre', teto: 80 },
    ]

    for (let i = 0; i < defaultCats.length; i++) {
      const c = defaultCats[i]
      try {
        app.findFirstRecordByData('categorias', 'nome', c.nome)
      } catch (_) {
        const rec = new Record(catCol)
        rec.set('nome', c.nome)
        rec.set('regra_horas_unitaria', c.regra)
        rec.set('teto_maximo_curso', c.teto)
        rec.set('ativo', true)
        app.save(rec)
      }
    }

    // 4. Seed alunos
    const alunosCol = app.findCollectionByNameOrId('alunos')
    const sampleAlunos = [
      {
        matricula: 'PSI2024201',
        nome: 'Mariana Costa Silveira',
        turno: 'Matutino',
        semestre_atual: 4,
        periodo_entrada: '2024.2',
        email: 'mariana.silveira@aluno.fausp.br',
      },
      {
        matricula: 'PSI2025102',
        nome: 'Lucas Gabriel dos Santos',
        turno: 'Noturno',
        semestre_atual: 3,
        periodo_entrada: '2025.1',
        email: 'lucas.santos@aluno.fausp.br',
      },
      {
        matricula: 'PSI2026103',
        nome: 'Beatriz Ramos Albuquerque',
        turno: 'Matutino',
        semestre_atual: 2,
        periodo_entrada: '2026.1',
        email: 'beatriz.ramos@aluno.fausp.br',
      },
      {
        matricula: 'PSI2023104',
        nome: 'Felipe Augusto Nogueira',
        turno: 'Noturno',
        semestre_atual: 7,
        periodo_entrada: '2023.1',
        email: 'felipe.nogueira@aluno.fausp.br',
      },
      {
        matricula: 'PSI2026205',
        nome: 'Camila Fernandes Lopes',
        turno: 'Matutino',
        semestre_atual: 1,
        periodo_entrada: '2026.2',
        email: 'camila.lopes@aluno.fausp.br',
      },
    ]

    for (let i = 0; i < sampleAlunos.length; i++) {
      const a = sampleAlunos[i]
      try {
        app.findFirstRecordByData('alunos', 'matricula', a.matricula)
      } catch (_) {
        const rec = new Record(alunosCol)
        rec.set('matricula', a.matricula)
        rec.set('nome', a.nome)
        rec.set('turno', a.turno)
        rec.set('semestre_atual', a.semestre_atual)
        rec.set('periodo_entrada', a.periodo_entrada)
        rec.set('email', a.email)
        app.save(rec)
      }
    }

    // 5. Seed lancamentos
    const lancamentosCol = app.findCollectionByNameOrId('lancamentos')

    // Find alunos and categorias to link
    let alunoMariana, alunoLucas, alunoBeatriz, alunoFelipe
    let catEventos, catCursos, catArtes, catEstagio, catIC

    try {
      alunoMariana = app.findFirstRecordByData('alunos', 'matricula', 'PSI2024201')
      alunoLucas = app.findFirstRecordByData('alunos', 'matricula', 'PSI2025102')
      alunoBeatriz = app.findFirstRecordByData('alunos', 'matricula', 'PSI2026103')
      alunoFelipe = app.findFirstRecordByData('alunos', 'matricula', 'PSI2023104')

      catEventos = app.findFirstRecordByData(
        'categorias',
        'nome',
        'Eventos científicos com apresentação de trabalho',
      )
      catCursos = app.findFirstRecordByData(
        'categorias',
        'nome',
        'Cursos Livres Presenciais ou Online',
      )
      catArtes = app.findFirstRecordByData('categorias', 'nome', 'Artes e Cultura')
      catEstagio = app.findFirstRecordByData(
        'categorias',
        'nome',
        'Estágio supervisionado extracurricular',
      )
      catIC = app.findFirstRecordByData('categorias', 'nome', 'Iniciação Científica')
    } catch (_) {
      return
    }

    // Check if lancamentos already exist
    const existingCount = app.countRecords('lancamentos')
    if (existingCount > 0) return

    // Mariana: 2x 20h in Eventos cientificos (Total 40h -> hits cap! BLOQUEADA!)
    // plus 30h in Cursos libres, 10h in 2026.2 (Total: 70h, 2026.2: 10h -> NAO CUMPRIU this semester)
    const lancamentosToSeed = [
      {
        aluno_id: alunoMariana.id,
        categoria_id: catEventos.id,
        data_lancamento: '2025-05-10 10:00:00.000Z',
        semestre: '2025.1',
        horas: 20,
        comprovante: true,
        relatorio: true,
        obs: 'Apresentação no Congresso Brasileiro de Psicologia do Desenvolvimento',
      },
      {
        aluno_id: alunoMariana.id,
        categoria_id: catEventos.id,
        data_lancamento: '2025-11-20 10:00:00.000Z',
        semestre: '2025.2',
        horas: 20,
        comprovante: true,
        relatorio: true,
        obs: 'Simpósio Regional de Neuropsicologia Aplicada - Trabalho Completo',
      },
      {
        aluno_id: alunoMariana.id,
        categoria_id: catCursos.id,
        data_lancamento: '2026-08-15 10:00:00.000Z',
        semestre: '2026.2',
        horas: 10,
        comprovante: true,
        relatorio: true,
        obs: 'Curso de Atualização em TCC - 20h certificadas (10h aproveitadas)',
      },
      // Lucas: 30h in 2026.2 (Cursos 20h, Artes 10h) -> CUMPRIU this semester (30h >= 20h)
      {
        aluno_id: alunoLucas.id,
        categoria_id: catCursos.id,
        data_lancamento: '2026-08-20 14:00:00.000Z',
        semestre: '2026.2',
        horas: 20,
        comprovante: true,
        relatorio: true,
        obs: 'Curso Psicologia Hospitalar e Cuidados Paliativos',
      },
      {
        aluno_id: alunoLucas.id,
        categoria_id: catArtes.id,
        data_lancamento: '2026-09-05 16:00:00.000Z',
        semestre: '2026.2',
        horas: 10,
        comprovante: true,
        relatorio: true,
        obs: 'Visita mediada à Bienal de Arte e Ensaio Reflexivo',
      },
      // Beatriz: 2026.1 10h Artes, 2026.2 0h -> NAO CUMPRIU this semester
      {
        aluno_id: alunoBeatriz.id,
        categoria_id: catArtes.id,
        data_lancamento: '2026-04-12 11:00:00.000Z',
        semestre: '2026.1',
        horas: 10,
        comprovante: true,
        relatorio: true,
        obs: 'Mostra Cultural de Cinema e Psicologia',
      },
      // Felipe: Estágio 30h in 2025.2, Iniciação 20h in 2026.1, Cursos 20h in 2026.2 -> Total 70h, 2026.2 CUMPRIU (20h >= 20h)
      // Plus one estorno negative entry to show estorno count in students table
      {
        aluno_id: alunoFelipe.id,
        categoria_id: catEstagio.id,
        data_lancamento: '2025-10-18 10:00:00.000Z',
        semestre: '2025.2',
        horas: 30,
        comprovante: true,
        relatorio: true,
        obs: 'Estágio Extracurricular em Clínica Comunitária',
      },
      {
        aluno_id: alunoFelipe.id,
        categoria_id: catIC.id,
        data_lancamento: '2026-03-25 10:00:00.000Z',
        semestre: '2026.1',
        horas: 20,
        comprovante: true,
        relatorio: true,
        obs: 'Iniciação Científica PIBIC - Relatório Semestral Aprovado',
      },
      {
        aluno_id: alunoFelipe.id,
        categoria_id: catCursos.id,
        data_lancamento: '2026-08-10 10:00:00.000Z',
        semestre: '2026.2',
        horas: 20,
        comprovante: true,
        relatorio: true,
        obs: 'Formação em Psicodiagnóstico Infantil',
      },
      {
        aluno_id: alunoFelipe.id,
        categoria_id: catCursos.id,
        data_lancamento: '2026-08-12 10:00:00.000Z',
        semestre: '2026.2',
        horas: -5,
        comprovante: true,
        relatorio: true,
        obs: 'Estorno de 5h lançado a maior por duplicidade de certificado do curso infantil',
      },
    ]

    for (let i = 0; i < lancamentosToSeed.length; i++) {
      const l = lancamentosToSeed[i]
      const rec = new Record(lancamentosCol)
      rec.set('aluno_id', l.aluno_id)
      rec.set('categoria_id', l.categoria_id)
      rec.set('data_lancamento', l.data_lancamento)
      rec.set('semestre_letivo_atividade', l.semestre)
      rec.set('horas_aceitas', l.horas)
      rec.set('comprovante_ok', l.comprovante)
      rec.set('relatorio_ok', l.relatorio)
      rec.set('observacao', l.obs)
      app.save(rec)
    }
  },
  (app) => {
    // down migration
  },
)
