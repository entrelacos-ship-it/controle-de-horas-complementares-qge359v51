migrate(
  (app) => {
    // 1. Identificar os IDs dos 5 alunos mockados
    const mockAlunoIds = [
      'xfawmry7pgr1j1y',
      'sunigbv4nvrg3ry',
      'tpn5t85b1yqdhdf',
      'fppmu1edxy2kmqn',
      'b1cm1qu9pxqfbed',
    ]

    const mockMatriculas = ['PSI2023104', 'PSI2024201', 'PSI2025102', 'PSI2026103', 'PSI2026205']

    // 1.a. Excluir lançamentos relacionados aos alunos mockados
    // Exclui tanto por aluno_id quanto por segurança qualquer lançamento de aluno com matrícula PSI (se houver)
    app
      .db()
      .newQuery(
        `DELETE FROM lancamentos WHERE aluno_id IN ('xfawmry7pgr1j1y', 'sunigbv4nvrg3ry', 'tpn5t85b1yqdhdf', 'fppmu1edxy2kmqn', 'b1cm1qu9pxqfbed')`,
      )
      .execute()

    // 1.b. Excluir logs de auditoria relacionados aos mockados
    // Exclui registros com aluno_matricula das matrículas PSI, ou log pontual ma75w7vfy7ko557
    app
      .db()
      .newQuery(
        `DELETE FROM auditoria_logs WHERE aluno_matricula IN ('PSI2023104', 'PSI2024201', 'PSI2025102', 'PSI2026103', 'PSI2026205') OR id = 'ma75w7vfy7ko557'`,
      )
      .execute()

    // 1.c. Excluir os 5 alunos mockados da coleção alunos
    app
      .db()
      .newQuery(
        `DELETE FROM alunos WHERE id IN ('xfawmry7pgr1j1y', 'sunigbv4nvrg3ry', 'tpn5t85b1yqdhdf', 'fppmu1edxy2kmqn', 'b1cm1qu9pxqfbed') OR matricula IN ('PSI2023104', 'PSI2024201', 'PSI2025102', 'PSI2026103', 'PSI2026205')`,
      )
      .execute()
  },
  (app) => {
    // Reversão não aplicável para limpeza de dados mockados
  },
)
