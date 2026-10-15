# Arquitetura

## Visão geral

Este projeto divide a arquitetura entre React, responsável pela interface que envolve o jogo, e PixiJS, responsável pela arena de combate. A camada React controla telas, menus, formulários e painéis de dados. A camada PixiJS controla a simulação em tempo real, a renderização, a captura de entradas e as atualizações da arena de batalha a cada quadro.

## Fluxo de alto nível

1. A aplicação inicia na tela do menu e lê do localStorage as configurações de gameplay persistidas.
2. O jogador escolhe iniciar uma batalha, que cria um novo snapshot da simulação com base na configuração atual.
3. O componente `GameCanvas` monta uma `Application` do PixiJS, conecta os listeners de teclado e inicia um loop de atualização controlado pelo ticker.
4. O estado da simulação é mantido em um módulo de engine independente (`src/game/engine.ts`); o renderizador apenas lê esse estado e desenha as entidades.
5. Quando a partida termina, o componente envia a pontuação final e o motivo para a camada React, que registra o resultado por meio da camada de API simulada.

## Responsabilidade pelo estado

### Camada React

A camada em `src/App.tsx` é responsável por:

- navegação entre as telas: menu, opções, jogo e resultados;
- normalização e persistência da configuração de gameplay;
- consultas ao ranking e ao histórico por meio do TanStack Query e do Axios;
- envio do resultado e invalidação do cache;
- sincronização do HUD com a partida em andamento.

### Engine da simulação

A engine em `src/game/engine.ts` é responsável por:

- movimentação do jogador e dos inimigos;
- lógica de rotação e disparo;
- duração dos projéteis e tratamento de colisões;
- regras de bloqueio por ilhas;
- geração de inimigos e temporização da dificuldade;
- condições de vitória e derrota e estado de pausa;
- lógica de pontuação e tempo.

A engine é intencionalmente independente do renderizador para que as regras possam ser testadas sem depender do loop de quadros do navegador.

Os valores de balanceamento ficam em `GameBalanceConfig`, que é tipado, e em `DEFAULT_GAME_BALANCE`, ambos em `src/config.ts`. Cada chamada a `createGameState` copia as opções do jogador e o balanceamento, mantendo um snapshot estável durante a partida ativa. O balanceamento abrange dimensões da arena e ilhas, movimentação, rotação e vida dos navios, propriedades das armas e dos projéteis, comportamento dos inimigos, segurança e sequência de surgimento, e pontuação. `GameplayConfig` armazena as configurações do jogador usadas ao iniciar uma partida; a tela Options expõe a duração da sessão e o intervalo de surgimento dos inimigos, conforme exigido pelo desafio.

As posições candidatas para o surgimento de inimigos são sorteadas nas bordas da arena e rejeitadas quando se sobrepõem a uma ilha, a outro navio ou à zona de segurança do jogador. A sequência padrão alterna entre os tipos Chaser e Shooter. A movimentação com colisões usa subpassos limitados para os navios e verificações de trajetória com círculos varridos para os projéteis, incluindo bloqueio por ilhas e ordenação pelo instante do impacto. Um inimigo derrotado é desativado imediatamente, impedindo que receba novos impactos ou conceda pontos duplicados; abates feitos pelo jogador valem um ponto, enquanto a autodestruição de um Chaser não pontua.

## Modelo de renderização do PixiJS

`src/game/GameCanvas.tsx` instancia uma aplicação PixiJS com um tamanho lógico fixo para a arena (`960x540`). O canvas se ajusta ao elemento que o contém, preservando a proporção 16:9 em computadores e dispositivos móveis. Camadas persistentes do palco contêm o fundo, as ilhas, os projéteis, os navios, as barras de vida e o texto de estado; as entidades só são adicionadas ou removidas quando o estado da simulação muda.

Responsabilidades principais:

- capturar entradas do teclado para movimentação e disparos;
- controlar pausa e retomada, inclusive quando a página perde visibilidade;
- desenhar navios do jogador e dos inimigos, projéteis, ilhas gráficas, barras de vida e textos de estado;
- enviar pontuação, vidas e tempo arredondado ao React somente quando um valor exibido no HUD mudar;
- manter a aplicação PixiJS montada quando callbacks do React ou o estado do HUD forem atualizados;
- liberar recursos quando o jogo for desmontado ou uma nova configuração for aplicada.

