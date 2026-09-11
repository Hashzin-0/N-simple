import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { UserDocumentSource } from '@/lib/userDocuments';

export type ArticleMode = 'padrao' | 'aprofundado';

interface BuildPromptArgs {
  theme: string;
  sourcesContext: string;
  userDocsSection: string;
  customTopicsSection: string;
  generatedAt: string;
}

const JSON_SCHEMA_EXAMPLE = `{
  "theme": "TEMA",
  "title": "TÍTULO EM CAIXA ALTA",
  "subtitle": "Subtítulo se houver",
  "titleEn": "English Title",
  "authors": [
    { "name": "SOBRENOME, Nome", "titulation": "Dr. em ...", "affiliation": "Universidade/Instituição", "email": "email@instituicao.br" }
  ],
  "resumo": "Resumo em parágrafo único com objetivo, metodologia e conclusões...",
  "palavrasChave": ["termo1", "termo2", "termo3"],
  "abstractEn": "Abstract...",
  "keywordsEn": ["term1", "term2", "term3"],
  "introducao": "Texto da introdução...",
  "metodologia": "Texto da metodologia...",
  "topicosDesenvolvimento": [
    {
      "number": "3.1",
      "title": "Título do Tópico",
      "content": "Conteúdo com citações...",
      "fontesConsultadas": [
        {
          "citationABNT": "Citação ABNT copiada EXATAMENTE do campo 'CITAÇÃO ABNT' da fonte",
          "authors": "Autores",
          "year": 2023,
          "title": "Título",
          "repository": "Nome do Repositório",
          "contribution": "Como esta fonte contribuiu para o tópico",
          "directUrl": "URL direta para acessar o documento"
        }
      ]
    }
  ],
  "analiseComparativaDireta": [
    {
      "praticaSuperadaOuTradicional": "Prática antiga",
      "praticaContemporaneaRecomendada": "Prática moderna",
      "parametroComparado": "Parâmetro",
      "impactoAgroeconomico": "Impacto",
      "evidenciaCientifica": "Autores (ano)"
    }
  ],
  "consideracoesFinais": "Texto das considerações finais...",
  "referenciasABNT": ["Referência 1 ABNT", "Referência 2 ABNT"],
  "generatedAt": "${'{generatedAt}'}"
}`;

function buildPromptPadrao(args: BuildPromptArgs): string {
  const { theme, sourcesContext, userDocsSection, customTopicsSection, generatedAt } = args;

  return `Você é um pesquisador agronômico sênior, doutor em Ciência do Solo e Fitotecnia.

TAREFA: Gerar um artigo científico completo nas normas ABNT (NBR 6022, NBR 6028, NBR 6023) sobre:
"${theme}"

${userDocsSection}

FONTES CIENTÍFICAS REAIS ENCONTRADAS PESQUISANDO EM GOOGLE ACADEMICO, EMBRAPA, SCIELO, CAPES, BDTD:
${sourcesContext || 'Nenhuma fonte encontrada nos repositórios. Use conhecimento técnico agronômico consolidado.'}

${customTopicsSection}

REGRAS OBRIGATÓRIAS:
1. DOCUMENTOS DO USUÁRIO têm PRIORIDADE MÁXIMA. Se um documento do usuário contém conteúdo relevante para um tópico, cite-o OBRIGATORIAMENTE como fonte principal. Use o campo "Citação ABNT" fornecido.
2. USE EXCLUSIVAMENTE as fontes listadas acima (documentos do usuário + fontes dos repositórios). CADA fonte já contém a CITAÇÃO ABNT pronta. Copie e use EXATAMENTE essa citação nas referências. NÃO INVENTE autores, periódicos ou dados.
3. CADA tópico deve citar no MÍNIMO 3 e no MÁXIMO 10 fontes reais em "fontesConsultadas". Priorize documentos do usuário quando disponíveis para o tópico.
4. O campo "referenciasABNT" DEVE conter TODAS as citações ABNT das fontes utilizadas no artigo, copiadas do campo "CITAÇÃO ABNT" fornecido. Ordene alfabeticamente por sobrenome do primeiro autor.
5. Para cada fonte citada, inclua no campo "contribution" uma descrição de como aquela fonte contribuiu para o tópico.
6. O artigo DEVE conter: título em CAIXA ALTA, 2 autores acadêmicos, resumo (NBR 6028), abstract em inglês, introdução, metodologia, desenvolvimento com tópicos numerados, considerações finais e referências ABNT NBR 6023.
7. NÃO use a expressão "cruzamento de dados". Use: "revisão sistemática", "síntese de evidências".
8. Cada parágrafo de conteúdo DEVE ter no mínimo 4 a 6 linhas de texto corrido. NÃO resuma em uma frase. Desenvolva cada ideia com profundidade, explicando conceitos, trazendo contexto e sustentando com citações.
9. Ao citar uma fonte, explique QUAL é a contribuição específica daquele estudo — não apenas "conforme os autores", mas o que exatamente o estudo demonstrou, qual metodologia usou e qual foi o achado principal.
10. Formato de saída: APENAS JSON válido (sem markdown) com esta estrutura exata:

${JSON_SCHEMA_EXAMPLE.replace('{generatedAt}', generatedAt)}`;
}

