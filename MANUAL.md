# MANUAL DO SISTEMA — FS SOLUÇÕES PREDITIVA
Sistema web de manutenção preditiva (Análise de Vibração + Termografia)

---

## 1. VISÃO GERAL
O FS Soluções Preditiva centraliza o acompanhamento da saúde dos ativos por meio de:
- **Análise de Vibração** (medições Overall com classificação ISO 10816-3);
- **Termografia** (temperaturas com classificação por °C e ΔT);
- **Diagnósticos** padronizados a partir de uma Biblioteca de Defeitos;
- **Dashboard executivo**, **Relatórios** e **Auditoria** de exclusões.

**Como acessar:** abra a URL do sistema no navegador → tela de Login.
**Idioma/Datas:** Português (pt-BR); datas no fuso de Brasília.

---

## 2. LOGIN E PERFIS DE USUÁRIO

### 2.1 Login
1. Informe **e-mail** e **senha**.
2. Clique em **Entrar**. A sessão dura 7 dias.

### 2.2 Perfis (papéis)
| Perfil | O que pode fazer |
|--------|------------------|
| **Administrador** | Tudo: Plantas, Biblioteca de Defeitos, Usuários, Auditoria, importações, exclusões. |
| **Técnico/Gestor (editor)** | Cria/edita diagnósticos, importa dados, exclui medições/diagnósticos. Não vê telas exclusivas de admin. |
| **Visualizador** | Somente leitura. Não cria, edita ou exclui (bloqueado na tela e no servidor). |

### 2.3 Cadastrar usuário (admin)
Menu **Usuários** → **Novo Usuário** → preencha nome, e-mail, senha e perfil → **Salvar**.

### 2.4 Navegação
Barra lateral **colapsável** (botão de seta). Os itens visíveis dependem do seu perfil.

---

## 3. DASHBOARD EXECUTIVO
Tela inicial com a visão geral dos ativos:
- **KPIs:** Máquinas, Índice de Saúde, Diagnósticos, Em Alerta (A1+A2+Parado).
- **Índice de Saúde (média ponderada):** 0–100%, considerando só máquinas diagnosticadas
  (OK=100, A1=70, A2=40, Parado=0).
- **Alertas do Último Upload:** lista os pontos (vibração e temperatura) que estão em
  **A2/Crítico ou Parado** no valor mais recente — priorize a inspeção destes.
- **Distribuição de Status** (pizza), **Evolução Mensal** (linha, 6 meses),
  **Principais Defeitos** (barras) e **Probabilidade de Falha** (ranking status × criticidade).

---

## 4. PLANTAS (admin)
Estrutura hierárquica dos ativos: **Empresa → Unidade → Área → Equipamento → Subconjunto → Ponto**.
- Adicionar nó: selecione o nível pai e clique em **Adicionar**.
- Editar/Excluir: use os ícones no nó (a exclusão é registrada na Auditoria).

---

## 5. MÁQUINAS
Cadastro central dos equipamentos.

### 5.1 Conceito de TAG composta
Cada registro é identificado por **`equipamento / subconjunto`** (ex.: `ESF-0001 / Motor 01`).
Um equipamento com vários subconjuntos gera vários registros.

### 5.2 Ações
- **Buscar/Filtrar:** por TAG, equipamento, local; filtros por tipo e status.
- **Novo/Editar:** TAG, subconjunto, local, equipamento, descrição, fabricante, RPM,
  potência, rolamentos (LA/LOA), criticidade, tipo (vibração/termografia/ambos).
- **Importar Excel:** carrega a lista; cada equipamento é desdobrado por subconjunto.
- **Excluir:** remove a máquina e suas medições (registrado na Auditoria).

### 5.3 Formato da planilha de máquinas
Aba com cabeçalho contendo **TAG, LOCAL DE INSTALAÇÃO, EQUIPAMENTOS, Descrição/Componente**.
- Linha com TAG + LOCAL = novo equipamento; linhas seguintes com **Descrição** = subconjuntos
  (vibração). Para termografia, cada linha TAG+LOCAL é um ponto próprio.
- A aba de vibração deve ter "VIBRA" no nome; a de termografia, "TERMO".

---

## 6. ANÁLISE DE VIBRAÇÃO
Tela com **3 abas** e visualização em **Cards** ou **Lista** (com busca).

### 6.1 Aba MÁQUINAS
Cada máquina exibe: status, RPM, nº de pontos, **Pico** (`Pico: valor unidade @ ponto` — o
maior valor entre os pontos) e uma **timeline colorida** com o histórico de diagnósticos.
Clique na máquina para ver o **detalhe** (tabela de pontos + tendência por ponto).

### 6.2 Aba MEDIÇÕES
Mostra o **valor atual** de cada ponto (o último por data), com:
- **Alarme ISO 10816-3** (velocidade mm/s): OK ≤ 2,8 · A1 ≤ 7,1 · A2 ≤ 11 · Parado > 11.
  (Aceleração em g usa escala própria.)
- **Filtro por máquina**, botão **Ver tendência** (gráfico do ponto ao longo do tempo) e
  botão **Excluir** (remove o histórico daquele ponto).

### 6.3 Aba TABELA DE DADOS
Matriz **equipamento/ponto × datas de coleta**:
- Cada **importação** vira **uma coluna** (agrupada por horário da coleta).
- Coletas em horários diferentes ficam em colunas separadas (histórico mês a mês).
- Células coloridas pelo nível de alarme.
- Botão **Exportar Excel** gera a planilha da matriz (respeita o filtro de máquina).

