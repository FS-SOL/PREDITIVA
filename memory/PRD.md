# FS Soluções — Preditiva

## Problem Statement (original)
Criar software de manutenção preditiva. Login (e-mail/senha + Google) com sidebar colapsável e cadastro de usuários. Dashboard executivo com KPIs, distribuição de status (OK/A1/A2/Parado), evolução mensal, principais defeitos e índice de saúde. Gráfico com probabilidade de falha. Hierarquia Empresa → Unidade → Área → Equipamento → Subconjunto → Pontos com importação Excel. Cadastro completo de máquinas com busca e importação. Listas de Análise de Vibração e Termografia em cards. Biblioteca de Defeitos catalogada (desbalanceamento, desalinhamento, BPFO/BPFI/BSF, cavitação, folga, barra quebrada) editável. Tela de diagnóstico em 3 colunas com auto-preenchimento. Banco de diagnósticos pesquisável. Template Excel para importação com linha de tendência por ponto. Nome: FS SOLUÇÕES - PREDITIVA.

## Architecture
- Backend: FastAPI + Motor (MongoDB) + JWT (HttpOnly cookie + Bearer fallback) + bcrypt
- Frontend: React 19 + React Router 7 + Tailwind + shadcn/ui + Recharts + lucide-react
- Auth: email/senha JWT, admin seedado automaticamente

## User Personas
- Administrador: gerencia usuários, plantas e biblioteca
- Gestor: visualiza dashboards e ranking de falhas
- Técnico: executa diagnósticos e edita recomendações

## Implemented (Feb 2026)
- Login + cadastro de usuários (JWT)
- Sidebar colapsável (8 seções)
- Dashboard executivo (KPIs, pizza status, evolução mensal, top defeitos, probabilidade de falha)
- Hierarquia de Plantas com árvore expansível
- CRUD de Máquinas com busca, filtro por tipo, importação Excel
- Biblioteca de Defeitos (11 defeitos seedados: desbalanceamento, desalinhamento, BPFO, BPFI, BSF, folga, cavitação, barra quebrada, GMF, lubrificação, termografia)
- Diagnóstico em 3 colunas com auto-preenchimento e atualização de status
- Banco de diagnósticos pesquisável
- Lista de Análise de Vibração com cards e linha de tendência por ponto
- Lista de Termografia com cards
- Importação Excel de medidas (template_overall_vibracao)

## Updated (Jun 2026)
- Corrigida importação de Medições Overall: casa máquina por parent_tag + subconjunto (case-insensitive), com fallback para tag composta; cria stub se não achar. Verificado via curl.
- `GET /api/measurements/template`: gera .xlsx pré-preenchido com todas as máquinas de vibração (Equipamento=parent_tag, Subconjunto). Botão "Baixar Template" na tela de Vibração.
- Aba "Medições" em Análise de Vibração: tabela global (Data, Equip., Subconjunto, Ponto, Valor, Unidade, Detecção, Alarme ISO 10816-3).
- Helper `iso_alarm` (ISO 10816-3 velocidade RMS mm/s: OK≤2.8, A1≤7.1, A2≤11, Parado>11; escala separada para aceleração g).
- Cards de vibração mostram "Pico: <valor> <unidade> @ <ponto>".
- Dashboard já conta subconjuntos (registros individuais) — confirmado, sem alteração necessária.

## Updated (Jun 2026 - parte 2)
- Aba Medições reformulada: filtro por máquina (dropdown), mostra apenas o VALOR ATUAL por ponto (último por data), preservando o histórico no banco.
- Tendência por ponto: botão "Ver" abre modal com gráfico da evolução mensal daquele ponto.
- Excluir medição: botão por linha (DELETE /api/measurements/point/clear) + endpoint DELETE /api/measurements/{id}. Ambos bloqueiam visualizador (403).
- Pico no card agora usa o valor atual por ponto: "Pico: <valor> <unidade> @ <ponto>".
- Importação de Termografia: botão "Importar Lista" na tela Termografia (POST /api/machines/import detecta aba com TERMO), oculto para visualizador.
- Testado: backend 8/8 (iteration_5), frontend validado (admin + viewer RBAC).