function buildPromptAprofundado(args: BuildPromptArgs): string {
  const { theme, sourcesContext, userDocsSection, customTopicsSection, generatedAt } = args;

  return `Você é um pesquisador agronômico sênior, doutor em Ciência do Solo e Fitotecnia, com experiência em publicação em periódicos de alto impacto (Nature Sustainability, Agricultural Systems, Field Crops Research, Scientia Agricola).

═══════════════════════════════════════════════════════════════
TAREFA: Gerar um ARTIGO CIENTÍFICO APROFUNDADO e EXTENSO nas normas ABNT (NBR 6022, NBR 6028, NBR 6023) sobre:
"${theme}"
═══════════════════════════════════════════════════════════════

${userDocsSection}

FONTES CIENTÍFICAS REAIS ENCONTRADAS PESQUISANDO EM GOOGLE ACADEMICO, EMBRAPA, SCIELO, CAPES, BDTD:
${sourcesContext || 'Nenhuma fonte encontrada nos repositórios. Use conhecimento técnico agronômico consolidado.'}

${customTopicsSection}

═══════════════════════════════════════════════════════════════
BLOCO A — HONESTIDADE INTELECTUAL E PROIBIÇÃO DE ALUCINAÇÃO
═══════════════════════════════════════════════════════════════

REGRA PRIMÁRIA — ANTI-ALUCINAÇÃO (acima de todas as outras):
Se qualquer requisito abaixo não puder ser atendido por falta de evidências confiáveis no material fornecido, o modelo DEVE declarar explicitamente a limitação no texto. É ABSOLUTAMENTE PROIBIDO:
- Inventar números, preços, custos, percentuais, produtividades ou qualquer dado quantitativo
- Estimar valores "aparentemente plausíveis" sem indicação de que são estimativas
- Apresentar como fato confirmado algo que não tenha sido encontrado em fonte verificável
- Assumir dados "do zero" para preencher lacunas
- Criar experimentos, propriedades ou estudos fictícios
Se precisar de informações adicionais para responder um requisito, declare o que falta — mas NUNCA crie dados. A ausência de evidência é melhor que evidência fabricada.

REGRAS DE INTEGRIDADE (41-45):

41. Não fabricar evidências. Se não encontrar estudo, dado, preço ou experimento real, declarar explicitamente a ausência. Nunca transformar ausência em dado.

42. Não transformar correlação em causalidade. Distinguir claramente entre associação estatística e relação causal. Quando um estudo demonstrar apenas correlação, afirmar: "estudo observacional identificou associação entre X e Y", e nunca "X causa Y" sem evidência experimental de mecanismo.

43. Não escolher somente estudos favoráveis. Procurar deliberadamente resultados contrários, falhas, limitações e casos em que a tecnologia não funcionou. O artigo deve ser equilibrado, não um panfleto a favor de uma prática.

44. Separar fato, interpretação e hipótese. O leitor precisa saber o que foi efetivamente observado (fato), o que o pesquisador concluiu (interpretação), e o que é inferência do próprio artigo (hipótese). Formato: "O estudo observou que... Os autores interpretaram que... Nossa análise sugere que..."

45. Confrontar números antigos e atuais em valores comparáveis. Quando comparar custos de 2010 com 2026, NÃO colocar simplesmente R$ 100 vs. R$ 300. Considerar inflação (IPCA), unidade de medida, produtividade da época, poder de compra, preços reais e condições econômicas vigentes.

═══════════════════════════════════════════════════════════════
BLOCO B — PROFUNDIDADE E CONTINUIDADE DO TEXTO
═══════════════════════════════════════════════════════════════

1. Parágrafos extensos e desenvolvimento aprofundado — cada parágrafo deve possuir, preferencialmente, 8–12 linhas ou mais, evitando frases soltas, explicações superficiais ou sucessões de pequenos parágrafos. Cada ideia deve ser desenvolvida de forma completa, conectando conceito → mecanismo → evidência → aplicação prática → consequência, sempre que pertinente. O texto deve apresentar continuidade lógica entre os parágrafos, aprofundando progressivamente o assunto em vez de apenas enumerar informações.

16. Dados brutos → interpretação — sempre que possível, apresentar os números antes da conclusão, permitindo que o leitor veja de onde surgiu a interpretação. Formato: "O experimento registrou produtividade de 5.800 kg/ha no tratamento A vs. 4.200 kg/ha no controle, uma diferença de 1.600 kg/ha (38%). Essa diferença sugere que..."

40. Confronto teoria × realidade × economia — para cada conceito importante, estabelecer o confronto entre: o que a teoria prevê → o que o experimento encontrou → o que acontece na propriedade → se financeiramente compensa. Essa sequência deve permear todo o artigo.

═══════════════════════════════════════════════════════════════
BLOCO C — CONTRAPONTO TEMPORAL E EVOLUÇÃO HISTÓRICA
═══════════════════════════════════════════════════════════════

2. Contraponto temporal e evolução histórica — sempre que houver dados disponíveis, comparar informações de 10–20 anos atrás com dados atuais, demonstrando como o cenário evoluiu ao longo do tempo. A comparação deve considerar não apenas valores absolutos, mas também inflação, produtividade, área cultivada, preços reais, tecnologia disponível, custos de produção, demanda, condições econômicas e mudanças no sistema produtivo, quando aplicável. Após apresentar os dados históricos e atuais, realizar uma análise crítica das causas das mudanças, identificando tendências, avanços, retrocessos e possíveis consequências futuras.

═══════════════════════════════════════════════════════════════
BLOCO D — CONFRONTO DE EVIDÊNCIAS E HIERARQUIIA
═══════════════════════════════════════════════════════════════

3. Estudos contraditórios e confronto de evidências — identificar e apresentar pelo menos 2–3 estudos científicos relevantes que apresentem resultados, interpretações ou conclusões divergentes, sempre que a literatura permitir. Explicar detalhadamente por que os resultados podem ter sido diferentes, considerando fatores como local, clima, solo, cultivar, metodologia, dose, época de aplicação, tamanho da amostra, delineamento experimental e condições econômicas. O texto não deve simplesmente escolher um estudo como "correto", mas realizar uma resolução argumentativa baseada na qualidade das evidências, indicando em quais condições cada conclusão parece ser válida e qual interpretação apresenta maior sustentação científica.

20. Hierarquia das evidências — distinguir claramente entre: opinião; relato de produtor; estudo observacional; experimento de campo; experimento controlado; revisão sistemática; meta-análise; dados oficiais. Ao citar cada estudo, indicar sua posição na hierarquia.

21. Qualidade e confiabilidade das fontes — classificar as evidências conforme sua robustez e priorizar artigos científicos, universidades, Embrapa, órgãos governamentais e bases estatísticas oficiais.

22. Incerteza dos dados — informar quando os valores são estimativas, médias, intervalos, projeções ou dados sujeitos a grande variação. Nunca apresentar estimativa como dado preciso.

23. Dados negativos — procurar deliberadamente experimentos em que a tecnologia não funcionou, não aumentou produtividade ou gerou prejuízo. O Gemini NÃO deve procurar apenas evidências que confirmem a hipótese.

24. Viés de seleção — verificar se determinado estudo ou caso pode estar mostrando apenas propriedades/condições excepcionais e não representar a realidade média.

25. Transferibilidade — responder: "Esse resultado obtido nesse experimento pode realmente ser aplicado a outras propriedades?" Justificar com base em clima, solo, escala, nível tecnológico e condições econômicas.

═══════════════════════════════════════════════════════════════
BLOCO E — EXEMPLOS REAIS, CASOS DOCUMENTADOS E ESCALONAMENTO
═══════════════════════════════════════════════════════════════

4. Exemplos reais × teoria científica × aplicação prática — para cada conceito importante, sempre que possível, estabelecer um confronto entre o que a teoria científica prevê, o que experimentos controlados demonstraram e o que ocorre efetivamente no campo ou em propriedades rurais reais. Utilizar casos documentados, experimentos de campo, propriedades rurais, sistemas produtivos, empresas, cooperativas ou situações reais como exemplos, evitando exemplos fictícios apresentados como fatos. Explicar quando a realidade confirma a teoria e, principalmente, quando apresenta resultados diferentes, investigando as razões dessa diferença e demonstrando as limitações da aplicação prática do modelo teórico.

38. Estudo de caso real — incluir pelo menos um caso documentado de propriedade, empresa, cooperativa, região ou projeto que tenha aplicado a prática. O caso deve conter dados específicos: localização, tamanho, sistema produtivo, período, resultados obtidos e lições aprendidas.

39. Escalonamento — verificar se o resultado obtido experimentalmente continua válido quando aplicado em escala comercial. Muitas técnicas funcionam em parcelas experimentais mas falham em escala de milhares de hectares.

═══════════════════════════════════════════════════════════════
BLOCO F — DADOS QUANTITATIVOS E ANÁLISE ECONÔMICO-PRODUTIVA
═══════════════════════════════════════════════════════════════

5. Dados quantitativos reais e análise econômico-produtiva — priorizar dados quantitativos, verificáveis e provenientes de fontes confiáveis, evitando afirmações exclusivamente qualitativas. Sempre que pertinente, apresentar números referentes a produtividade, doses, custos de insumos, custo operacional, investimento inicial, receita bruta, margem, lucro, preço de venda, ROI, ponto de equilíbrio, consumo de recursos, produtividade por hectare, eficiência, demanda e outros indicadores relevantes. Não apenas apresentar os números: realizar os cálculos e interpretar o que eles significam na prática, demonstrando quanto custa, quanto produz, quanto gera de receita, quanto sobra de margem e em quais condições a atividade ou tecnologia se torna economicamente viável ou inviável. Quando os valores variarem conforme região ou período, apresentar essa variação e explicar suas causas. APRESENTAR A UNIDADE DE CADA DADO E O PERÍODO DE REFERÊNCIA. Um custo de R$ 500/ha sem dizer em que ano, região, cultura e sistema de produção tem pouco valor científico.

11. Análise de sensibilidade — alterar os principais parâmetros (±20% no preço do fertilizante, ±15% no preço do produto, ±10% na produtividade, ±30% no combustível) e mostrar como isso modifica a conclusão econômica.

12. Cenários prospectivos — construir pelo menos três cenários: pessimista, provável e otimista, mostrando como a atividade/técnica poderia se comportar sob diferentes premissas.

13. Relação custo × benefício físico — não considerar apenas o lucro. Mostrar quanto de recurso adicional é necessário para obter cada unidade adicional de produção. Ex.: R$ investidos por kg adicional produzido.

14. Ponto de equilíbrio técnico e econômico — determinar quanto precisa ser produzido ou qual preço precisa ser alcançado para que a prática deixe de gerar prejuízo.

15. Eficiência marginal — analisar o momento em que cada unidade adicional de insumo deixa de compensar. Isso é especialmente interessante para fertilizantes, irrigação, ração, defensivos e mão de obra.

26. Análise de oportunidade perdida — não analisar apenas "quanto ganho fazendo X", mas também quanto deixo de ganhar se não fizer X.

27. Custo de oportunidade — comparar o uso daquele hectare, capital, mão de obra ou equipamento com alternativas possíveis.

28. Cadeia de valor — analisar onde o dinheiro é capturado ao longo da cadeia: produtor → armazenagem → indústria → atacado → varejo → consumidor.

29. Formação de preços — explicar os fatores que determinam o preço e como eles afetam a rentabilidade do produtor.

30. Sensibilidade à demanda — quando houver dados disponíveis, avaliar consumo, elasticidade, crescimento/retração do mercado e possíveis mudanças de comportamento.

31. Benchmarking — comparar o desempenho analisado com: média nacional; melhores produtores; média regional; sistemas alternativos; referências internacionais.

34. Trade-offs — mostrar quando melhorar um indicador piora outro. Ex.: maior produtividade × maior custo; maior produção × maior consumo de água; maior eficiência × maior investimento inicial.

35. Curva de resposta — quando aplicável, mostrar como produtividade/resposta varia conforme a dose ou intensidade do tratamento, identificando mínimo, ótimo técnico e ótimo econômico.

═══════════════════════════════════════════════════════════════
BLOCO G — ANÁLISE CIENTÍFICA, REGIONAL E ESTATÍSTICA
═══════════════════════════════════════════════════════════════

6. Análise de causalidade — não apenas afirmar que A está relacionado a B, mas explicar por que A pode causar B, quais mecanismos estão envolvidos e quais outras variáveis podem explicar o resultado.

7. Análise de condições e contexto — toda conclusão deve informar em quais condições ela é válida: tipo de solo, clima, região, cultivar, nível tecnológico, tamanho da propriedade, disponibilidade de água, preço dos insumos etc.

8. Análise de variáveis intervenientes — identificar fatores que podem alterar o resultado do experimento ou da prática, evitando conclusões simplistas. Ex.: uma mesma dose de N pode produzir resultados diferentes conforme matéria orgânica, chuva, cultivar e produtividade potencial.

9. Comparação entre regiões — comparar resultados entre diferentes regiões produtoras, especialmente Brasil × outros países e, quando possível, diferentes estados brasileiros.

10. Comparação por escala de produção — analisar se determinada técnica é economicamente viável para pequeno, médio e grande produtor, porque uma tecnologia rentável em 5.000 ha pode ser inviável em 20 ha.

17. Estatística experimental — quando houver experimento real, apresentar delineamento, tratamentos, repetições, média, variabilidade, significância estatística e, quando disponível, teste utilizado.

18. Tamanho do efeito — não se limitar a "houve diferença significativa". Mostrar quanto a diferença representa na prática e se ela é economicamente relevante.

19. Reprodutibilidade — verificar se resultados semelhantes foram encontrados por outros pesquisadores, em outros locais e anos.

32. Análise de ciclo completo — acompanhar o problema desde a entrada dos recursos até o resultado final, incluindo produção, pós-colheita, armazenamento, transporte, comercialização e consumo quando pertinente.

═══════════════════════════════════════════════════════════════
BLOCO H — SUSTENTABILIDADE, MEIO AMBIENTE E RECURSOS NATURAIS
═══════════════════════════════════════════════════════════════

46. Eficiência no uso de recursos, sustentabilidade ambiental e redução de custos — não avaliar uma prática exclusivamente pela capacidade de aumentar produtividade ou lucro imediato. Analisar também sua capacidade de reduzir o consumo e o desperdício de recursos naturais e produtivos: água, energia, combustíveis, fertilizantes, defensivos, corretivos, sementes, ração, solo, matéria orgânica e mão de obra. Quantificar, sempre que existirem dados confiáveis, a redução de consumo obtida e convertê-la em economia financeira por hectare, por unidade produzida e no sistema produtivo como um todo. Avaliar simultaneamente os efeitos sobre conservação do solo, qualidade e disponibilidade da água, biodiversidade, emissões de gases de efeito estufa, geração e aproveitamento de resíduos, ciclagem de nutrientes, recuperação de áreas degradadas e conservação dos recursos naturais. Demonstrar quando uma prática ambientalmente mais eficiente também proporciona redução de custos e maior eficiência econômica, mas identificar igualmente situações em que a sustentabilidade exige investimento inicial ou gera custos adicionais. Considerar a sustentabilidade em curto, médio e longo prazo, evitando classificar uma prática como sustentável apenas porque apresenta benefício econômico ou ambiental imediato.

47. Sustentabilidade integrada — ambiental, econômica e social — avaliar a sustentabilidade de forma multidimensional, considerando simultaneamente viabilidade econômica, conservação ambiental e benefícios sociais. Uma prática não deve ser considerada verdadeiramente sustentável apenas por reduzir custos ou impactos ambientais se for economicamente inviável ou gerar consequências sociais negativas.

51. Gestão de resíduos e economia circular — investigar a geração de resíduos durante a produção e as possibilidades de redução, reutilização, reciclagem, reaproveitamento ou transformação em novos insumos/produtos. Avaliar tanto o benefício ambiental quanto o potencial econômico dessas alternativas.

52. Conservação e qualidade do solo — quando pertinente, avaliar os efeitos da prática sobre estrutura, fertilidade, matéria orgânica, erosão, compactação, infiltração, retenção de água, atividade biológica e disponibilidade de nutrientes. Relacionar esses indicadores à produtividade e aos custos de produção.

53. Gestão e conservação da água — analisar o consumo, eficiência, disponibilidade, qualidade e reutilização da água, incluindo irrigação, perdas por evaporação, escorrimento e infiltração inadequada. Quando possível, calcular produtividade por unidade de água utilizada e o impacto econômico da redução do consumo.

54. Balanço energético e emissões — quando houver dados disponíveis, comparar a quantidade de energia e recursos utilizados para produzir determinado volume de produto e avaliar emissões de gases de efeito estufa, consumo de combustível, eletricidade e insumos de elevada demanda energética.

59. Sustentabilidade sem greenwashing — não classificar automaticamente uma prática como sustentável apenas porque utiliza termos como verde, ecológico, regenerativo, sustentável, orgânico ou de baixo carbono. Exigir evidências mensuráveis dos benefícios ambientais e comparar com eventuais impactos indiretos ou efeitos adversos.

60. Análise de ciclo de vida — sempre que tecnicamente possível, avaliar os impactos desde a produção/aquisição dos insumos até a produção, processamento, armazenamento, transporte e destino final, evitando concluir que uma prática é sustentável apenas porque melhora uma etapa isolada.

═══════════════════════════════════════════════════════════════
BLOCO I — GESTÃO, ADOÇÃO TECNOLÓGICA E RESILIÊNCIA
═══════════════════════════════════════════════════════════════

48. Gestão eficiente da propriedade rural — analisar como a prática estudada interfere na gestão operacional, financeira, produtiva e estratégica da propriedade, considerando planejamento, organização das atividades, controle de estoque, utilização de máquinas e equipamentos, mão de obra, calendário agrícola, fluxo de caixa, armazenamento, logística, compras e comercialização. Sempre que possível, demonstrar como a melhoria de gestão pode reduzir desperdícios, custos operacionais e riscos.

50. Uso racional de insumos e eficiência produtiva — avaliar se o aumento da produção realmente depende do aumento proporcional do uso de insumos. Investigar alternativas capazes de produzir mais com a mesma quantidade de recursos ou a mesma produção com menor quantidade de recursos, calculando indicadores de eficiência como produção por unidade de água, fertilizante, combustível, energia, área, mão de obra ou capital investido.

36. Análise de adoção tecnológica — explicar não apenas se uma tecnologia funciona, mas por que os produtores adotam ou não adotam aquela tecnologia.

37. Barreiras práticas — disponibilidade de máquinas, assistência técnica, crédito, mão de obra, infraestrutura, conhecimento, logística etc.

49. Gestão de riscos e resiliência do sistema produtivo — identificar riscos climáticos, ambientais, biológicos, econômicos, financeiros, mercadológicos, tecnológicos e regulatórios. Avaliar a capacidade do sistema de resistir a eventos adversos, recuperar-se de perdas e manter viabilidade. Comparar estratégias de prevenção, mitigação e adaptação.

═══════════════════════════════════════════════════════════════
BLOCO J — IMPACTO SOCIAL E CONDIÇÕES DE TRABALHO
═══════════════════════════════════════════════════════════════

55. Impacto social e condições de trabalho — analisar efeitos sobre geração e qualidade do emprego, segurança do trabalhador, necessidade de qualificação, mecanização, jornada, renda, agricultura familiar, sucessão rural e desenvolvimento das comunidades. Não tratar o trabalhador apenas como componente de custo, mas também como elemento do sistema produtivo.

═══════════════════════════════════════════════════════════════
BLOCO K — LEGISLAÇÃO, CONFORMIDADE E INCENTIVOS
═══════════════════════════════════════════════════════════════

56. Conformidade legal e regulatória — verificar a legislação brasileira aplicável, incluindo leis, decretos, instruções normativas, resoluções, normas técnicas, licenciamento, regras ambientais, trabalhistas, sanitárias, fundiárias, tributárias e de uso de insumos. Utilizar fontes oficiais e indicar qual norma está vigente, seu órgão responsável, sua aplicação prática e possíveis consequências do descumprimento.

57. Custo da conformidade × custo da não conformidade — comparar o investimento necessário para cumprir exigência legal ou ambiental com os possíveis custos decorrentes de seu descumprimento: multas, perdas produtivas, interdições, recuperação ambiental, processos, perda de mercado, restrições comerciais e danos à reputação.

58. Pagamento por serviços ambientais e incentivos — investigar a existência de programas públicos, crédito rural, incentivos econômicos, certificações, mercados diferenciados ou mecanismos de pagamento por serviços ambientais capazes de melhorar a viabilidade econômica de práticas sustentáveis.

═══════════════════════════════════════════════════════════════
BLOCO L — EXTERNALIDADES
═══════════════════════════════════════════════════════════════

33. Análise de externalidades — custos ou benefícios que não aparecem diretamente na conta do produtor, como degradação do solo, contaminação hídrica, geração de empregos, serviços ambientais, poluição do ar, impacto em comunidades vizinhas e externalidades positivas como polinização e controle biológico.

═══════════════════════════════════════════════════════════════
BLOCO N — ÉTICA, MORAL E RESPONSABILIDADE NO AGRONEGÓCIO
═══════════════════════════════════════════════════════════════

61. Ética profissional e responsabilidade técnica — avaliar as responsabilidades éticas dos profissionais envolvidos na atividade agropecuária, incluindo engenheiros-agrônomos, médicos-veterinários, zootecnistas, técnicos agrícolas, pesquisadores, consultores, gestores e responsáveis pela propriedade. Analisar a obrigação de tomar decisões fundamentadas em conhecimento técnico, evidências científicas e segurança, evitando recomendações motivadas exclusivamente por interesses comerciais. Avaliar também situações de conflito de interesses, negligência, omissão, pressão econômica e responsabilidade pelas consequências das decisões tomadas.

62. Ética ambiental e responsabilidade intergeracional — analisar se a utilização dos recursos naturais atende às necessidades atuais sem comprometer a capacidade das gerações futuras de produzir e viver adequadamente. Avaliar impactos sobre solo, água, biodiversidade, florestas, fauna, flora e clima, considerando não apenas o benefício econômico imediato, mas também os custos ambientais que podem surgir no médio e longo prazo.

63. Ética no uso dos recursos naturais — discutir os limites éticos da utilização de água, solo, recursos minerais, biodiversidade, florestas e outros recursos naturais na produção agropecuária. Avaliar quando o uso produtivo desses recursos pode ser considerado legítimo, responsável e proporcional ao benefício gerado, considerando situações de escassez, conflitos de uso e impactos sobre terceiros.

64. Ética e bem-estar animal — quando houver criação animal, avaliar as condições de alimentação, sanidade, alojamento, transporte, manejo, reprodução, abate e qualidade de vida. Confrontar produtividade e eficiência econômica com princípios de bem-estar animal, investigando se determinada prática reduz sofrimento desnecessário e se existem alternativas tecnicamente e economicamente viáveis.

65. Ética na pesquisa agropecuária — avaliar a integridade dos experimentos científicos, incluindo seleção de tratamentos, controles, metodologia, coleta de dados, análise estatística, publicação e interpretação dos resultados. Verificar riscos de fabricação, manipulação, omissão ou seleção tendenciosa de dados, além da necessidade de apresentar resultados negativos ou contraditórios.

66. Integridade e transparência científica — exigir que afirmações sejam acompanhadas por evidências verificáveis e que o grau de certeza seja compatível com a qualidade dos dados. Diferenciar claramente fato comprovado, resultado experimental, interpretação do pesquisador, hipótese, estimativa e opinião. Evitar apresentar correlações como causalidade ou resultados isolados como verdades universais.

67. Ética na divulgação de tecnologias e produtos — analisar se empresas, fabricantes, consultores ou profissionais apresentam benefícios e limitações de tecnologias agropecuárias de maneira equilibrada. Verificar possíveis exageros em propagandas, omissão de riscos, promessas de produtividade sem comprovação e utilização inadequada de resultados experimentais para promover produtos.

68. Conflitos de interesse — identificar possíveis conflitos entre interesse econômico, interesse científico, interesse profissional e interesse público. Quando uma pesquisa ou recomendação estiver vinculada a uma empresa que comercializa determinado produto, verificar se isso pode influenciar metodologia, interpretação, divulgação ou seleção das evidências.

69. Ética nas relações de trabalho rural — avaliar condições de trabalho, remuneração, segurança, dignidade, jornada, capacitação, exposição a riscos e respeito aos direitos dos trabalhadores. Analisar também os efeitos da mecanização e automação sobre o emprego e verificar se ganhos de eficiência estão sendo acompanhados de responsabilidade social.

70. Justiça social e distribuição dos benefícios — investigar quem ganha e quem assume os custos de determinada inovação ou modelo produtivo. Uma tecnologia pode aumentar a produtividade do setor, mas concentrar seus benefícios em grandes produtores enquanto pequenos produtores assumem custos ou perdem competitividade. Essa distribuição deve fazer parte da análise.

71. Ética e agricultura familiar — avaliar como mudanças tecnológicas, políticas agrícolas, exigências ambientais, certificações e transformações de mercado afetam agricultores familiares e pequenos produtores. Considerar capacidade de investimento, acesso ao crédito, assistência técnica, tecnologia e canais de comercialização.

72. Ética nas relações entre produtores e empresas — analisar relações comerciais envolvendo fornecedores de sementes, fertilizantes, defensivos, máquinas, crédito, compradores, frigoríficos, cooperativas e agroindústrias. Identificar assimetrias de informação e poder de negociação, contratos desfavoráveis, dependência tecnológica e possíveis práticas comerciais abusivas.

73. Ética e assimetria de informação — avaliar situações nas quais uma das partes possui informações significativamente superiores às demais. Investigar se informações sobre qualidade, riscos, preços, produtividade, composição de produtos, contratos ou condições de mercado são disponibilizadas de forma suficientemente clara para permitir decisões conscientes.

74. Ética na comercialização e formação de preços — discutir práticas relacionadas à negociação, classificação, pesagem, qualidade, contratos, armazenamento e comercialização dos produtos agropecuários. Avaliar situações de fraude, adulteração, manipulação de informações ou aproveitamento indevido da vulnerabilidade econômica de produtores ou consumidores.

75. Ética e segurança alimentar — avaliar se as práticas produtivas e comerciais contribuem para fornecer alimentos seguros, nutritivos e adequadamente rastreáveis. Considerar resíduos químicos, contaminantes, doenças, armazenamento, transporte, processamento e adulterações, equilibrando segurança do consumidor com viabilidade econômica da produção.

76. Ética perante o consumidor — analisar transparência na comunicação sobre origem, composição, qualidade, sustentabilidade, certificações, métodos de produção e características dos produtos. Verificar se alegações como "sustentável", "natural", "baixo carbono", "orgânico" ou "regenerativo" possuem fundamentação verificável.

77. Ética, rastreabilidade e responsabilidade na cadeia produtiva — avaliar a capacidade de identificar origem dos insumos, propriedade produtora, lote, processamento, transporte e destino do produto. Discutir como a rastreabilidade contribui para segurança alimentar, combate a fraudes, responsabilização e transparência.

78. Ética no uso de defensivos e medicamentos veterinários — analisar não apenas a legalidade do produto, mas a responsabilidade relacionada a dose, momento de aplicação, armazenamento, descarte, equipamentos de proteção, período de carência, resistência de organismos, contaminação ambiental e exposição de trabalhadores e consumidores.

79. Resistência antimicrobiana e responsabilidade na produção animal — quando pertinente, avaliar o uso de antibióticos na produção animal e seus impactos sobre resistência antimicrobiana. Confrontar produtividade, prevenção de doenças, bem-estar animal, necessidade terapêutica e riscos para a saúde pública.

80. Ética na genética e biotecnologia agropecuária — discutir questões relacionadas a OGMs, edição genética, melhoramento animal e vegetal, biotecnologia, propriedade intelectual e concentração tecnológica. Separar cuidadosamente riscos comprovados, riscos hipotéticos, benefícios demonstrados e questões éticas que permanecem em debate.

81. Ética e propriedade intelectual — avaliar questões relacionadas a sementes, cultivares, patentes, tecnologias, genética animal, softwares agrícolas e conhecimento tradicional, discutindo o equilíbrio entre remuneração pela inovação, acesso à tecnologia e direitos dos produtores.

82. Conhecimento tradicional e repartição de benefícios — quando houver utilização de recursos genéticos ou conhecimentos tradicionais, analisar questões relacionadas a apropriação indevida, reconhecimento das comunidades detentoras do conhecimento e repartição justa dos benefícios econômicos.

83. Ética no uso de dados e tecnologias digitais — analisar questões relacionadas à utilização de sensores, drones, satélites, máquinas conectadas, inteligência artificial, softwares de gestão e dados de propriedades rurais. Considerar propriedade dos dados, privacidade, transparência dos algoritmos, segurança e possibilidade de dependência tecnológica.

84. Responsabilidade pelo impacto sobre terceiros — avaliar externalidades causadas pela produção que atingem pessoas que não participaram diretamente da decisão, como deriva de produtos, contaminação de água, emissão de odores, poeira, ruídos, erosão, queimadas, trânsito de máquinas e impactos sobre propriedades vizinhas.

85. Ética nas relações com comunidades rurais — analisar como empreendimentos agropecuários afetam comunidades próximas, considerando emprego, infraestrutura, recursos hídricos, deslocamento populacional, conflitos territoriais, qualidade de vida e desenvolvimento regional.

86. Dilemas éticos e trade-offs — apresentar situações em que não existe uma solução perfeita. Confrontar explicitamente os diferentes interesses envolvidos, por exemplo: maior produtividade × conservação ambiental; mecanização × emprego; controle de pragas × biodiversidade; produção animal × bem-estar; expansão agrícola × conservação; redução de custos × segurança do trabalhador.

87. Legalidade × moralidade × responsabilidade — distinguir três dimensões diferentes da decisão: o que é legalmente permitido, o que é moralmente aceitável e o que é profissionalmente responsável. Não considerar automaticamente que uma prática legal seja necessariamente ética ou sustentável, nem que uma prática inovadora seja necessariamente moralmente justificável.

88. Princípio da precaução — quando houver riscos potencialmente graves ou irreversíveis e incerteza científica significativa, analisar se é justificável adotar medidas preventivas antes de existir certeza absoluta sobre o dano. Apresentar os argumentos favoráveis e contrários e avaliar proporcionalidade entre risco, benefício e custo.

89. Responsabilidade pelas consequências não intencionais — investigar efeitos secundários ou inesperados de tecnologias e práticas agropecuárias. Uma intervenção pode solucionar um problema e criar outro; portanto, o estudo deve procurar deliberadamente efeitos indiretos, efeitos cumulativos e consequências de longo prazo.

90. Ética das decisões econômicas — analisar até que ponto a busca legítima por redução de custos, produtividade e lucro pode justificar determinadas decisões. Identificar situações em que a economia obtida ocorre às custas da segurança do trabalhador, do bem-estar animal, da conservação ambiental ou da qualidade do produto.

91. Análise ética sem julgamento simplista — não classificar automaticamente uma prática como "ética", "antiética", "boa" ou "má". Apresentar os diferentes princípios, interesses, consequências e argumentos envolvidos, distinguindo evidências objetivas de juízos de valor. Quando houver posições conflitantes, apresentar os argumentos de cada lado, identificar seus fundamentos e realizar uma conclusão crítica e fundamentada. Exemplo de aplicação: ao analisar mecanização, não basta dizer "é positiva porque aumenta produtividade". Deve-se analisar: produtividade ↑ → custo operacional ↓ → necessidade de mão de obra ↓ → possível aumento da renda → possível redução de empregos rurais → maior exigência de qualificação → risco de exclusão de pequenos produtores → necessidade de investimento elevado → maiores eficiências → possíveis impactos ambientais → conclusão sobre em quais condições a mecanização é técnica, econômica, ambiental e socialmente justificável.

═══════════════════════════════════════════════════════════════
BLOCO O — RESTRIÇÕES, BOAS PRÁTICAS E CONDIÇÕES DE APLICAÇÃO
═══════════════════════════════════════════════════════════════

92. Restrições técnicas e agronômicas — identificar todas as condições que podem limitar a aplicação da prática ou tecnologia estudada, incluindo tipo de solo, clima, disponibilidade hídrica, relevo, cultivar ou raça, época de implantação, nível tecnológico, infraestrutura, escala de produção e características específicas da propriedade. Determinar em quais situações os resultados encontrados na literatura podem deixar de ser aplicáveis.

93. Boas práticas de produção — apresentar as boas práticas agrícolas, pecuárias, ambientais e gerenciais recomendadas para a atividade estudada, explicando não apenas o que deve ser feito, mas por que deve ser feito, como executar corretamente, quais problemas evita e quais consequências podem ocorrer quando a recomendação não é seguida.

94. Condições mínimas para implementação — estabelecer quais são os requisitos necessários para que determinada prática seja implementada adequadamente, incluindo infraestrutura, equipamentos, mão de obra, conhecimento técnico, capital, insumos, capacitação, assistência técnica, tecnologia e condições ambientais. Diferenciar aquilo que é indispensável daquilo que apenas melhora o resultado.

95. Contraindicações e situações de não recomendação — identificar explicitamente quando a prática, tecnologia, produto ou estratégia não deve ser utilizada, quais condições tornam sua aplicação inadequada e quais alternativas podem ser adotadas nesses casos. O estudo deve procurar deliberadamente situações em que a recomendação não funciona.

96. Limites técnicos, econômicos e ambientais — determinar os limites a partir dos quais o aumento de determinada prática deixa de gerar benefício ou passa a produzir efeitos negativos. Sempre que possível, identificar limite mínimo, faixa recomendada, ótimo técnico, ótimo econômico e limite máximo, evitando recomendações genéricas.

97. Procedimentos operacionais — transformar o conhecimento científico em orientação prática, apresentando, quando pertinente, sequência de operações, época, frequência, dose, método de aplicação, equipamentos, monitoramento, manutenção e critérios de decisão. As recomendações devem ser compatíveis com evidências técnicas e não inventadas.

98. Segurança operacional — avaliar riscos envolvidos durante a execução das atividades, considerando trabalhadores, animais, equipamentos, instalações, produtos químicos, máquinas, eletricidade, incêndios, armazenamento e transporte. Apresentar medidas preventivas e boas práticas de segurança aplicáveis.

99. Monitoramento e indicadores de desempenho — estabelecer quais indicadores devem ser acompanhados para verificar se a prática está realmente funcionando. Utilizar, conforme o tema, indicadores de produtividade, eficiência, custo, rentabilidade, consumo de água, fertilizantes, energia, emissões, qualidade do solo, sanidade animal, mortalidade, bem-estar e outros parâmetros relevantes.

100. Critérios objetivos para tomada de decisão — transformar os resultados do estudo em critérios práticos, respondendo perguntas como: "Quando devo adotar?", "Quando devo evitar?", "Quanto preciso investir?", "Qual resultado preciso alcançar para compensar?", "Qual indicador devo acompanhar?" e "Em que situação devo interromper ou modificar a estratégia?".

101. Plano de contingência — identificar os principais problemas que podem ocorrer durante a execução e apresentar alternativas para situações de seca, excesso de chuva, pragas, doenças, falhas de equipamentos, aumento de custos, queda de preços, falta de insumos, problemas logísticos ou alterações regulatórias.

102. Boas práticas × práticas inadequadas — apresentar comparativamente o procedimento recomendado e os erros mais comuns, demonstrando as consequências produtivas, econômicas, ambientais, sociais e legais de cada um.

103. Manejo adaptativo — não tratar uma recomendação como regra universal. Explicar como o produtor pode monitorar os resultados, avaliar as condições da propriedade e ajustar doses, épocas, estratégias ou operações conforme os dados observados.

104. Precauções para transferência de resultados — antes de aplicar resultados de experimentos, verificar se as condições do estudo são comparáveis às condições da propriedade. Considerar solo, clima, região, cultivar, sistema de produção, escala, tecnologia e período analisado. Evitar extrapolações sem fundamento.

105. Conformidade normativa nas boas práticas — relacionar as boas práticas recomendadas com as normas legais e regulamentações aplicáveis, deixando claro quando determinada recomendação é uma exigência legal, uma norma técnica, uma recomendação científica ou apenas uma boa prática voluntária.

106. Licenciamento, autorizações e registros — quando pertinente, verificar quais licenças, cadastros, registros, autorizações, outorgas, certificações ou documentos são necessários para implantação ou operação da atividade, utilizando preferencialmente fontes oficiais e legislação vigente.

107. Rastreabilidade e documentação — avaliar quais informações devem ser registradas durante a produção, incluindo origem dos insumos, lotes, aplicações, datas, doses, operações, condições climáticas, produtividade, movimentação de animais, comercialização e ocorrências, quando aplicável. Demonstrar como a documentação auxilia na gestão, auditoria, segurança e responsabilização.

108. Certificações e padrões de qualidade — quando relevantes, identificar certificações, protocolos e padrões aplicáveis ao setor e explicar quais requisitos precisam ser cumpridos, quais custos estão envolvidos, quais benefícios podem ser obtidos e se existe retorno econômico mensurável.

109. Auditoria e verificação — estabelecer mecanismos para verificar se as boas práticas estão realmente sendo executadas, utilizando checklists, indicadores, registros, inspeções, análises laboratoriais, auditorias internas ou externas, conforme o caso.

110. Melhoria contínua — avaliar a atividade como um sistema que deve ser continuamente aperfeiçoado. Identificar problemas, medir resultados, implementar correções e comparar o desempenho antes e depois da intervenção, buscando maior produtividade, eficiência, segurança, sustentabilidade e rentabilidade.

═══════════════════════════════════════════════════════════════
REGRAS FINAIS — PRINCÍPIOS UNIVERSAIS
═══════════════════════════════════════════════════════════════

111. Princípio da aplicabilidade real — toda recomendação deve responder "isso funciona na prática?", considerando as limitações financeiras, técnicas, ambientais, sociais e estruturais encontradas em propriedades reais.

112. Princípio da proporcionalidade — não recomendar uma solução extremamente complexa ou cara quando uma alternativa mais simples apresentar resultado semelhante. Comparar benefício obtido × complexidade × custo × risco.

113. Princípio da prevenção — priorizar estratégias que evitem o problema antes que ele ocorra, sempre que isso for técnica e economicamente viável, em vez de depender exclusivamente de medidas corretivas.

114. Princípio da eficiência integral — avaliar a eficiência não apenas pela produtividade final, mas pela relação entre resultado produzido e recursos utilizados, incluindo recursos econômicos, naturais, humanos, energéticos e tecnológicos.

115. Recomendação final condicionada — a conclusão nunca deve ser simplesmente "recomenda-se" ou "não se recomenda". Deve apresentar uma conclusão condicional, indicando para quem, onde, quando, em quais condições, com qual investimento, sob quais restrições e com quais riscos a prática é recomendável.

═══════════════════════════════════════════════════════════════
BLOCO M — ESTRUTURA, FORMATO E ABNT
═══════════════════════════════════════════════════════════════

ESTRUTURA DO ARTIGO — MÍNIMO DE 15 PARÁGRAFOS NO DESENVOLVIMENTO:
- Resumo: 200-300 palavras (NBR 6028)
- Introdução: 3-4 parágrafos extensos (mínimo 8 linhas cada)
- Metodologia: 2-3 parágrafos detalhados
- Desenvolvimento: MÍNIMO de 5 tópicos, cada um com 3-4 parágrafos extensos
- Considerações finais: 2-3 parágrafos

REGRA DE SELEÇÃO LIVRE DE TÓPICOS:
Analise TODAS as fontes fornecidas. Identifique os temas mais relevantes, interessantes e que tragam maior contribuição científica. NÃO se limite aos tópicos sugeridos pelo usuário. Se uma fonte traz um dado extraordinário sobre um assunto não coberto pelos tópicos, INCLUA como tópico próprio.

REGRA DE MÚLTIPLAS FONTES:
Cada parágrafo que faz uma afirmação importante DEVE citar no mínimo 3 fontes diferentes. NUNCA sustente uma afirmação com apenas 1 fonte.

ABNT E FORMATAÇÃO:
- Título em CAIXA ALTA
- 2 autores acadêmicos fictícios mas realistas
- Resumo NBR 6028 (200-300 palavras)
- Abstract em inglês
- Introdução, Metodologia, Desenvolvimento (tópicos numerados), Considerações Finais
- NÃO use "cruzamento de dados". Use: "revisão sistemática", "síntese de evidências", "meta-análise"
- Referências ABNT NBR 6023 com TODAS as fontes citadas

REGRA DE REDAÇÃO:
- Todo tópico deve terminar com uma síntese que conecta os estudos entre si
- Cada afirmação deve ser sustentada por MÚLTIPLOS estudos (3-5 fontes)
- NÃO descreva fontes como "o autor fala sobre..." — ANALISE o que cada estudo demonstrou, sua metodologia e seu achado principal
- Critérios de periódicos de alto impacto: originalidade, rigor metodológico, significância, completude

═══════════════════════════════════════════════════════════════
FORMATO DE SAÍDA: APENAS JSON VÁLIDO (sem markdown):
═══════════════════════════════════════════════════════════════

${JSON_SCHEMA_EXAMPLE.replace('{generatedAt}', generatedAt)}

IMPORTANTE: O campo "content" de CADA tópico em "topicosDesenvolvimento" deve conter o texto COMPLETO do artigo para aquele tópico, com TODAS as citações inline. Não abrevie. Não resuma. Escreva o texto integral.

O campo "analiseComparativaDireta" DEVE conter pelo menos 4 comparações (prática antiga vs. moderna) com dados quantitativos reais.

═══════════════════════════════════════════════════════════════
BLOCO P — RESTRIÇÕES E REGRAS DE INTEGRIDADE CIENTÍFICA
═══════════════════════════════════════════════════════════════

116. Proibição absoluta de fabricação de informações — não inventar, completar, modificar ou inferir como fato qualquer dado, estatística, experimento, propriedade rural, empresa, pesquisador, instituição, legislação, norma, preço, custo, produtividade, percentual, DOI, ISBN, URL, referência bibliográfica, resultado experimental ou citação que não possa ser localizado e verificado em uma fonte confiável. Quando uma informação não for encontrada, declarar explicitamente que não foi localizada evidência suficiente, em vez de preencher a lacuna com uma informação provável.

117. Proibição de referências inexistentes — nunca criar referências bibliográficas apenas para dar aparência científica ao texto. Toda referência utilizada deve corresponder a uma publicação, documento ou página realmente existente, com autores, título, ano, periódico/instituição e demais informações bibliográficas conferíveis. Quando possível, verificar DOI, identificador, página oficial ou registro em base acadêmica.

118. Proibição de citações falsas ou distorcidas — não atribuir a um autor uma conclusão que ele não apresentou. A citação deve representar fielmente o conteúdo da fonte. Não utilizar uma fonte que apenas menciona determinado assunto como se ela tivesse produzido o dado ou demonstrado experimentalmente aquela conclusão.

119. Proibição de números sem origem — todo dado quantitativo relevante deve possuir fonte, período, unidade e contexto. Não apresentar números aproximados como se fossem dados oficiais. Quando houver estimativa ou cálculo próprio, identificá-lo explicitamente como estimativa/cálculo, demonstrando sua metodologia.

120. Separação entre evidência e interpretação — distinguir claramente entre dado observado, resultado experimental, conclusão dos autores, interpretação do modelo e hipótese. Não transformar uma interpretação em fato científico.

121. Não transformar correlação em causalidade — quando uma fonte apresentar associação entre duas variáveis, não afirmar que uma necessariamente causou a outra sem evidência causal suficiente. Identificar possíveis variáveis de confusão e limitações metodológicas.

122. Não generalizar resultados isolados — um experimento realizado em determinado solo, clima, região, cultivar, raça, sistema produtivo ou condição experimental não deve ser automaticamente generalizado para toda a agricultura ou pecuária. Explicar as condições de validade e as limitações da extrapolação.

123. Não selecionar apenas evidências favoráveis — realizar busca deliberada por resultados positivos, negativos, neutros e contraditórios. Não omitir estudos que contrariem a hipótese ou a conclusão pretendida apenas para tornar o argumento mais convincente.

124. Não fabricar consenso científico — quando existir controvérsia na literatura, apresentar a controvérsia. Não utilizar expressões como "a ciência comprova", "há consenso" ou "está comprovado" sem evidência adequada de consenso.

125. Não confundir legalidade com recomendação técnica — o fato de uma prática ser legal não significa automaticamente que seja tecnicamente recomendável, ambientalmente sustentável, economicamente viável ou eticamente aceitável. Essas dimensões devem ser analisadas separadamente.

126. Não utilizar legislação desatualizada — informações legais e regulatórias devem ser verificadas quanto à vigência, alterações, revogações e atualizações. Não apresentar uma norma antiga como legislação atualmente válida sem confirmação.

127. Não inventar preços atuais — preços de produtos agrícolas, fertilizantes, defensivos, máquinas, animais, combustíveis e demais insumos devem ser associados a data, local/região, unidade e fonte. Preços sujeitos a grande variação devem ser tratados como valores de referência, não como valores universais.

128. Não confundir faturamento com lucro — diferenciar obrigatoriamente receita bruta, receita líquida, custos, margem bruta, margem líquida, lucro, investimento, retorno e fluxo de caixa. Um aumento de faturamento não deve ser apresentado automaticamente como aumento de lucratividade.

129. Não fabricar ROI ou viabilidade econômica — qualquer ROI, payback, margem, ponto de equilíbrio ou indicador financeiro deve ser calculado a partir de dados apresentados, mostrando a fórmula e as premissas utilizadas. Se os dados forem insuficientes, declarar a impossibilidade de calcular com confiabilidade.

130. Não esconder custos indiretos — análises econômicas devem considerar, quando pertinentes, depreciação, manutenção, mão de obra, combustível, energia, armazenamento, transporte, financiamento, impostos, assistência técnica, oportunidade do capital e outros custos relevantes, evitando apresentar uma atividade como rentável simplesmente porque alguns custos foram ignorados.

131. Não apresentar experimento hipotético como real — experimentos criados para ilustrar uma metodologia devem ser explicitamente identificados como hipotéticos, simulados ou exemplificativos. Nunca atribuí-los a universidades, pesquisadores, propriedades ou instituições reais.

132. Não criar propriedades ou casos reais fictícios — exemplos hipotéticos podem ser utilizados para explicar conceitos, mas devem ser identificados como tais. Nunca apresentar uma propriedade, produtor, empresa ou caso inventado como estudo de caso real.

133. Não manipular resultados — não selecionar somente tratamentos, anos, locais ou indicadores que favoreçam determinada conclusão. Quando os dados apresentarem resultados desfavoráveis, eles devem ser preservados e discutidos.

134. Não omitir limitações relevantes — todo estudo deve declarar suas principais limitações metodológicas, econômicas, ambientais, temporais e de aplicabilidade. Uma conclusão forte exige evidências compatíveis com sua força.

135. Não usar linguagem excessivamente absoluta — evitar afirmações como "sempre", "nunca", "garante", "elimina", "sem riscos", "100% sustentável", "aumenta a produtividade" quando as evidências não sustentarem esse nível de certeza. Utilizar linguagem proporcional à qualidade das evidências.

═══════════════════════════════════════════════════════════════
BOAS PRÁTICAS OBRIGATÓRIAS
═══════════════════════════════════════════════════════════════

136. Hierarquia de fontes — priorizar, sempre que possível: 1) artigos científicos revisados por pares; 2) revisões sistemáticas e meta-análises; 3) universidades e centros de pesquisa; 4) Embrapa e instituições oficiais de pesquisa; 5) órgãos governamentais; 6) bases estatísticas oficiais; 7) organizações internacionais reconhecidas; 8) documentos técnicos; 9) fontes setoriais confiáveis; 10) notícias e conteúdos comerciais apenas como fontes complementares.

137. Triangulação de evidências — sempre que uma informação for particularmente importante, procurar mais de uma fonte independente para verificar se o resultado é consistente. Quanto mais importante for a afirmação para a conclusão, maior deve ser o nível de verificação.

138. Priorizar fontes primárias — quando possível, consultar o estudo original em vez de utilizar uma notícia, blog ou artigo secundário que apenas o descreva. A fonte secundária pode ajudar na contextualização, mas não deve substituir a evidência original quando esta estiver disponível.

139. Verificação antes da redação final — pesquisar primeiro, organizar as evidências depois e somente então redigir o argumento. Não escrever uma conclusão previamente escolhida e posteriormente procurar fontes para justificá-la.

140. Pesquisa adversarial — para cada hipótese ou conclusão importante, procurar deliberadamente: "Qual evidência poderia demonstrar que essa conclusão está errada?" Essa etapa deve fazer parte obrigatória da pesquisa.

141. Registro das premissas — deixar explícitas todas as premissas utilizadas nos cálculos e análises: preço, produtividade, área, taxa, eficiência, vida útil, inflação, taxa de desconto, custo de oportunidade, período e demais parâmetros.

142. Padronização das unidades — utilizar unidades consistentes e explicar conversões quando necessárias. Evitar misturar kg/ha, t/ha, sacas/ha, R$/ha, R$/kg e R$/saca sem deixar clara a conversão.

143. Contextualização temporal — todo dado relevante deve, sempre que possível, informar ano ou período de referência. Dados históricos e atuais não devem ser comparados sem considerar alterações de preços, inflação, produtividade e contexto tecnológico.

144. Contextualização geográfica — indicar país, estado, região ou localidade de origem dos dados sempre que isso puder alterar sua interpretação.

145. Rastreabilidade das informações — permitir que o leitor consiga identificar de onde veio cada informação importante, especialmente números, resultados experimentais, afirmações legais e conclusões controversas.

═══════════════════════════════════════════════════════════════
PROTOCOLO FINAL
═══════════════════════════════════════════════════════════════

146. Protocolo de incerteza — quando as evidências forem insuficientes, contraditórias ou de baixa qualidade, o modelo deverá assumir a incerteza, apresentar as diferentes possibilidades e explicar o que seria necessário para chegar a uma conclusão mais segura. É preferível declarar "não há evidência suficiente para concluir" a produzir uma resposta aparentemente completa baseada em informação inventada ou especulativa.

147. Protocolo de autocorreção — antes da versão final, revisar criticamente todo o trabalho procurando: referências inexistentes, números sem fonte, cálculos incorretos, unidades incompatíveis, legislação desatualizada, conclusões exageradas, causalidades indevidas, contradições internas, estudos mal interpretados, dados fora de contexto e informações que não puderam ser verificadas. Corrigir ou remover qualquer elemento que não passe nessa verificação.

148. Regra de honestidade científica — a prioridade absoluta deve ser, nesta ordem: veracidade → qualidade da evidência → precisão → transparência → profundidade → completude → persuasão textual. Nunca sacrificar a precisão para produzir um texto mais extenso, convincente ou aparentemente completo.

═══════════════════════════════════════════════════════════════
MENSAGEM CENTRAL — NÃO PREENCHA LACUNAS COM CONHECIMENTO PROVÁVEL
═══════════════════════════════════════════════════════════════

"Não preencha lacunas com conhecimento provável. Uma lacuna declarada é cientificamente aceitável; uma informação inventada apresentada como fato não é."

═══════════════════════════════════════════════════════════════
REGRA UNIVERSAL FINAL
═══════════════════════════════════════════════════════════════

Nenhuma recomendação técnica, econômica, ambiental, social, ética ou legal deve ser apresentada de maneira universal quando as evidências demonstrarem dependência de contexto. Sempre identificar as condições de validade, limitações, exceções, riscos e situações em que a recomendação pode deixar de ser adequada. Diferenciar claramente exigências legais, recomendações técnicas, boas práticas, evidências científicas e opiniões.`;
}

export function buildPrompt(
  mode: ArticleMode,
  args: BuildPromptArgs
): string {
  if (mode === 'aprofundado') {
    return buildPromptAprofundado(args);
  }
  return buildPromptPadrao(args);
}
