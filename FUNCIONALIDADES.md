# FS SOLUÇÕES — PREDITIVA
## Descritivo de Funcionalidades do Sistema

Sistema web de **manutenção preditiva** para acompanhamento da saúde de máquinas por
**Análise de Vibração** e **Termografia**, com diagnósticos padronizados, relatórios
executivos e trilha de auditoria.

**Tecnologia:** React + Tailwind (frontend), FastAPI + MongoDB (backend), autenticação JWT.
**Idioma:** Português (pt-BR). Datas exibidas no fuso de Brasília (America/Sao_Paulo).

---

## 1. Acesso e Usuários (Autenticação)
- **Login** por e-mail e senha (token JWT com validade de 7 dias).
- **Cadastro de usuários** com 3 perfis (papéis):
  - **Administrador:** acesso total, incluindo Plantas, Biblioteca de Defeitos, Usuários e Auditoria.
  - **Técnico/Gestor (editor):** cria e edita diagnósticos, importa dados; não acessa telas exclusivas de admin.
  - **Visualizador (somente leitura):** consulta tudo, mas não cria, edita nem exclui (bloqueado na tela e no servidor).
- **Sidebar colapsável** com navegação; itens restritos aparecem conforme o perfil.

## 2. Dashboard Executivo
- **KPIs**: total de máquinas, total de diagnósticos, índice de saúde.
- **Índice de Saúde (média ponderada)**: nota de 0 a 100% considerando apenas máquinas
  diagnosticadas (OK=100, A1=70, A2=40, Parado=0).
- **Distribuição de status** (OK / A1 / A2 / Parado / Sem diag.) em gráfico de pizza.
- **Evolução mensal** dos diagnósticos por status (últimos 6 meses).
- **Principais defeitos** (ranking dos defeitos mais recorrentes).
- **Ranking de probabilidade de falha** (combinação de status × criticidade).

## 3. Plantas (Hierarquia) — *admin*
- Estrutura em árvore: **Empresa → Unidade → Área → Equipamento → Subconjunto → Ponto**.
- Cadastro, edição e exclusão de nós da hierarquia.

## 4. Máquinas
- Cadastro completo: TAG, subconjunto, local, equipamento, descrição, fabricante,
  rotação (RPM), potência, rolamentos (LA/LOA), criticidade, status e tipo (vibração/termografia/ambos).
- **Busca** por TAG, equipamento, local ou descrição; **filtros** por tipo e status.
- **Importação por Excel**: cada equipamento é desdobrado em múltiplos registros por
  subconjunto (ex.: `ESF-0001 / Motor 01`, `ESF-0001 / Motor 02`).
- Exclusão de máquina (remove também suas medições) — registrada na Auditoria.

## 5. Análise de Vibração
Tela com três abas e opção de visualização em **Cards** ou **Lista** (com busca):

- **Aba Máquinas:** cada máquina exibe status, RPM, nº de pontos, **Pico** (maior valor
  medido: `Pico: valor unidade @ ponto`) e uma **timeline colorida** do histórico de
  diagnósticos. Clique abre o detalhe da máquina com a tabela de pontos e a tendência por ponto.
- **Aba Medições:** lista o **valor atual** de cada ponto (último por data), com **Alarme ISO 10816-3**
  (OK ≤ 2,8 / A1 ≤ 7,1 / A2 ≤ 11 / Parado > 11 mm/s para velocidade). Filtro por máquina,
  botão **Ver tendência** (gráfico do ponto ao longo do tempo) e **excluir** medições.
- **Aba Tabela de Dados:** matriz **equipamento/ponto × datas de coleta** (cada importação
  vira uma coluna de data/hora, permitindo múltiplas coletas no mesmo dia), com células
  coloridas pelo nível de alarme.
- **Template Excel**: botão "Baixar Template" gera planilha pré-preenchida com as máquinas
  de vibração; "Importar Overall" carrega as medições preservando a ordem da planilha.

## 6. Termografia
- Lista de pontos de inspeção (quadros elétricos, transformadores, mancais etc.) em
  **Cards** ou **Lista**, com busca.
- Cada ponto mostra TAG, equipamento, local, componente, status e último diagnóstico.
- **Importação por Excel** da lista de termografia ("Importar Lista").

## 7. Biblioteca de Defeitos — *admin*
- Catálogo de defeitos com: nome, categoria, **tipo (vibração / termografia / ambos)**,
  sintomas, frequências, causas, consequências, ações, diagnóstico padrão, recomendação e
  nível de alarme.
- Defeitos padrão de **vibração** (desbalanceamento, desalinhamento, rolamentos BPFO/BPFI/BSF,
  folga, cavitação, barra quebrada, engrenamento GMF, lubrificação), de **termografia**
  (ponto quente, sobrecarga, mau contato, desequilíbrio de fases) e um defeito padrão
  **"Equipamento em Bom Estado"** (Status OK).
- Criar, editar e excluir defeitos.

## 8. Diagnóstico
- Fluxo em 3 colunas: **(1)** marcar defeitos → **(2)** auto-preenchimento do diagnóstico,
  causa, consequência e recomendação → **(3)** revisar, definir o novo status e salvar.
- Os defeitos oferecidos são **filtrados pelo tipo da máquina** (vibração mostra defeitos de
  vibração; termografia mostra defeitos de termografia).
- **Visões**: Cards, Histórico por Máquina (timeline de status) e Banco (tabela pesquisável).
- **Excluir diagnóstico** na aba Banco e também dentro do histórico da máquina.
- Ao salvar, o **status da máquina** é atualizado automaticamente.

## 9. Relatórios
- **Resumo executivo**: KPIs, distribuição de status, índice de saúde, principais defeitos
  e máquinas críticas (A2/Parado).
- **Relatório completo**: tudo do resumo + lista detalhada de todos os diagnósticos.

## 10. Auditoria (Histórico de Exclusões) — *admin*
- Registro automático de **toda exclusão** no sistema (diagnóstico, medição, máquina,
  defeito, planta), com **quem excluiu, o quê e quando**.
- Tela com busca e filtro por tipo de evento. Acesso restrito ao administrador.

---

## Regras e conceitos importantes
- **TAG composta**: máquina identificada por `equipamento / subconjunto`.
- **Alarme ISO 10816-3**: classificação automática do nível de vibração (velocidade em mm/s;
  escala específica para aceleração em g).
- **Histórico preservado**: cada importação mensal guarda os valores anteriores; as telas
  mostram o valor atual e permitem ver a tendência.
- **Perfis e segurança**: ações que alteram dados exigem perfil editor/admin; visualizador é
  bloqueado tanto na interface quanto no servidor.
