# Ativos 3D do módulo Tratorista

## Modelo externo CC0

- Nome publicado: Mid-size row-crop tractor (Arable Fields and Farm Machinery)
- Página do ativo: https://3dassets.dev/assets/arable-fields-and-farm-machinery-row-crop-tractor-eefceb01
- Arquivo GLB via CDN: https://cdn.3dassets.dev/assets/16840/v1/model.glb
- Licença declarada pelo catálogo: CC0 1.0 Universal
- Dimensões publicadas: 2,46 × 2,889 × 4,935 m
- Geometria publicada: 6.444 triângulos
- Animações publicadas: open, close e wheel-roll
- Nós publicados: portas da cabine e pivôs das quatro rodas

O ativo é um trator agrícola genérico de aproximadamente 150 hp, criado para uso genérico. Não é um modelo OEM nem representa John Deere, Massey Ferguson, Valtra ou New Holland. Não usar marcas, adesivos ou nomes de fabricantes na malha genérica.

O projeto carrega o GLB diretamente do CDN oficial do catálogo, sem copiar o binário para o repositório. A licença CC0 e os dados técnicos acima foram conferidos na página do ativo em 11/11/2026.

## Cabine didática John Deere 5078E

A cabine interna é uma reconstrução procedural Three.js do posto de operação da John Deere 5078E Série 5E cabinada, implementada em `components/MecanizacaoTratores/Tractor3DLearning.tsx`. O layout foi estruturado a partir da documentação do fabricante: plataforma plana, assento e volante, painel eletrônico dianteiro, pedais, console direito com válvulas remotas e controles do levante, console esquerdo com tração dianteira e TDP, além dos comandos traseiros.

A geometria é uma interpretação educacional aproximada, não um CAD OEM, digitalização ou promessa de equivalência milimétrica. A Série 5E pode variar por ano, número de série, transmissão (9x3 TSS ou 12x12 PowrReverser), quantidade de VCRs e opcionais. Para treinamento operacional, o manual correspondente à máquina real prevalece.

A seleção do simulador foi restringida aos tratores John Deere nesta etapa. O 5078E 9x3 TSS foi cadastrado com 78 cv, 2400 rpm e velocidades publicadas para a transmissão sincronizada e pneu 16.9-30 R1; os dados não devem ser usados para a opção 12x12 ou outra configuração.

No exercício ISO, o cartão pré-resposta exibe somente o pictograma e o código ISO. O componente de imagem também reduz o texto alternativo acessível ao código ISO durante o exercício, evitando revelar o nome do símbolo por leitor de tela. A descrição e a aplicação completas aparecem após a submissão. A biblioteca de estudo continua exibindo o conteúdo integral.

## Dinâmica e limites

- A velocidade estimada vem da marcha e da rotação selecionadas, com proporcionalidade sobre os dados cadastrados em `lib/tratoresData.ts`.
- O controle visual Tartaruga/Lebre aplica escalas didáticas de 0,5× e 1×. Não declara uma relação de transmissão real.
- A animação wheel-roll é acelerada/desacelerada pela velocidade estimada; se o modelo não carregar, o estado de erro é exibido e uma geometria alternativa simples é mostrada.
- A cena é renderizada no cliente e deve liberar AnimationMixer, OrbitControls, ResizeObserver, requestAnimationFrame, geometria, materiais e renderer no unmount.
- O modelo genérico exterior é o mesmo para os tratores selecionados; a seleção troca a tabela de velocidades usada pela simulação, não a identidade física do GLB.

## Fontes técnicas

- John Deere 5078E — página oficial e especificações: https://www.deere.com.br/pt/tratores/s%C3%A9rie-5e-pequenos/5078e-cabinado-70cv/
- John Deere Brasil — manuais, guias rápidos e publicações: https://www.deere.com.br/pt/pe%C3%A7as-e-servi%C3%A7os/manuais-e-treinamento/manuais/
- Guia de controles da Série 5E e manual de velocidades 5075E/5078E/5085E: https://www.scribd.com/document/453254778/CATALOGO-JONH-DEERE-Manual-Do-Operador-5075E-5078E-5085E-e-5090E
- Página do modelo exterior genérico e licença: https://3dassets.dev/assets/arable-fields-and-farm-machinery-row-crop-tractor-eefceb01
- Licença CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
- Three.js GLTFLoader: https://threejs.org/docs/pages/GLTFLoader.html
- Three.js OrbitControls: https://threejs.org/docs/pages/OrbitControls.html
