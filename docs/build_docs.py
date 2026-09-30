# Gera docs/Operis_Documentacao.pdf  (python3 docs/build_docs.py)
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, Table, TableStyle, Preformatted, KeepTogether, NextPageTemplate
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
import datetime, os

F = '/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('Body', F + 'DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('Body-Bold', F + 'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Body-Italic', F + 'DejaVuSans-Oblique.ttf'))
pdfmetrics.registerFont(TTFont('Mono', F + 'DejaVuSansMono.ttf'))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='Body-Bold', italic='Body-Italic', boldItalic='Body-Bold')

BRAND = colors.HexColor('#2a5bd7'); INK = colors.HexColor('#101828'); MUTED = colors.HexColor('#475467'); LINE = colors.HexColor('#e4e7ec'); SOFT = colors.HexColor('#f4f6fb')
S = {
 'body': ParagraphStyle('body', fontName='Body', fontSize=9.3, leading=14, textColor=INK, spaceAfter=6, alignment=TA_LEFT),
 'h1': ParagraphStyle('h1', fontName='Body-Bold', fontSize=18, leading=22, textColor=BRAND, spaceBefore=4, spaceAfter=10),
 'h2': ParagraphStyle('h2', fontName='Body-Bold', fontSize=12, leading=16, textColor=INK, spaceBefore=12, spaceAfter=5),
 'h3': ParagraphStyle('h3', fontName='Body-Bold', fontSize=10, leading=14, textColor=MUTED, spaceBefore=8, spaceAfter=3),
 'bullet': ParagraphStyle('bullet', fontName='Body', fontSize=9.3, leading=13.5, leftIndent=14, bulletIndent=3, spaceAfter=2.5, textColor=INK),
 'code': ParagraphStyle('code', fontName='Mono', fontSize=7.6, leading=10, textColor=INK, backColor=SOFT, borderPadding=(6, 6, 6, 6), leftIndent=6, rightIndent=6, spaceBefore=4, spaceAfter=10),
 'cell': ParagraphStyle('cell', fontName='Body', fontSize=8, leading=10.5, textColor=INK),
 'cellb': ParagraphStyle('cellb', fontName='Body-Bold', fontSize=8, leading=10.5, textColor=colors.white),
 'toc1': ParagraphStyle('toc1', fontName='Body', fontSize=10, leading=17, leftIndent=0),
 'note': ParagraphStyle('note', fontName='Body', fontSize=8.8, leading=13, textColor=MUTED, backColor=colors.HexColor('#eef4ff'), borderPadding=(7, 8, 7, 8), spaceBefore=4, spaceAfter=10),
}

class Doc(BaseDocTemplate):
    def __init__(self, fn):
        super().__init__(fn, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=18*mm, title='Operis — Documentação técnica', author='Operis')
        fr = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='f')
        self.addPageTemplates([PageTemplate(id='cover', frames=[fr], onPage=self.cover), PageTemplate(id='main', frames=[fr], onPage=self.page)])
    def cover(self, c, d):
        c.setFillColor(BRAND); c.rect(0, A4[1] - 120*mm, A4[0], 120*mm, stroke=0, fill=1)
    def page(self, c, d):
        c.setFont('Body', 7.5); c.setFillColor(MUTED)
        c.drawString(20*mm, 10*mm, 'Operis — Documentação técnica'); c.drawRightString(A4[0] - 20*mm, 10*mm, f'Página {d.page}')
        c.setStrokeColor(LINE); c.line(20*mm, 14*mm, A4[0] - 20*mm, 14*mm)
    def afterFlowable(self, f):
        if isinstance(f, Paragraph) and f.style.name in ('h1', 'h2'):
            lvl = 0 if f.style.name == 'h1' else 1
            key = f'k{id(f)}'; self.canv.bookmarkPage(key)
            self.notify('TOCEntry', (lvl, f.getPlainText(), self.page, key))

story = []
P = lambda t, s='body': story.append(Paragraph(t, S[s]))
H1 = lambda t: (story.append(PageBreak()) if len(story) > 3 else None, story.append(Paragraph(t, S['h1'])))
H2 = lambda t: story.append(Paragraph(t, S['h2']))
H3 = lambda t: story.append(Paragraph(t, S['h3']))
def B(items):
    for i in items: story.append(Paragraph(i, S['bullet'], bulletText='•'))
