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

## Backlog (P1/P2)
- P1: Login com Google (Emergent Auth)
- P1: Exportar diagnósticos em PDF/Excel
- P1: Anexar fotos/relatórios nos diagnósticos
- P2: Notificações por e-mail quando status escalar
- P2: Histórico de manutenção e custos
- P2: IA para sugerir defeitos a partir dos sintomas