### 6.4 Importar medições (Overall)
1. Clique em **Baixar Template** (gera .xlsx já preenchido com as máquinas de vibração).
2. Preencha as colunas **Ponto, Unidade, Detecção, Valor** de cada linha.
3. Clique em **Importar Overall** e selecione o arquivo.
> A vinculação é por **Equipamento (parent_tag) + Subconjunto** (aceita variações de maiúsculas
> e "MOTOR" casando "Motor 01"). Se não encontrar, cria um registro provisório.

---

## 7. TERMOGRAFIA
Tela com **3 abas** e visualização em **Cards** ou **Lista** (com busca).

### 7.1 Aba PONTOS
Lista os pontos de inspeção (quadros, transformadores, mancais). Cada card mostra TAG,
equipamento, local, componente, **Máx °C @ ponto** (maior temperatura atual) e último diagnóstico.
- **Importar Lista:** carrega a lista de pontos de termografia (.xlsx).

### 7.2 Aba TEMPERATURAS
Registra e classifica as temperaturas:
- **Template Temp.:** baixa .xlsx com colunas **Equipamento, Ponto, Temperatura, Temp_Ambiente**.
- **Importar Temperaturas:** carrega os valores.
- Cada ponto mostra **temperatura atual, ambiente, ΔT** e **alarme**:
  **OK ≤ 60°C · Atenção (A1) ≤ 90°C · Crítico (A2) ≤ 120°C · Parado > 120°C**.
- Botões de **tendência** (gráfico) e **excluir** por ponto.

### 7.3 Aba TABELA DE DADOS
Matriz **ponto × datas** das temperaturas, com **Exportar Excel** e cores por alarme.

---

## 8. BIBLIOTECA DE DEFEITOS (admin)
Catálogo padronizado usado no auto-preenchimento dos diagnósticos.
- Cada defeito tem: nome, **categoria**, **tipo** (vibração/termografia/ambos), sintomas,
  frequências, causas, consequências, ações, **diagnóstico padrão**, recomendação e **alarme**.
- Já vêm cadastrados defeitos de **vibração** (desbalanceamento, desalinhamento, rolamentos
  BPFO/BPFI/BSF, folga, cavitação, barra quebrada, GMF, lubrificação), de **termografia**
  (ponto quente, sobrecarga, mau contato, desequilíbrio de fases) e o defeito
  **"Equipamento em Bom Estado" (OK)**.
- **Novo/Editar/Excluir** defeitos livremente.

---

## 9. DIAGNÓSTICO
Emissão de laudos técnicos em 3 passos.

### 9.1 Fluxo (modo Cards)
1. Selecione a máquina a diagnosticar.
2. **Coluna 1 — Defeitos:** marque os defeitos observados. A lista mostra **apenas os defeitos
   do tipo da máquina** (vibração ou termografia).
3. **Coluna 2 — Auto-preenchimento:** diagnóstico, causa, consequência e recomendação são
   preenchidos a partir dos defeitos marcados (você pode editar).
4. **Coluna 3 — Revisão:** defina o **novo status** (OK/A1/A2/Parado) e **Salvar**.
   O status da máquina é atualizado automaticamente.

### 9.2 Visões
- **Cards:** máquinas para diagnosticar.
- **Histórico por Máquina:** timeline de status; clique para ver todos os diagnósticos e
  **excluir** algum, se necessário.
- **Banco:** tabela pesquisável de todos os diagnósticos, com opção de **excluir**.

---

## 10. RELATÓRIOS
- **Resumo executivo:** KPIs, distribuição de status, índice de saúde, principais defeitos e
  máquinas críticas (A2/Parado).
- **Relatório completo:** o resumo + a lista detalhada de todos os diagnósticos.

---

## 11. AUDITORIA (admin)
Trilha de **todas as exclusões** feitas no sistema (diagnóstico, medição, máquina, defeito, planta),
registrando **quem excluiu, o quê e quando**. Possui busca e filtro por tipo de evento.

---

## 12. CONCEITOS E CRITÉRIOS

### 12.1 Status / Alarmes
| Nível | Vibração (mm/s) | Temperatura (°C) | Significado |
|-------|------------------|------------------|-------------|
| OK | ≤ 2,8 | ≤ 60 | Normal |
| A1 | ≤ 7,1 | ≤ 90 | Atenção |
| A2 | ≤ 11 | ≤ 120 | Alerta/Crítico |
| Parado | > 11 | > 120 | Intervir |

### 12.2 Regras importantes
- **Histórico preservado:** cada importação mensal mantém os valores anteriores; as telas
  mostram o valor atual e permitem ver a tendência.
- **Uma importação = uma coluna** na Tabela de Dados (agrupada por horário da coleta).
- **Segurança por perfil:** ações que alteram dados exigem editor/admin; o visualizador é
  bloqueado na interface e no servidor.

---

## 13. FLUXO RECOMENDADO DE USO (mensal)
1. **Máquinas:** garanta que o parque está cadastrado (importe a lista, se necessário).
2. **Vibração → Baixar Template** → preencha as medições do mês → **Importar Overall**.
3. **Termografia → Template Temp.** → preencha as temperaturas → **Importar Temperaturas**.
4. **Dashboard → Alertas do Último Upload:** priorize os pontos em A2/Parado.
5. **Diagnóstico:** emita os laudos dos pontos em alerta (auto-preenchimento pela biblioteca).
6. **Relatórios:** gere o resumo/completo para a gestão.
7. **Tabela de Dados → Exportar Excel:** anexe o histórico consolidado, se desejar.