def CODE(t): story.append(Preformatted(t.strip('\n'), S['code']))
def NOTE(t): story.append(Paragraph(t, S['note']))
def TABLE(rows, widths, head=True):
    data = [[Paragraph(str(c), S['cellb'] if (head and i == 0) else S['cell']) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1 if head else 0)
    st = [('VALIGN', (0, 0), (-1, -1), 'TOP'), ('GRID', (0, 0), (-1, -1), .4, LINE), ('TOPPADDING', (0, 0), (-1, -1), 3.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5)]
    if head: st += [('BACKGROUND', (0, 0), (-1, 0), BRAND)]
    st += [('BACKGROUND', (0, i), (-1, i), SOFT) for i in range(1 if head else 0, len(rows), 2)]
    t.setStyle(TableStyle(st)); story.append(t); story.append(Spacer(1, 8))

def fit(d, w_pts, h_pts):
    k = (170*mm) / w_pts
    d.width = w_pts * k; d.height = h_pts * k; d.scale(k, k); return d

def box(d, x, y, w, h, title, sub='', fill='#eaf0ff', stroke='#2a5bd7'):
    d.add(Rect(x, y, w, h, rx=6, ry=6, fillColor=colors.HexColor(fill), strokeColor=colors.HexColor(stroke), strokeWidth=1))
    d.add(String(x + w/2, y + h - 14, title, fontName='Body-Bold', fontSize=8.5, textAnchor='middle', fillColor=INK))
    for i, l in enumerate(sub.split('\n')):
        d.add(String(x + w/2, y + h - 26 - i*10, l, fontName='Body', fontSize=6.8, textAnchor='middle', fillColor=MUTED))
def arrow(d, x1, y1, x2, y2):
    d.add(Line(x1, y1, x2, y2, strokeColor=MUTED, strokeWidth=1.2))
    import math; a = math.atan2(y2 - y1, x2 - x1)
    d.add(Polygon([x2, y2, x2 - 6*math.cos(a - .4), y2 - 6*math.sin(a - .4), x2 - 6*math.cos(a + .4), y2 - 6*math.sin(a + .4)], fillColor=MUTED, strokeColor=MUTED))

# ============ CAPA ============
story.append(Spacer(1, 38*mm))
story.append(Paragraph('<font color="white" size="30"><b>Operis</b></font>', ParagraphStyle('c1', fontName='Body-Bold', fontSize=30, leading=36)))
story.append(Paragraph('<font color="white" size="13">Gestão operacional de clientes, instalações, treinamentos e acompanhamentos</font>', ParagraphStyle('c2', fontName='Body', fontSize=13, leading=18, spaceBefore=6)))
story.append(Spacer(1, 62*mm))
story.append(Paragraph('Documentação técnica e de manutenção', ParagraphStyle('c3', fontName='Body-Bold', fontSize=16, leading=20, textColor=INK)))
story.append(Paragraph('Arquitetura · Tecnologias · Banco de dados · Funcionalidades · Fluxos · Instalação · Configuração · Testes · Deploy · Manutenção · Evolução', ParagraphStyle('c4', fontName='Body', fontSize=10, leading=15, textColor=MUTED, spaceBefore=8)))
story.append(Spacer(1, 10*mm))
story.append(Paragraph(f'Versão 1.0 · {datetime.date.today().strftime("%d/%m/%Y")}', ParagraphStyle('c5', fontName='Body', fontSize=9, textColor=MUTED)))
story.append(NextPageTemplate('main')); story.append(PageBreak())
toc = TableOfContents(); toc.levelStyles = [ParagraphStyle('t1', fontName='Body-Bold', fontSize=10, leading=18), ParagraphStyle('t2', fontName='Body', fontSize=9, leading=14, leftIndent=14, textColor=MUTED)]
story.append(Paragraph('Sumário', ParagraphStyle('tocT', fontName='Body-Bold', fontSize=18, leading=22, textColor=BRAND, spaceAfter=10))); story.append(toc)

# ============ 1 ============
H1('1. Visão geral')
P('O <b>Operis</b> é um sistema web de gestão operacional para quem atende clientes em ciclos de <b>instalação → treinamento → acompanhamento</b>. Ele substitui planilhas, anotações e aplicativos soltos por um único lugar onde se enxerga, em segundos: o que fazer hoje, o que está agendado, o que está atrasado, quem precisa de contato e o que já foi realizado.')
H2('Problema que resolve')
B(['<b>Visibilidade:</b> dashboard com indicadores, agenda resumida, alertas e área "Atrasados" em destaque.',
   '<b>Organização:</b> cada cliente tem cadastro, jornada, observações rápidas e histórico completo e automático.',
   '<b>Execução:</b> quadros Kanban (instalações, treinamentos, acompanhamentos e tarefas) com arrastar e soltar, agenda diária/semanal/mensal e detecção de conflitos de horário.',
   '<b>Prestação de contas:</b> relatórios por dia/semana/mês/período (PDF, Excel, CSV) e visão de produtividade.',
   '<b>Flexibilidade:</b> status, tipos de treinamento e categorias de tarefa totalmente personalizáveis; nenhum fluxo é obrigatório.'])
H2('Escopo entregue')
P('Todos os módulos pedidos no escopo original foram implementados: clientes (com favoritos e observações), instalações, treinamentos (com tipos), acompanhamentos, tarefas com checklist, agenda central, dashboard, Hoje/Atrasados, notificações (no sistema e do navegador), pesquisa global (Ctrl+K), filtros por data em todos os módulos, relatórios com exportação, produtividade, configurações e multiusuário com níveis de acesso (administrador/colaborador).')
NOTE('<b>Credenciais iniciais:</b> ao subir com banco vazio é criado o administrador definido em ADMIN_EMAIL / ADMIN_PASSWORD (padrão de desenvolvimento: admin@operis.local / admin123). <b>Troque a senha antes de usar em produção.</b> Com <font face="Mono">npm run seed:reset</font> o banco é recriado com dados de demonstração (Restaurante Central, Lanchonete Avenida, Mercado São José, Loja Exemplo e outros) e um colaborador (carla@operis.local / carla123).')

# ============ 2 ============
H1('2. Tecnologias utilizadas')
TABLE([['Tecnologia', 'Onde', 'Função'],
 ['Node.js 22', 'Servidor', 'Ambiente de execução. Usa <font face="Mono">process.loadEnvFile</font> para ler o .env sem dependência extra.'],
 ['TypeScript (strict)', 'Front e back', 'Tipagem estática em todo o código; os tipos do front espelham as respostas da API.'],
 ['Express 5', 'Servidor', 'API REST. Erros lançados em handlers síncronos chegam ao middleware de erro automaticamente.'],
 ['better-sqlite3', 'Servidor', 'Banco SQLite embutido (arquivo único), síncrono e rápido, com transações. Não exige instalar servidor de banco.'],
 ['zod 4', 'Servidor', 'Validação de toda entrada (body e query) com mensagens em português para usuários não técnicos.'],
 ['bcryptjs + jsonwebtoken', 'Servidor', 'Hash de senhas e sessão via JWT em cookie httpOnly (7 dias).'],
 ['helmet, cors, express-rate-limit', 'Servidor', 'Cabeçalhos de segurança/CSP, CORS restrito e limite de tentativas de login.'],
 ['pdfkit / exceljs', 'Servidor', 'Geração dos relatórios em PDF profissional e em Excel (3 abas).'],
 ['React 19 + Vite 7', 'Cliente', 'Interface em componentes; Vite para desenvolvimento rápido e build otimizado com divisão de código por página.'],
 ['React Router', 'Cliente', 'Rotas e navegação; páginas secundárias carregadas sob demanda (lazy).'],
 ['TanStack Query', 'Cliente', 'Cache, revalidação e atualização otimista (ex.: mover card no Kanban).'],
 ['date-fns (pt-BR)', 'Cliente', 'Datas e calendário.'],
 ['lucide-react', 'Cliente', 'Ícones (SVG). Status usam ícone + texto + cor (acessibilidade).'],
 ['CSS próprio com variáveis', 'Cliente', 'Design system leve (tokens, modo escuro automático, responsivo). Sem framework de UI, para manter o bundle pequeno.'],
 ['node:test + Playwright', 'Testes', '11 testes de integração da API e roteiro E2E em navegador real (desktop/tablet/celular).']],
 [38, 24, 108])
H2('Decisões técnicas e motivos')
B(['<b>SQLite em vez de PostgreSQL:</b> uso individual/pequena equipe, zero administração, backup = copiar um arquivo. O acesso ao banco está isolado em serviços; migrar para PostgreSQL exige trocar a camada <font face="Mono">services/</font> e <font face="Mono">db/</font>, sem tocar rotas nem telas.',
   '<b>Tabela única de atividades:</b> instalações, treinamentos, acompanhamentos, tarefas, reuniões e eventos compartilham a tabela <font face="Mono">activities</font> (campo <font face="Mono">type</font>). Isso dá agenda, atrasos, conflitos, busca e relatórios unificados sem código duplicado. Campos específicos ficam nulos nos demais tipos.',
   '<b>Status com "categoria" (kind):</b> o usuário cria e renomeia status livremente, mas cada um pertence a uma categoria estável (pendente, agendado, em andamento, atenção, concluído, cancelado). Relatórios, atrasos e alertas usam a categoria, então nunca quebram ao personalizar.',
   '<b>Datas derivadas, não duplicadas:</b> data da instalação/treinamento e último/próximo acompanhamento do cliente são calculados a partir das atividades (subconsultas), evitando dados divergentes.',
   '<b>Sessão em cookie httpOnly:</b> o token JWT nunca fica acessível ao JavaScript (mitiga XSS). SameSite=Lax mitiga CSRF; a API só aceita JSON.',
   '<b>Fuso horário explícito:</b> o servidor calcula "hoje" e atrasos no fuso configurado (TZ, padrão America/Sao_Paulo), independente do fuso da máquina.'])

# ============ 3 ============
H1('3. Arquitetura')
d = Drawing(560, 110)
box(d, 0, 40, 150, 56, 'Navegador (SPA React)', 'Páginas · Componentes · Hooks\nTanStack Query (cache)')
box(d, 205, 40, 160, 56, 'API Express (Node 22)', 'routes → validação (zod)\n→ services → SQL')
box(d, 420, 40, 140, 56, 'SQLite', 'operis.db (modo WAL)\nbackup = copiar arquivo', fill='#e7f6ec', stroke='#15803d')
arrow(d, 150, 78, 205, 78); arrow(d, 205, 58, 150, 58); arrow(d, 365, 68, 420, 68)
d.add(String(178, 84, 'JSON /api', fontName='Body', fontSize=7, textAnchor='middle', fillColor=MUTED))
d.add(String(0, 14, 'Em produção a API também serve o front compilado (client/dist), gera PDF/XLSX/CSV e roda os lembretes a cada minuto.', fontName='Body', fontSize=7.5, fillColor=MUTED))
fit(d, 560, 110); story.append(d)
H2('Camadas do servidor (server/src)')
TABLE([['Camada', 'Pasta', 'Responsabilidade'],
 ['Entrada', 'index.ts, app.ts', 'Inicia servidor, middlewares de segurança, serve o front, agenda o gerador de notificações.'],
 ['Rotas', 'routes/', 'Mapeia HTTP → serviços. Valida entrada com zod, aplica permissões (requireAuth / requireAdmin). Sem regra de negócio.'],
 ['Validação', 'validation/schemas.ts', 'Schemas zod (formatos, campos obrigatórios, horários, e-mail, telefone).'],
 ['Serviços', 'services/', 'Regras de negócio e SQL: clientes, atividades (conflitos, conclusão, histórico), status, notificações, dashboard, busca, relatórios.'],
 ['Relatórios', 'reports/', 'Exportadores PDF, XLSX e CSV a partir do mesmo objeto de relatório.'],
 ['Banco', 'db/', 'Conexão, esquema, dados padrão e seed de demonstração.'],
 ['Transversais', 'middleware/, utils/', 'Autenticação, tratamento de erros (sem vazar detalhes internos), datas/fuso.']], [26, 38, 106])
H2('Estrutura do cliente (client/src)')
TABLE([['Pasta', 'Conteúdo'],
 ['pages/', 'Uma página por rota: Dashboard, Kanban (genérico p/ 4 tipos), Hoje/Atrasados, Agenda, Clientes, Detalhe do cliente, Relatórios, Produtividade, Configurações, Login.'],
 ['components/ui/', 'Componentes base reutilizáveis: Button, Modal (foco preso, Esc), Form, Badges, States (vazio/erro/skeleton), Dropdown, PeriodPicker.'],
 ['components/activities/', 'Formulário, detalhe, conclusão, card, Kanban, filtros e o <i>provider</i> que abre esses modais de qualquer tela.'],
 ['components/layout, agenda, charts, clients, settings/', 'Sidebar/topbar/busca/notificações; grade de horários; gráfico de barras SVG; formulário de cliente; abas de configuração.'],
 ['hooks/', 'useAuth, useToast, useConfirm, useLookups (status, usuários…), useDebounce, useMediaQuery.'],
 ['api/', 'http.ts (fetch + ApiError) e services.ts (chamadas tipadas agrupadas por módulo).'],
 ['types/, utils/', 'Tipos do domínio; datas, formatação, constantes (rótulos, ícones, rotas).']], [46, 124])
H2('Padrões adotados')
B(['<b>Um único ponto para abrir modais</b> (<font face="Mono">ActivityModalsProvider</font>): qualquer tela chama <font face="Mono">openDetail</font>, <font face="Mono">openForm</font>, <font face="Mono">complete</font> ou <font face="Mono">move</font>; regras como "concluir pede confirmação" ficam em um só lugar.',
   '<b>Kanban genérico:</b> o mesmo componente atende instalações, treinamentos, acompanhamentos e tarefas; as colunas vêm dos status configurados.',
   '<b>Erros padronizados:</b> a API responde <font face="Mono">{ error, code, fields }</font>; o front mostra a mensagem no campo certo ou em um aviso geral.',
   '<b>Ações destrutivas sempre confirmadas</b> via <font face="Mono">useConfirm</font> (excluir cliente, atividade, status; cancelar atividade).'])

# ============ 4 ============
H1('4. Banco de dados')
P('SQLite com chaves estrangeiras ativas e modo WAL. O esquema é criado automaticamente (CREATE TABLE IF NOT EXISTS) na primeira execução, junto com os dados padrão (status, tipos de treinamento, categorias, configurações e administrador).')
d = Drawing(585, 124)
box(d, 0, 84, 120, 34, 'users', 'nome · e-mail · papel · ativo')
box(d, 0, 6, 120, 52, 'statuses', 'escopo · nome\ncategoria (kind)\ncor · posição')
box(d, 170, 80, 150, 40, 'clients', 'dados cadastrais · status\nresponsável · favorito')
box(d, 170, 6, 150, 62, 'activities', 'tipo · cliente · status · data\nhoras · prioridade · resp.\ncampos por tipo · conclusão')
box(d, 370, 92, 110, 26, 'history_events', 'linha do tempo')
box(d, 370, 54, 110, 26, 'checklist_items', 'itens da tarefa')
box(d, 370, 14, 110, 26, 'notifications', 'lembretes por usuário', fill='#fef1dc', stroke='#b45309')
box(d, 500, 92, 85, 26, 'training_types', '', fill='#e7f6ec', stroke='#15803d')
box(d, 500, 54, 85, 26, 'task_categories', '', fill='#e7f6ec', stroke='#15803d')
box(d, 500, 14, 85, 26, 'settings', 'saved_reports', fill='#e7f6ec', stroke='#15803d')
arrow(d, 120, 102, 170, 102); arrow(d, 120, 40, 170, 40); arrow(d, 120, 52, 170, 84); arrow(d, 245, 80, 245, 68)
arrow(d, 320, 106, 370, 106); arrow(d, 320, 60, 370, 66); arrow(d, 320, 30, 370, 26)
fit(d, 585, 124); story.append(d)
P('Setas indicam referências (chave estrangeira). training_types e task_categories são referenciadas por activities; settings e saved_reports são independentes.', 'note')
H2('Tabelas e campos principais')
TABLE([['Tabela', 'Campos principais', 'Relacionamentos / observações'],
 ['users', 'id, name, email (único), password_hash, role (admin|member), active', 'Responsável por clientes e atividades. Nunca excluídos: apenas desativados.'],
 ['statuses', 'id, scope (client|installation|training|followup|task|event), name, kind, color, position', 'Único por (scope, name). <b>kind</b> ∈ pending, scheduled, in_progress, attention, done, canceled. Ordem = colunas do Kanban.'],
 ['training_types', 'id, name (único), active', 'Referenciado por activities.training_type_id. Em uso → apenas desativa.'],
 ['task_categories', 'id, name (único), active', 'Referenciado por activities.category_id.'],
 ['clients', 'name, trade_name, contact_name, phone, whatsapp, email, address, city, notes, status_id, assignee_id, is_favorite, created_at', 'status_id → statuses; assignee_id → users. Datas de instalação/treinamento/acompanhamento são derivadas.'],
 ['activities', 'type, client_id, title, description, status_id, priority, assignee_id, date, start_time, end_time, location, notes; treinamento: training_type_id, content; acompanhamento: contact_reason, situation, problems, solutions, next_followup_date; tarefa: category_id; conclusão: completed_at, completed_date, completed_by, completion_note', 'client_id → clients (exclusão em cascata). Índices por (type, date), cliente, status, (responsável, data).'],
 ['checklist_items', 'activity_id, text, done, position', 'Exclusão em cascata com a atividade.'],
 ['history_events', 'client_id, activity_id, user_id, event_type, description, details (JSON), occurred_at', 'Registrada automaticamente em cadastro, agendamento, reagendamento, mudança de status, conclusão, cancelamento, exclusão e anotações.'],
 ['notifications', 'user_id, kind, title, message, activity_id, client_id, dedupe_key, read_at', 'UNIQUE(user_id, dedupe_key) garante que cada lembrete seja criado uma única vez.'],
 ['settings', 'key, value', 'Pares chave/valor: dias sem acompanhamento, antecedência de lembrete, duração padrão, empresa…'],
 ['saved_reports', 'title, period_from, period_to, generated_by, snapshot (JSON)', 'Relatórios salvos pelo usuário (resumo do momento).']], [26, 74, 70])
H2('Categorias de status (kind)')
TABLE([['kind', 'Significado', 'Efeito no sistema'],
 ['pending', 'Ainda não iniciado', 'Conta como pendente; pode ficar atrasado se tiver data vencida.'],
 ['scheduled', 'Data e horário definidos', 'Exige data. Entra em conflitos de horário e na agenda.'],
 ['in_progress', 'Em execução', 'Conta como aberto.'],
 ['attention', 'Precisa de retorno/atenção', 'Aberto; destaque em alertas.'],
 ['done', 'Concluído', 'Grava data/hora/usuário/observação; alimenta histórico e relatórios (realizado).'],
 ['canceled', 'Cancelado / inativo', 'Sai de conflitos, atrasos e da taxa de conclusão.']], [24, 50, 96])
H2('Regras de integridade')
B(['Um status em uso só pode ser excluído escolhendo outro status de substituição; sempre deve existir ao menos um status "Concluído" por módulo e ao menos um status por módulo.',
   'Conflito de horário: mesmo responsável, mesmo dia, intervalos que se sobrepõem (atividades concluídas/canceladas são ignoradas; horários adjacentes não conflitam). O usuário pode confirmar "agendar mesmo assim".',
   'Cliente duplicado (mesmo nome+cidade ou mesmo telefone/WhatsApp) gera aviso com opção de cadastrar mesmo assim.',
   'Excluir cliente remove suas atividades e histórico (com confirmação; apenas administrador).',
   'Reabrir uma atividade concluída limpa data/hora/usuário da conclusão.'])

# ============ 5 ============
H1('5. Funcionalidades')
H2('5.1 Dashboard')
P('Indicadores clicáveis (atrasadas, para hoje, clientes, concluídas na semana; instalações, treinamentos e acompanhamentos com pendentes/agendados/em andamento/concluídos), lista <b>Atrasados</b> em destaque vermelho, <b>Hoje</b> em ordem cronológica, <b>Próximos 7 dias</b> com filtro por tipo, <b>Alertas</b> (atraso, compromisso de hoje, instalação/treinamento próximo, cliente sem acompanhamento), clientes que precisam de acompanhamento (com botão "Agendar") e clientes importantes.')
H2('5.2 Clientes')
B(['Cadastro completo com máscara de telefone, validação de e-mail/telefone e detecção de duplicidade; cadastro rápido também dentro do formulário de atividades.',
   'Lista com busca, filtros (status, cidade, responsável, importantes), ordenação por coluna, paginação; tabela no desktop e cartões no celular.',
   '<b>Detalhe:</b> jornada (Cadastro → Instalação → Treinamento → Acompanhamentos → Conclusão), atividades em aberto, todas as atividades, dados, <b>observações rápidas</b> editáveis no local, histórico completo em linha do tempo, anotações no histórico, ligar/WhatsApp/e-mail e atalhos para criar atividades.',
   'Favoritos (★) aparecem na área de acesso rápido do dashboard.'])
H2('5.3 Kanbans (instalações, treinamentos, acompanhamentos, tarefas)')
B(['Colunas = status configurados. Arrastar e soltar altera o status automaticamente; mover para "Concluído" abre o diálogo de conclusão; para "Cancelado" pede confirmação; para "Agendado" sem data abre a edição.',
   'Card com cliente, data, horário, responsável, cidade, status, observações, prioridade (cor + texto), progresso do checklist e destaque de atrasado. Menu do card: mover para…, concluir, editar, excluir.',
   'No celular: abas de coluna + rolagem por coluna (scroll-snap) e menu "Mover para" (arrastar não é usado em toque).',
   'Filtros: busca, período (hoje, amanhã, esta semana, próxima semana, este mês, mês anterior, personalizado), situação (inclui "Atrasadas"), prioridade, cidade, responsável.'])
H2('5.4 Agendamento e conflitos')
P('Formulário único adaptado ao tipo: instalação (local pré-preenchido com o endereço do cliente), treinamento (tipo e conteúdo), acompanhamento (motivo, situação, problemas, soluções, próximo acompanhamento), tarefa (categoria, descrição, checklist), reunião/evento. O horário final é sugerido a partir da duração padrão. Ao salvar, a API valida e informa conflitos de horário com o detalhamento do compromisso existente.')
H2('5.5 Agenda central')
P('Visões <b>dia</b> e <b>semana</b> (grade horária com eventos sobrepostos lado a lado, linha do "agora" e faixa "sem hora"), e <b>mês</b> (chips no desktop, pontos coloridos no celular + lista do dia selecionado). Clicar em um evento abre os detalhes; clicar em um horário/dia vazio cria um evento. No celular a semana vira uma lista por dia. Filtros por tipo.')
H2('5.6 Hoje e Atrasados')
P('<b>Hoje:</b> tudo do dia em ordem cronológica, contadores (a fazer, concluídos, horário vencido) e concluídos recolhíveis. <b>Atrasados:</b> tudo que passou da data/horário e não foi concluído, agrupado por data, com filtros por tipo/cidade/responsável. O menu lateral exibe a quantidade de atrasados.')
H2('5.7 Conclusão e histórico')
P('Concluir registra automaticamente data, horário, usuário, status e observação. Para acompanhamentos é possível já informar o <b>próximo acompanhamento</b> (o sistema cria o próximo); após instalação/treinamento é possível agendar o primeiro acompanhamento. Tudo alimenta o histórico do cliente e os relatórios.')
H2('5.8 Notificações')
P('Sino com contador e painel: <i>Hoje</i>, <i>Em breve</i> (dentro da antecedência configurada), <i>Amanhã</i>, <i>Atrasado</i> e <i>Cliente sem acompanhamento</i>. Gerado no servidor a cada minuto, sem duplicidade. Notificações do navegador (Notification API) para itens novos enquanto o sistema está aberto, mediante permissão.')
H2('5.9 Pesquisa global')
P('Ctrl/⌘+K em qualquer tela. Pesquisa clientes (nome, fantasia, telefone, cidade, e-mail), atividades (título, cliente, cidade, responsável, status; também por tipo — "instalação" — e por data — "25/09") e histórico. Resultados agrupados, navegáveis por teclado.')
H2('5.10 Relatórios e produtividade')
B(['Período: dia, semana, mês ou personalizado, com navegação anterior/próximo; botão <b>Gerar relatório da semana</b>.',
   'Conteúdo: indicadores, resumo por tipo (total, concluídas, pendentes, agendadas, em andamento, canceladas, atrasadas), clientes (novos, atendidos, ativos, finalizados), tempo em atividades concluídas, lista de atividades e observações importantes.',
   'Exportação: <b>PDF</b> (cabeçalho, cartões-resumo, tabelas, paginação), <b>Excel</b> (abas Resumo, Atividades, Observações) e <b>CSV</b> (UTF-8 com BOM, separador ";" para abrir no Excel em português). Relatórios podem ser salvos.',
   'Produtividade: taxa de conclusão, concluídas por dia (barras), instalações/treinamentos/acompanhamentos por semana (barras empilhadas), atrasadas e tempo. Gráficos têm descrição acessível, tooltip e alternativa em tabela.',
   'Regra de período: atividades concluídas contam pela data de conclusão; as demais pela data prevista (ou de criação, se sem data).'])
H2('5.11 Configurações')
P('Dados pessoais e senha; usuários (criar, editar, papel, ativar/desativar); status por módulo (criar, editar, cor, categoria, reordenar, excluir com substituição); tipos de treinamento; categorias de tarefa; preferências (empresa, duração padrão, antecedência de lembretes, dias para alertar falta de acompanhamento, notificações do navegador).')
H2('5.12 Usuários e permissões')
TABLE([['Ação', 'Administrador', 'Colaborador'],
 ['Ver/editar atividades', 'Todas', 'Somente as atribuídas a ele (outras retornam 403)'],
 ['Clientes', 'Ver, criar, editar, excluir', 'Ver, criar, editar (sem excluir)'],
 ['Status, tipos, categorias, usuários, configurações gerais', 'Sim', 'Não (somente leitura das listas)'],
 ['Dashboard e relatórios', 'Visão completa', 'Somente suas atividades']], [62, 50, 58])
H2('5.13 Interface, acessibilidade e responsividade')
B(['Visual SaaS/CRM: sidebar, cards, badges, modo escuro automático (prefers-color-scheme), microanimações discretas (desligadas com prefers-reduced-motion).',
   'Status e prioridade sempre com <b>ícone + texto + cor</b>. Foco visível, modais com foco preso, rótulos ARIA, tabelas com aria-sort.',
   'Desktop: sidebar fixa. Tablet: grades reflow. Celular: menu em gaveta, barra inferior com botão "+" central, modais em folha inferior, listas em cartões, Kanban por colunas, agenda em lista.',
   'Estados vazios com ação ("Nenhuma instalação encontrada. + Nova instalação"), skeletons de carregamento, toasts de sucesso/erro e mensagens de validação claras.'])

# ============ 6 ============
H1('6. Fluxos do usuário')
H2('Fluxo principal de um cliente')
CODE("""Cliente cadastrado
  └─► Instalação (Pendente → Agendada → Em andamento → Concluída)
        └─► Treinamento (Pendente → Agendado → Em andamento → Concluído)
              └─► Acompanhamento 1 (Acompanhar → Agendado → Em contato → Realizado)
                    └─► Acompanhamento 2 … n   (cada conclusão pode criar o próximo)
                          └─► Cliente "Finalizado"
Nenhuma etapa é obrigatória: qualquer atividade pode ser criada em qualquer ordem.""")
H2('Roteiros rápidos')
TABLE([['Objetivo', 'Passos'],
 ['Cadastrar cliente', '+ Novo → Cliente (ou página Clientes → Novo cliente) → nome obrigatório → Salvar. Abre o detalhe do cliente.'],
 ['Agendar instalação', 'Detalhe do cliente → + Instalação (ou Instalações → + Nova) → data e horário → Salvar. Se houver conflito, ajustar ou "Agendar mesmo assim".'],
 ['Alterar status', 'Arrastar o card no Kanban; ou menu ⋯ → Mover para; ou detalhe → Alterar status.'],
 ['Concluir', 'Botão Concluir (detalhe/menu) ou arrastar para a coluna Concluído → observação opcional → Concluir.'],
 ['Registrar acompanhamento', '+ Acompanhamento → preencher motivo/situação/problemas/soluções → Concluir informando o próximo acompanhamento.'],
 ['Ver o dia', 'Menu Hoje (cronológico) ou Agenda → Dia. Atrasados no menu lateral.'],
 ['Gerar relatório', 'Relatórios → Gerar relatório da semana (ou escolher período) → PDF / Excel / CSV.'],
 ['Encontrar algo', 'Ctrl+K → digitar nome, telefone, cidade, "instalação" ou "25/09".']], [38, 132])

# ============ 7 ============
H1('7. Instalação e execução local')
H2('Requisitos')
B(['Node.js 22.13 ou superior e npm 10+ (necessário para carregar .env e para o better-sqlite3 pré-compilado).', 'Nenhum banco de dados externo.'])
H2('Passo a passo')
CODE("""# 1) instalar dependências (raiz, servidor e cliente)
npm install          # instala concurrently na raiz
npm run setup        # instala server/ e client/

# 2) configurar variáveis de ambiente
cp server/.env.example server/.env      # edite os valores

# 3) (opcional) dados de demonstração
npm run seed:reset

# 4) desenvolvimento: API em :3333 e front em :5173 (proxy /api)
npm run dev
#   abra http://localhost:5173""")
H2('Scripts disponíveis')
TABLE([['Comando', 'O que faz'],
 ['npm run dev', 'API (tsx watch) + Vite com recarregamento automático.'],
 ['npm run build', 'Compila o front (client/dist) e o servidor (server/dist).'],
 ['npm start', 'Executa o servidor compilado; serve API e front na mesma porta.'],
 ['npm run seed', 'Insere dados de demonstração se o banco estiver sem clientes.'],
 ['npm run seed:reset', 'APAGA o banco e recria com dados de demonstração.'],
 ['npm test', 'Testes de integração da API (11 testes, banco em memória).'],
 ['npm run typecheck', 'Verificação de tipos do servidor e do cliente.']], [46, 124])

# ============ 8 ============
H1('8. Configuração (variáveis de ambiente)')
P('Arquivo <font face="Mono">server/.env</font> (modelo em <font face="Mono">.env.example</font>). Nunca versione o .env.')
TABLE([['Variável', 'Padrão', 'Descrição'],
 ['PORT', '3333', 'Porta HTTP.'],
 ['NODE_ENV', 'development', '"production" ativa validações rígidas (JWT_SECRET obrigatório) e cookie Secure.'],
 ['JWT_SECRET', '(dev)', '<b>Obrigatório em produção</b>, mínimo 24 caracteres aleatórios. Trocar invalida todas as sessões.'],
 ['DATABASE_PATH', './data/operis.db', 'Arquivo SQLite (a pasta é criada automaticamente).'],
 ['TZ', 'America/Sao_Paulo', 'Fuso usado para "hoje", atrasos e data de conclusão.'],
 ['CLIENT_ORIGIN', 'http://localhost:5173', 'Origem permitida no CORS (apenas desenvolvimento; em produção o front é servido pela própria API).'],
 ['ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD', 'Administrador / admin@operis.local / admin123', 'Administrador criado no primeiro start, apenas se não houver usuários.'],
 ['COOKIE_SECURE', 'true em produção', 'Defina "false" somente se ainda não usa HTTPS (ex.: teste em rede local).']], [46, 44, 80])
H2('Configurações dentro do sistema')
P('Em Configurações → Preferências: nome da empresa (relatórios), duração padrão, antecedência de lembretes, dias para alertar cliente sem acompanhamento e notificações do navegador. Status, tipos e categorias têm abas próprias.')

# ============ 9 ============
H1('9. Banco de dados: configuração e inicialização')
B(['O arquivo é criado em <font face="Mono">DATABASE_PATH</font> na primeira execução, com o esquema, status padrão, tipos de treinamento, categorias, configurações e o administrador inicial.',
   'Não há ferramenta de migração externa: o esquema usa <font face="Mono">CREATE TABLE IF NOT EXISTS</font>. Para alterações futuras, veja a seção de manutenção.',
   '<b>Backup:</b> com o servidor parado, copie <font face="Mono">operis.db</font> (e os arquivos -wal/-shm, se existirem). Com o servidor ativo use <font face="Mono">sqlite3 operis.db ".backup backup.db"</font>. Agende cópias diárias.',
   '<b>Restaurar:</b> pare o servidor, substitua o arquivo e inicie novamente.',
   '<b>Reset de demonstração:</b> <font face="Mono">npm run seed:reset</font> (apaga tudo).'])

# ============ 10 ============
H1('10. Deploy (produção)')
H2('Opção A — servidor próprio / VPS')
CODE("""git clone <repositorio> operis && cd operis
npm install && npm run setup
cp server/.env.example server/.env   # defina NODE_ENV=production, JWT_SECRET forte, ADMIN_*, DATABASE_PATH
npm run build
NODE_ENV=production npm start        # ou use PM2/systemd:
#   pm2 start "npm start" --name operis && pm2 save""")
P('Coloque um proxy reverso com HTTPS (Nginx, Caddy ou Traefik) apontando para a porta 3333. Exemplo com Caddy: <font face="Mono">operis.seudominio.com { reverse_proxy localhost:3333 }</font>. Com HTTPS o cookie de sessão é marcado como Secure automaticamente.')
H2('Opção B — Docker')
CODE("""# arquivo .env na raiz:  JWT_SECRET=...  ADMIN_PASSWORD=...  COOKIE_SECURE=true (atrás de HTTPS)
docker compose up -d --build
# dados persistem no volume "operis-data" (/data/operis.db)""")
H2('Lista de verificação de produção')
B(['JWT_SECRET longo e aleatório; senha do administrador trocada; HTTPS ativo.', 'Backup diário do arquivo do banco.', 'TZ correto para o fuso do negócio.', 'Limite de login já ativo (20 tentativas / 15 min em produção).',
   'Se a equipe crescer muito ou for necessário mais de um servidor, migrar para PostgreSQL (ver melhorias).'])

# ============ 11 ============
H1('11. Segurança')
TABLE([['Tema', 'Como é tratado'],
 ['Senhas', 'Hash bcrypt (custo 10); nunca retornadas pela API.'],
 ['Sessão', 'JWT em cookie httpOnly + SameSite=Lax (+ Secure em produção), 7 dias; o usuário é revalidado no banco a cada requisição (usuário desativado perde acesso na hora).'],
 ['Autorização', 'requireAuth em todas as rotas exceto login/health; requireAdmin nas ações administrativas; colaborador filtrado por responsável no nível do serviço.'],
 ['Entrada', 'Todos os corpos e consultas validados com zod; SQL sempre parametrizado (sem concatenar valores do usuário); limite de 200 KB por requisição.'],
 ['Cabeçalhos', 'helmet com CSP restritiva (scripts apenas do próprio domínio), x-powered-by desligado; CORS restrito à origem configurada.'],
 ['Força bruta', 'express-rate-limit no login.'],
 ['Erros', 'Resposta 500 genérica; detalhes apenas no log do servidor. Nenhum segredo é enviado ao front.'],
 ['Front', 'React escapa conteúdo por padrão; não há uso de innerHTML; token inacessível ao JavaScript.']], [30, 140])

# ============ 12 ============
H1('12. Testes')
H2('Testes de integração da API (npm test)')
P('11 testes com banco SQLite em memória e servidor real, cobrindo: autenticação; cliente (cadastrar, validar, duplicidade, visualizar, editar, excluir); instalação (criar, agendar, conflito, horário adjacente, forçar, status, concluir, histórico); Kanban (mudar/reabrir e status de outro módulo); acompanhamento com próximo acompanhamento; agenda e filtros de data/atrasados; tarefa com checklist; status personalizados (criar, duplicado, exclusão em uso com substituição, proteção do último "Concluído"); relatórios e exportação PDF/XLSX/CSV; dashboard, busca e notificações; permissões de colaborador.')
H2('Roteiro E2E em navegador real (Playwright/Chromium)')
P('Executado contra o sistema em execução, com banco de demonstração: login inválido e válido; validação de campos; cadastro de cliente e redirecionamento; histórico; agendamento com horário final sugerido; <b>detecção de conflito</b> e "agendar mesmo assim"; <b>arrastar e soltar</b> entre colunas; conclusão via Kanban com observação; menu "Mover para"; checklist; busca global agrupada; criação/edição/exclusão de evento pela agenda (com confirmação); download de PDF e Excel; salvar relatório; gráficos de produtividade; criação de status e tipo de treinamento; exclusão de cliente com confirmação. Resultado: <b>24 verificações aprovadas</b>, sem erros de JavaScript.')
H2('Responsividade')
P('Capturas e verificação automática de estouro horizontal em 1440×900 (desktop), 820×1100 (tablet) e 390×844 (celular) para todas as 13 rotas: nenhum estouro; menu em gaveta, barra inferior, formulários em folha inferior e Kanban por colunas validados visualmente.')
H2('Como testar manualmente após mudanças')
B(['<font face="Mono">npm run typecheck</font> e <font face="Mono">npm test</font>.', 'Rodar <font face="Mono">npm run seed:reset && npm run dev</font> e percorrer: criar cliente → instalação → arrastar → concluir → relatório.', 'Redimensionar a janela (ou usar o modo dispositivo do navegador) para 390 px.'])

# ============ 13 ============
H1('13. Referência da API')
P('Base: <font face="Mono">/api</font>. Autenticação por cookie. Erros: <font face="Mono">{ "error": "mensagem", "code": "CODIGO", "fields": { "campo": "mensagem" } }</font>. Códigos úteis: VALIDATION, DUPLICATE_CLIENT, SCHEDULE_CONFLICT (409; reenviar com <font face="Mono">force: true</font> para confirmar), STATUS_IN_USE (409; reenviar com <font face="Mono">?replace_with=ID</font>).')
TABLE([['Método e rota', 'Descrição'],
 ['POST /auth/login · POST /auth/logout · GET/PUT /auth/me', 'Sessão e dados pessoais (troca de senha exige senha atual).'],
 ['GET /dashboard', 'Indicadores, listas do dia/atrasados/próximos, alertas, favoritos.'],
 ['GET /search?q=', 'Clientes, atividades e histórico.'],
 ['GET/POST /clients · GET/PUT/DELETE /clients/:id', 'CRUD (filtros q, status_id, city, assignee_id, favorite, sort, order, page). Detalhe inclui atividades e histórico. DELETE só admin.'],
 ['PATCH /clients/:id/favorite · POST /clients/:id/notes · GET /clients/cities', 'Favorito, anotação no histórico, lista de cidades.'],
 ['GET/POST /activities · GET/PUT/DELETE /activities/:id', 'CRUD. Filtros: type, status_id, kind, client_id, assignee_id, city, priority, range (today|tomorrow|week|next_week|month|last_month|custom), from, to, q, overdue, sort.'],
 ['PATCH /activities/:id/status · POST /activities/:id/complete', 'Mudar status (Kanban) e concluir (nota, próximo acompanhamento, status de conclusão).'],
 ['PATCH /checklist/:itemId · POST /activities/check-conflicts', 'Marcar item; consultar conflitos de horário.'],
 ['GET/POST/PUT/DELETE /statuses · PUT /statuses/reorder', 'Status por módulo (escrita apenas admin).'],
 ['/training-types · /task-categories', 'CRUD de apoio (escrita admin). Em uso: desativa em vez de excluir.'],
 ['GET/POST/PUT /users · GET/PUT /settings', 'Usuários e configurações (escrita admin).'],
 ['GET /notifications · POST /notifications/read-all · POST /notifications/:id/read', 'Central de notificações.'],
 ['GET /reports · POST /reports/save · GET /reports/saved · GET /reports/export/(pdf|xlsx|csv)', 'Relatório por período (range/from/to) e exportações.']], [72, 98])

# ============ 14 ============
H1('14. Manutenção e evolução do código')
H2('Como fazer mudanças comuns')
TABLE([['Mudança', 'Onde mexer'],
 ['Novo campo em cliente', 'schema.ts (coluna) → validation/schemas.ts (clientSchema) → services/clients.ts (lista F e SELECT) → types/index.ts → ClientForm.tsx e ClientDetailPage.tsx.'],
 ['Novo campo em atividade', 'schema.ts → COLS em services/activities.ts → activitySchema → types/index.ts (Activity) → ActivityForm.tsx / ActivityDetail.tsx.'],
 ['Novo tipo de atividade', 'CHECK de type em schema.ts, ActivityType em types (server e client), ACTIVITY_META em constants.ts, scopeOf, status padrão em DEFAULT_STATUSES; para Kanban próprio, rota em KANBAN_ROUTES e item no menu.'],
 ['Novo status padrão', 'DEFAULT_STATUSES em db/schema.ts (só vale para bancos novos; em bancos existentes use Configurações → Status).'],
 ['Nova regra de negócio', 'Sempre em services/ (nunca em rotas ou componentes); cobrir em test/api.test.ts.'],
 ['Novo relatório/exportação', 'services/reports.ts (dados) + reports/ (formato).'],
 ['Nova tela', 'pages/ + rota em App.tsx + item em AppLayout (NAV); reutilize components/ui e ActivityModals.']], [42, 128])
H2('Alterações de esquema (migrações)')
P('O esquema atual é criado por <font face="Mono">CREATE TABLE IF NOT EXISTS</font>, que não altera tabelas existentes. Para evoluir um banco já em uso: (1) faça backup; (2) adicione a coluna ao schema.ts (para bancos novos); (3) aplique um <font face="Mono">ALTER TABLE ... ADD COLUMN</font> no startup de db/connection.ts protegido por verificação (<font face="Mono">PRAGMA table_info</font>) ou adote uma tabela <font face="Mono">schema_migrations</font> com scripts numerados. Recomenda-se adotar migrações numeradas antes da primeira mudança de esquema em produção.')
H2('Convenções')
B(['TypeScript estrito; sem <font face="Mono">any</font> desnecessário nas telas; SQL parametrizado.', 'Mensagens ao usuário em português claro; mensagens de erro de validação definidas no zod.', 'Um componente = uma responsabilidade; lógica compartilhada em hooks/serviços.', 'Datas: strings ISO (AAAA-MM-DD) e HH:MM trafegam entre camadas; formatação BR apenas na exibição.', 'Não altere status "kind" existentes sem revisar relatórios (services/reports.ts) e alertas (dashboard/notifications).'])
H2('Limitações conhecidas')
B(['SQLite: uma única instância do servidor (adequado para uma equipe pequena).', 'Notificações do navegador funcionam com o sistema aberto (não há push em segundo plano).', 'A ordem dos cards dentro de uma coluna é automática (prioridade, depois data); não há ordenação manual.', 'Lista de clientes no seletor de atividades carrega os 200 primeiros por nome (suficiente para o uso atual; trocar por busca assíncrona se crescer).', 'Sem migrações versionadas de banco (ver acima).'])

# ============ 15 ============
H1('15. Melhorias futuras')
B(['<b>WhatsApp:</b> botão já abre conversa (wa.me); evoluir para envio automático de lembretes/confirmações via API oficial (o gerador de notificações em services/notifications.ts é o ponto de extensão).',
   '<b>Google Calendar:</b> sincronização bidirecional de atividades com data/hora (cada atividade já tem início/fim e local).',
   '<b>Notificações push / PWA:</b> service worker + Web Push; manifesto para instalar como app no celular; modo offline básico.',
   '<b>Aplicativo mobile:</b> a API REST já é independente do front; um app nativo/React Native pode reutilizar tudo.',
   '<b>IA:</b> resumos automáticos do histórico do cliente, sugestão de próximos acompanhamentos e texto do relatório semanal.',
   '<b>Multiempresa:</b> adicionar <font face="Mono">organization_id</font> às tabelas e filtrar nos serviços (o acesso a dados já está centralizado).',
   '<b>Permissões avançadas:</b> papéis adicionais e permissões por módulo (hoje admin/colaborador, aplicados em requireAdmin e no filtro de responsável).',
   '<b>Dashboard avançado:</b> metas, comparativos entre períodos, funil de clientes, tempo médio entre etapas.',
   '<b>Ordenação manual dos cards</b>, ações em lote, anexos (fotos/termos de instalação), assinatura digital do cliente, campos personalizados.',
   '<b>Infra:</b> migrações versionadas, PostgreSQL, logs estruturados, testes de componentes (Vitest) e E2E no CI, auditoria de acesso.'])
H2('Encerramento')
P('O projeto foi entregue com revisão completa: tipagem estrita sem erros, testes automatizados aprovados, roteiro E2E sem erros de console, verificação de responsividade nos três tamanhos e build de produção validado. Este documento deve ser atualizado junto com mudanças de arquitetura ou de banco.')

doc = Doc(os.path.join(os.path.dirname(__file__), 'Operis_Documentacao.pdf'))
doc.multiBuild(story)
print('ok')
