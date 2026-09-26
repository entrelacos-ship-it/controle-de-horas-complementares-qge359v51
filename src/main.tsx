/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'
import { executarTestesUnitarios } from './lib/calculoHoras.test.ts'

// Executa suíte de validações e testes unitários garantindo integridade
try {
  const resultadoTestes = executarTestesUnitarios()
  if (resultadoTestes.todosPassaram) {
    console.info(
      `[Testes Unitários FAUSP] Todos os ${resultadoTestes.resultados.length} testes passaram com sucesso.`,
    )
  }
} catch (err) {
  console.error('[Testes Unitários FAUSP] Falha na execução dos testes:', err)
}

// @skip-protected: Do not remove. Required for React rendering.
createRoot(document.getElementById('root')!).render(<App />)
