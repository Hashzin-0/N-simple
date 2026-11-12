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

## Cabine didática procedural

A cabine apresentada no modo interno é geometria original construída com Three.js no componente `Tractor3DLearning.tsx`. É uma maquete de ensino, não uma digitalização nem uma reprodução de cabine comercial.

Os símbolos ISO são usados como objetos pedagógicos ligados visualmente a controles genéricos (alavancas, interruptores, pedais). As posições não devem ser interpretadas como localização real de comandos em um modelo ou ano específico.

## Dinâmica e limites

- A velocidade estimada vem da marcha e da rotação selecionadas, com proporcionalidade sobre os dados cadastrados em `lib/tratoresData.ts`.
- O controle visual Tartaruga/Lebre aplica escalas didáticas de 0,5× e 1×. Não declara uma relação de transmissão real.
- A animação wheel-roll é acelerada/desacelerada pela velocidade estimada; se o modelo não carregar, o estado de erro é exibido e uma geometria alternativa simples é mostrada.
- A cena é renderizada no cliente e deve liberar AnimationMixer, OrbitControls, ResizeObserver, requestAnimationFrame, geometria, materiais e renderer no unmount.
- O modelo genérico exterior é o mesmo para os tratores selecionados; a seleção troca a tabela de velocidades usada pela simulação, não a identidade física do GLB.

## Fontes técnicas

- Página do modelo e licença: https://3dassets.dev/assets/arable-fields-and-farm-machinery-row-crop-tractor-eefceb01
- Licença CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
- Three.js GLTFLoader: https://threejs.org/docs/pages/GLTFLoader.html
- Three.js OrbitControls: https://threejs.org/docs/pages/OrbitControls.html