## Updated (Jun 2026 - parte 3)
- CORRIGIDO import de Termografia: na planilha real cada linha da aba TERMOGRAFIA é um equipamento próprio (TAG+LOCAL) sem subconjunto. O parser agora ramifica por tipo: termografia trata subconjunto como opcional (tag = TAG crua); vibração mantém tag composta via Descrição. Importou 200 registros de termografia. Validado iteration_6 (backend 13/13, frontend 5/5).

## Updated (Jul 2026 - parte 4)
- CORRIGIDO pico no card de vibração (maior valor entre pontos) + matching de subconjunto por "contém" (ex: MOTOR→Motor 01). Limpeza de stubs de tag crua. Validado iteration_7.
- Ordem da importação preservada: campo `ordem` nas medições; listagem ordenada por ordem (com backfill p/ legados).
- Tendência corrigida: por ponto (máquina+ponto+detecção); modal da máquina lista pontos com valor atual e botão de tendência.
- Nova aba "Tabela de Dados" na Vibração: matriz equipamento/ponto × colunas de datas, células coloridas por alarme ISO.
- Timeline de status de diagnóstico no card de vibração (bolinhas coloridas).
- Excluir diagnóstico também dentro do modal de histórico da máquina.
- Defeitos com campo `tipo` (vibracao/termografia/ambos); tela Diagnóstico filtra defeitos pelo tipo da máquina; adicionados defeitos padrão de termografia + defeito "Equipamento em Bom Estado" (Status OK).
- Auditoria: tela "Histórico de Exclusões" (somente admin) + log de toda exclusão (diagnóstico, medição, máquina, defeito, planta) com usuário/quando. Endpoint GET /api/audit/deletions.
- Validado iteration_8: frontend 11/11, backend 10/11 (item de backfill de `ordem` corrigido depois).

## Updated (Jul 2026 - parte 5)
- Correção: Tabela de Dados e Tendência agrupam por data+hora (mesmo dia não colapsa). Visão Cards/Lista com busca em Vibração e Termografia. Validado iteration_9.
- **Temperatura na Termografia**: template + importação; aba "Temperaturas" (valor atual, ambiente, ΔT, alarme OK≤60/A1≤90/A2≤120/Parado>120 °C), tendência por ponto, exclusão; "Máx °C" nos cards/lista; aba "Tabela de Dados". Collection `thermal`, endpoints /api/thermal/*.
- **Exportar Tabela de Dados (Excel)**: /api/measurements/export e /api/thermal/export (pivot ponto×datas) + botões "Exportar Excel".
- **Dashboard — Alertas do Último Upload**: bloco com pontos em A2/Parado no valor mais recente (`latest_alerts`).
- Descritivo completo em /app/FUNCIONALIDADES.md. Validado iteration_10: backend 7/7, frontend 100%.

## Fix (Jul 2026)
- Corrigido efeito "escada" na Tabela de Dados: importação agora usa UM timestamp por lote (batch_ts) e a matriz (Vibração e Termografia) agrupa colunas por MINUTO — medições da mesma coleta ficam na mesma coluna, independente do ponto. Coletas de horários diferentes permanecem separadas. Exports Excel também agrupados por minuto. Validado iteration_11: backend 8/8, frontend 100%.

## Backlog (P1/P2)
- P1: Login com Google (Emergent Auth)
- P1: Exportar diagnósticos em PDF/Excel
- P1: Anexar fotos/relatórios nos diagnósticos
- P2: Notificações por e-mail quando status escalar
- P2: Histórico de manutenção e custos
- P2: IA para sugerir defeitos a partir dos sintomas