## Entradas e comportamento da pausa

As entradas do teclado são acompanhadas em `GameCanvas` e convertidas em um estado normalizado (`up`, `down`, `left`, `right`, `shoot`). A engine lê essas entradas uma vez por atualização. A pausa suspende a simulação preservando o estado, evitando acúmulo de movimento ou disparos automáticos durante o período pausado.

Mudanças de visibilidade também pausam a partida, impedindo que o jogo continue em abas em segundo plano.

## Regras de colisão e combate

O ciclo de combate segue um modelo baseado em intervalos de tempo:

- cada atualização avança a simulação por um intervalo de tempo máximo limitado;
- movimentação, temporizadores de surgimento, cooldowns de disparo e duração dos projéteis são atualizados usando esse intervalo;
- as colisões são verificadas após as atualizações de movimentação;
- os projéteis são removidos ao atingir um alvo ou uma ilha, expirar ou sair da arena.

As colisões com ilhas afastam os navios em movimento do obstáculo; os projéteis também consideram as ilhas como obstáculos no mesmo ciclo da simulação, impedindo que atravessem seu corpo.

## Persistência e integração de rede

A aplicação persiste as opções de gameplay no localStorage por meio dos helpers em `src/config.ts`. Assim, o tempo de sessão e as configurações de surgimento escolhidos pelo jogador permanecem após atualizar a página.

O ranking e o histórico de partidas são acessados pela camada de API em `src/api/client.ts`, que usa Axios como cliente HTTP e TanStack Query para cache, novas tentativas e invalidação. A camada de mocks é fornecida pelo MSW e mantém a aplicação funcional sem um backend.

## Carregamento e uso de assets

O projeto inclui uma pasta `assets/` com imagens da interface e outros elementos gráficos do jogo. A camada React carrega o logotipo e as imagens do menu; o renderizador do jogo carrega e reutiliza as texturas dos navios do jogador e dos inimigos. As ilhas e a água são desenhadas com elementos gráficos do PixiJS, em vez de reutilizar imagens da interface como texturas do jogo.

A arena aguarda o carregamento das texturas dos navios do jogador e dos inimigos por meio de `Assets.load` do PixiJS antes de montar o renderizador. O progresso do carregamento é exibido na interface; falhas são apresentadas com uma ação para tentar novamente, e as texturas carregadas são reutilizadas na criação dos sprites.

## Ciclo de vida e limpeza

Cada nova partida recebe um `GameCanvas` novo, identificado pela chave da sessão. Atualizações do HUD e mudanças nos callbacks do React não reinicializam o PixiJS; ao desmontar a arena, são removidos os listeners, o ticker, a aplicação PixiJS e seu canvas. Isso evita oscilações visuais e protege contra o tratamento duplicado de eventos no fluxo do React Strict Mode.

## Testes e validação

A engine é coberta por testes Vitest em `src/game/engine.test.ts`, que incluem movimentação e rotação, colisões com os limites da arena e com ilhas, cooldowns independentes das armas, disparos laterais simultâneos, impactos de projéteis verificados ao longo da trajetória, invulnerabilidade, comportamento dos dois tipos de inimigo, surgimento determinístico e seguro, pontuação por abate, pausa e condições de encerramento da partida. O Playwright também verifica que a batalha mantém um único canvas montado após uma atualização do HUD e que a arena 16:9 cabe em uma viewport móvel. A suíte unitária, a verificação estrita de tipos, o lint, o build de produção e os fluxos E2E passam.

## Decisões e concessões atuais

- A simulação permanece determinística e testável porque suas regras são mantidas separadas do código de desenho.
- A camada de interface é intencionalmente leve e usa o estado dos resultados de consultas do React Query.
- A renderização da arena usa primitivas gráficas imediatas, em vez de um sistema completo de atlas de sprites. Isso simplifica a integração sem deixar de atender ao requisito de uso do PixiJS.
