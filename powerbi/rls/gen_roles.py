# Gera rls/perfis-rls.tmdl — perfis de segurança em nível de linha (RLS) por segmento.
# Tabela "liberada" = sem filtro; "bloqueada" = FALSE() (o perfil não vê nenhuma linha).
import os
GUSA = ['FERRO GUSA', 'FERRO GUSA-FORMATO IRREGULAR']
MIN  = ['MINERIO DE FERRO', 'MINERIO DE FERRO HT-15']
NAO_COPROD = ['CARVAO, VEGETAL, GRNL'] + GUSA + MIN
lst = lambda xs: '{ ' + ', '.join(f'"{x}"' for x in xs) + ' }'
PRODUTOS = ['f_MetaPV', 'f_Volumetria']                       # pedidos e NFs de venda
CARVAO   = ['f_basePlan', 'f_MetaCarvao', 'f_PlanPCPCarvao', 'f_Estoque_VS']
MP       = ['f_MetaPC', 'f_tickets', 'd_estoque_MP']
GUSA_EST = ['f_Estoque_Gusa']
PORTO    = ['f_Estoque_porto', 'f_Proximos_embarques']        # minério no porto
TODAS = PRODUTOS + CARVAO + MP + GUSA_EST + PORTO
PERFIS = [
  ('Ferro Gusa', {'f_MetaPV': f'f_MetaPV[Item] IN {lst(GUSA)}'}, PRODUTOS + GUSA_EST),
  ('Minério de Ferro', {'f_MetaPV': f'f_MetaPV[Item] IN {lst(MIN)}'}, PRODUTOS + PORTO),
  ('Co Produtos', {'f_MetaPV': f'NOT ( f_MetaPV[Item] IN {lst(NAO_COPROD)} )'}, PRODUTOS),
  ('Carvão', {}, CARVAO),
  # Matéria Prima: o recebimento de minério vem das NFs de expedição para os clientes VS RRP / VS CMG
  ('Matéria Prima', {'f_MetaPV': 'f_MetaPV[Cliente] IN { "VS RRP", "VS CMG" }'}, MP + PRODUTOS),
]
L = ['createOrReplace', '']
for nome, filtros, liberadas in PERFIS:
    L += [f"\trole '{nome}'", '\t\tmodelPermission: read', '']
    for t in TODAS:
        if t in filtros: L += [f'\t\ttablePermission {t} = {filtros[t]}', '']
        elif t not in liberadas: L += [f'\t\ttablePermission {t} = FALSE()', '']
L += ["\trole 'Gestão (todos os segmentos)'", '\t\tmodelPermission: read', '']
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'perfis-rls.tmdl'), 'w').write('\n'.join(L).rstrip() + '\n')
print('ok', len(PERFIS) + 1, 'perfis')
