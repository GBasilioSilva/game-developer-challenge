# Desafio React & Pixi JS — Pirate Battle

Desenvolva um **shooter naval 2D com visão superior** usando React, TypeScript e PixiJS. O jogador deve navegar entre ilhas, enfrentar navios inimigos e acumular pontos até o fim da partida.

O desafio avalia gameplay, domínio de PixiJS, arquitetura, integração de dados, experiência de uso e qualidade da entrega. Informe sua estimativa de prazo antes de iniciar.

## 1. Stack obrigatória

| Responsabilidade | Tecnologia |
| --- | --- |
| Interface e menus | React |
| Linguagem | TypeScript em modo estrito |
| Renderização do jogo | PixiJS |
| Estado remoto do ranking e do histórico | TanStack Query |
| Cliente HTTP do ranking e do histórico | Axios |
| Mocking das APIs de ranking e histórico | MSW |
| Testes E2E e regressão visual | Playwright |

Todas as tecnologias devem participar efetivamente da solução. A ferramenta de build, a estilização e as bibliotecas complementares ficam a critério do candidato.

O jogo é single-player e deve funcionar integralmente no navegador. Gameplay e configurações são locais. Ranking e histórico de partidas usam APIs REST simuladas com MSW, consumidas por Axios e TanStack Query.

## 2. Gameplay

### Jogador

- Movimentação para a frente e rotação para os dois lados.
- Disparo frontal com um projétil.
- Disparo lateral com três projéteis paralelos, com comandos para o lado esquerdo e o direito do navio.
- Vida limitada, reduzida por projéteis inimigos e pelo impacto de um Chaser.
- Movimentação restrita à arena visível, sem atravessar ilhas.

Defina controles de teclado e controles de toque para movimento, rotação e ataques. Permita movimentar e disparar simultaneamente. Apresente os comandos na interface.

### Inimigos

| Tipo | Comportamento |
| --- | --- |
| **Chaser** | Persegue o jogador, causa dano ao colidir com seu navio e explode no impacto |
| **Shooter** | Aproxima-se do jogador e dispara quando estiver dentro do alcance de ataque |

Ambos devem avançar, rotacionar, receber dano e respeitar as colisões com ilhas. Os dois tipos precisam aparecer durante uma partida padrão.

Inimigos surgem a cada intervalo configurado até o encerramento da partida. Os pontos de spawn devem estar livres de obstáculos e suficientemente afastados do jogador para evitar dano imediato inevitável.

### Arena, colisões e combate

- A arena deve conter água e pelo menos uma ilha que bloqueie navios e projéteis.
- Projéteis devem respeitar direção, velocidade, dano e alcance ou tempo de vida.
- Disparos do jogador atingem inimigos; disparos inimigos atingem o jogador.
- Cada projétil deve aplicar dano uma única vez e ser removido ao atingir um alvo ou obstáculo, expirar ou sair da arena.
- Cada arma deve respeitar seu intervalo entre disparos.
- Inimigos destruídos deixam de causar dano, disparar e participar das colisões.

### Regras da partida

- Duração configurável entre **60 e 180 segundos** de jogo ativo.
- Cada inimigo destruído pelos ataques do jogador vale **1 ponto**. A autodestruição de um Chaser contra o jogador não pontua.
- A partida termina quando o tempo acaba ou a vida do jogador chega a zero.
- O encerramento interrompe movimento, ataques, dano, spawns e contagem de pontos.
- Reiniciar deve criar uma nova partida, com vida, pontuação, cronômetro e entidades restaurados.

Exiba vida acima do navio do jogador e de cada inimigo. O HUD deve apresentar também pontuação e tempo restante.

Implemente pausa manual e automática ao perder o foco ou ocultar a aba. Durante a pausa, cronômetro, cooldowns e simulação ficam suspensos. A retomada exige uma ação do jogador e não pode acumular movimento ou disparos do período pausado.

### Animações e feedback

Implemente efeitos de disparo, explosão de destruição e deterioração visual dos navios conforme a vida restante. Ataques, impactos e dano devem ter feedback perceptível, mantendo a leitura da arena.

## 3. Telas e configurações

| Tela | Requisitos |
| --- | --- |
| Menu principal | Ações **Play** e **Options**, instruções de controle e abas **Ranking** e **Match History** |
| Options | **Game session time** e **Enemy spawn time**, com validação, salvamento e persistência após refresh |
| Partida | Arena PixiJS, HUD, controles e pausa |
| Resultado | Pontuação total, tempo jogado, motivo do encerramento, situação do registro da partida e ações **Play Again** e **Main Menu** |
| Ranking | Classificação, identificação dos jogadores, pontuação e paginação |
| Match History | Histórico do jogador, com data, pontuação, duração, motivo do encerramento e paginação |

Centralize os parâmetros de gameplay em uma configuração tipada e ajustável: duração, intervalo e distribuição dos spawns, vida, velocidades de movimento e rotação, dano, alcance, velocidade e duração dos projéteis, cooldowns e alcance do Shooter. Mudanças de balanceamento não devem exigir alterações na lógica dos sistemas.

A tela Options deve expor os dois parâmetros indicados. O intervalo de spawn deve ser positivo e ter limites documentados. Cada partida utiliza um snapshot da configuração vigente ao iniciar; alterações posteriores valem para novas partidas.

Recarregar a página ou sair da tela de combate encerra a partida em andamento. Persista localmente as opções do jogador e o resultado da última partida concluída. Uma partida abandonada não é registrada no ranking nem no histórico.

Interface, identificadores de código e documentação da solução devem estar em inglês. A identidade visual dos menus fica a seu critério e deve ser coerente com os assets do jogo.

## 4. PixiJS e arquitetura

Use PixiJS para arena, navios, projéteis, efeitos e indicadores sobre os navios. Use React nos menus, formulários, painéis e diálogos.

A solução deve demonstrar:

- separação entre regras do jogo, renderização, input e estado da interface;
- simulação baseada em tempo, com movimento, dano e spawns independentes da taxa de quadros;
- sincronização da interface com o jogo sem renderizações React a cada frame;
- carregamento e reutilização de texturas, com tratamento de falhas antes de iniciar o combate;
- ajuste do canvas à tela e à densidade de pixels, preservando proporções, coordenadas de input e limites da arena;
- liberação de listeners, ticker, timers, entidades e recursos ao sair ou reiniciar;
- inicialização e desmontagem corretas também com React Strict Mode.

O estado contínuo do combate deve permanecer na simulação. A estratégia de gerenciamento de estado e de sincronização com a interface fica a critério do candidato.

As regras de movimentação, combate, colisões e comportamento dos inimigos devem ser implementadas pelo candidato. A organização interna é livre; descreva as principais decisões em `ARCHITECTURE.md`.

## 5. Ranking e histórico de partidas

Implemente as abas **Ranking** e **Match History** no menu principal, com contratos tipados para os seguintes recursos:

| Recurso | Operações mínimas |
| --- | --- |
| Ranking | Consultar classificação paginada, ordenada por pontuação |
| Histórico | Registrar uma partida concluída e consultar o histórico paginado do jogador |

Cada registro deve conter identificação da partida e do jogador, data, pontuação, duração efetiva, motivo do encerramento e configuração usada. Compare no ranking partidas com a mesma configuração e adote um critério determinístico de desempate. Outros jogadores são representados por fixtures.

Use **Axios** nas chamadas HTTP e **TanStack Query** nas consultas e no registro de partidas. Gerencie carregamento, vazio, erro, atualização em segundo plano, cache, invalidação e retries. Atualize as duas abas após registrar uma partida e ao voltar a exibi-las. Respostas atrasadas não devem sobrescrever dados mais recentes.

Uma partida concluída deve gerar um único registro no histórico e uma única entrada no ranking. Reenvios e cliques repetidos devem recuperar o registro existente, sem duplicação. Preserve registros pendentes após falhas ou refresh e permita tentar novamente. O jogador deve conseguir iniciar outra partida enquanto houver um registro pendente.

Falhas nessas APIs não devem bloquear o acesso ao jogo, às configurações ou interromper o combate. Essas integrações se limitam ao ranking e ao histórico de partidas.

## 6. Mocking com MSW

Implemente os mocks das APIs de ranking e histórico na camada de rede, compartilhando contratos, fixtures e handlers entre desenvolvimento, testes e demonstração. Registros confirmados devem aparecer nas consultas seguintes, com estado consistente entre as duas abas.

### Simulating Network Conditions and Failures

Disponibilize cenários configuráveis e reproduzíveis para:

- sucesso, listas vazias e múltiplas páginas;
- lentidão, latência variável e respostas fora de ordem;
- timeout, falhas de conexão e respostas HTTP 4xx/5xx;
- falha ao consultar ranking ou histórico;
- timeout depois de registrar uma partida, com recuperação sem duplicação;
- indisponibilidade no encerramento da partida e registro após recuperação.

Inclua uma forma de selecionar os cenários e restaurar o estado inicial. Controle aleatoriedade e latência nos testes. Os mocks devem funcionar no build publicado. Use persistência local para manter os registros confirmados e os envios pendentes após refresh.

## 7. Interface, assets e acessibilidade

Os arquivos estão disponíveis em [assets/](assets/): navios, partes de navios, projéteis, efeitos, tiles, sprites de HUD e menus, spritesheets e imagens de referência. Os atlas de interface estão em [ui_sheet.json](assets/spritesheet/ui_sheet.json) e [ui_sheet_retina.json](assets/spritesheet/ui_sheet_retina.json), com recortes, alinhamento e caminhos dos PNGs individuais. Os campos `ui` contêm metadados complementares; suas medidas e as bordas usam unidades lógicas (1×), relativas ao canto superior esquerdo do sprite. Os efeitos sonoros e loops de ambiente estão em [assets/sounds/](assets/sounds/), no formato WAV.

Utilize os assets fornecidos como base visual. Conversão de atlas, otimização de imagens e recursos complementares são permitidos; inclua as fontes e licenças correspondentes na entrega.

A interface e o jogo devem funcionar em desktop e mobile, com controles de toque utilizáveis e sem cortes na arena ou no HUD. Defina a orientação suportada no mobile e adapte o layout à mudança de tamanho sem alterar as regras da partida.

O carregamento dos assets da partida deve ter progresso ou estado de carregamento visível.

Garanta navegação por teclado nos menus, foco visível, controle de foco em diálogos, labels, contraste adequado e mensagens de erro acessíveis. Disponibilize pontuação, tempo e estado da partida também em uma interface semântica; evite anúncios a cada frame. As teclas do jogo só devem ser capturadas enquanto o contexto de gameplay estiver ativo.

## 8. Testes com Playwright

Entregue testes E2E cobrindo:

1. Navegação, validação e persistência das opções.
2. Carregamento dos assets, falhas e nova tentativa.
3. Início de partida, movimento, rotação, limites da arena e colisão com ilhas.
4. Disparos frontal e lateral, dano, cooldown e pontuação sem duplicação.
5. Comportamentos de Chaser e Shooter e intervalo de spawn.
6. Encerramento por tempo e por morte, interrupção da simulação e reinício limpo.
7. Pausa, perda de foco e retomada sem avanço indevido do cronômetro.
8. Exibição do resultado e sua persistência após refresh.
9. Abandono da partida, navegação repetida entre telas e controles de toque.
10. Consulta e paginação das abas Ranking e Match History, incluindo carregamento, vazio e erro.
11. Registro da partida, atualização das duas abas e recuperação de envio pendente após refresh.
12. Reenvio após timeout sem duplicação e respostas atrasadas sem sobrescrever dados recentes.

Execute os fluxos principais em Chromium, em desktop e mobile. Inclua regressão visual do menu, da arena em um estado estável e da tela de resultado, com baselines versionadas.

Use cenários com seed e controle do tempo da simulação para tornar os testes reproduzíveis. A instrumentação de teste pode observar o estado e controlar o relógio, preservando a execução real das regras, inputs, colisões e renderização. Os testes de combate devem acionar controles do jogo e verificar seus efeitos.

Cada teste deve partir de um estado isolado. Entregue relatório HTML e traces das falhas.

## 9. Performance do jogo

Avalie a performance do combate em build otimizado, com **60 FPS como alvo** no ambiente de referência documentado. Registre taxa de quadros, percentil 95 do tempo entre frames e quantidade de entidades em uma partida de três minutos.

Verifique o uso de memória após cinco ciclos de iniciar, jogar e sair, investigando crescimento contínuo de recursos. Entregue evidências de profiling com hardware, navegador, resolução, configuração da partida e limitações observadas.

## 10. Critérios de avaliação

| Critério | Pontos |
| --- | ---: |
| Gameplay, regras, colisões e comportamento dos inimigos | 35 |
| PixiJS, arquitetura e ciclo de vida dos recursos | 20 |
| Interface, feedback, responsividade e acessibilidade | 15 |
| TanStack Query, Axios e consistência do ranking e histórico | 10 |
| MSW e cenários de falha | 5 |
| Testes com Playwright | 10 |
| Performance e documentação | 5 |
| **Total** | **100** |

Serão considerados o funcionamento completo da partida, a clareza das responsabilidades, a qualidade do código e a execução reproduzível. O console deve permanecer sem erros não tratados durante os fluxos previstos.

## 11. Entrega

Entregue o repositório com código-fonte, lockfile, assets, mocks, fixtures e testes.

O **deploy é obrigatório**. Envie uma URL pública e funcional do jogo. Recomenda-se [Vercel](https://vercel.com/); [Netlify](https://www.netlify.com/) e [Cloudflare Pages](https://pages.cloudflare.com/) também são aceitos.

A versão publicada deve corresponder ao código entregue, permanecer funcional e acessível durante a avaliação e executar os mocks de ranking e histórico. O jogo deve funcionar ao abrir ou recarregar a URL publicada.

O `README.md` da solução deve incluir setup, variáveis de ambiente, controles, configuração de gameplay, seleção e reset dos cenários de rede, comandos e instruções para reproduzir falhas. Disponibilize comandos para desenvolvimento, build, preview, lint, verificação de tipos e Playwright.

Documente em `ARCHITECTURE.md` a integração React/PixiJS, o ciclo da simulação, colisões, gerenciamento de recursos, persistência local e integração do ranking e histórico, incluindo contratos, cache e recuperação de registros pendentes. Registre limitações e decisões de balanceamento.

Inclua os relatórios de testes e profiling. A solução deve executar a partir de um checkout limpo, sem depender de serviços privados.

## Project setup

A aplicação inicial e as ferramentas de desenvolvimento já estão configuradas. Instale as dependências e inicie o servidor de desenvolvimento:

```bash
npm ci
npm run dev
```

Comandos de verificação disponíveis:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npx playwright show-report
```

O Playwright executa os fluxos em Chromium desktop e em viewport mobile. Para rodar um projeto isoladamente:

```bash
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=mobile-chromium
```

Os testes usam uma seed fixa e um relógio controlável da simulação, habilitados apenas no modo de desenvolvimento por `?e2e=1&seed=173`. Isso mantém as regras reais da engine e torna os cenários reproduzíveis. Os cenários MSW incluem sucesso, lentidão, listas vazias, falhas independentes de ranking/histórico, timeout após gravação e resposta fora de ordem.

As capturas de referência ficam versionadas em `tests/visual.spec.ts-snapshots/`. Revise visualmente as mudanças antes de atualizar as baselines:

```bash
npx playwright test tests/visual.spec.ts --update-snapshots
```

O registro dos testes automatizados executados, seus resultados e limites desta validação está em [TEST-REPORT.txt](./TEST-REPORT.txt).

### Estrutura do projeto

O mapa abaixo apresenta o código-fonte, as configurações, os testes e os assets fornecidos para o projeto. As pastas de dependências e de saída do build são descritas separadamente, pois são geradas localmente.

```text
game-developer-challenge/
|-- assets/
|   |-- png/
|   |   |-- default/
|   |   |   |-- effects/       Explosões e efeitos de fogo em resolução padrão
|   |   |   |-- ship_parts/    Sprites individuais de casco, vela, canhão, tripulação, bandeira e madeira
|   |   |   |-- ships/         Sprites completos de navios
|   |   |   |-- tiles/         Peças gráficas de terreno e água
|   |   `-- retina/            Versões em alta densidade de efeitos, navios, peças, tiles e interface
|   |-- sounds/                Efeitos WAV de navios, canhões, combate, menus e estados do jogo
|   |-- spritesheet/           Atlases PNG com metadados XML/JSON dos quadros, incluindo versões retina
|   |-- tilesheet/             Imagens do atlas de tiles e arquivo de referência
|   |-- vector/                Arte vetorial SVG e arquivos SWF fornecidos
|   |-- logo_jungle_gaming.svg Identidade visual da aplicação
|   |-- preview.png            Imagem de prévia geral do projeto
|   |-- sample*.png            Referências do menu, opções, pausa, ranking, histórico e resultado
|   `-- ui_scene_background.png Imagem de fundo usada pela interface
|-- public/
|   |-- favicon.svg            Ícone da aba do navegador
|   |-- icons.svg              Coleção compartilhada de ícones SVG
|   `-- mockServiceWorker.js   Service worker gerado pelo MSW para interceptar requisições da API
|-- src/
|   |-- api/
|   |   `-- client.ts          Requisições tipadas do Axios para ranking e histórico de partidas
|   |-- assets/
|   |   |-- logo_jungle_gaming-DJ6LxWQy.svg Logotipo importado no bundle do React
|   |   |-- ship_1-HOE-34V8.png Textura do navio do jogador/Shooter
|   |   |-- ship_5-DsjvB4dj.png Textura do Chaser
|   |   `-- ui_scene_background-DaVheB5U.png Textura de fundo do menu e da arena
|   |-- game/
|   |   |-- engine.ts          Estado e regras do jogo independentes do PixiJS: movimento, combate e colisões
|   |   |-- GameCanvas.tsx     Aplicação PixiJS, carregamento de texturas, renderização, controles e ciclo de vida
|   |   `-- engine.test.ts     Testes unitários do comportamento da simulação
|   |-- mocks/
|   |   |-- browser.ts         Inicializa o service worker do MSW no navegador
|   |   |-- handlers.ts        Dados de exemplo para ranking/histórico e endpoints REST simulados
|   |   `-- handlers.test.ts   Testes unitários do comportamento da API simulada
|   |-- types/
|   |   `-- game.ts            Contratos TypeScript compartilhados de configuração e dados das partidas
|   |-- App.tsx                Fluxo de telas React, menus, opções, HUD, resultados e integração com o Query
|   |-- App.css                Estilos das telas e dos componentes da interface React
|   |-- config.ts              Opções locais, validação e balanceamento tipado do gameplay
|   |-- config.test.ts         Testes unitários da normalização da configuração
|   |-- index.css              Estilos globais, tipografia e layout básico da página
|   `-- main.tsx               Ponto de entrada React, Strict Mode, QueryClient e inicialização do MSW
|-- tests/
|   |-- fixtures.ts            Isolamento de estado e helpers para relógio e estado determinísticos do jogo
|   |-- mobile.spec.ts         Layout 16:9 da arena e controles de toque em viewport mobile
|   |-- naval-shooter.spec.ts  Opções, assets, movimento, combate, inimigos, pausa e ciclo da partida
|   |-- playwright-globals.d.ts Tipos dos controles E2E expostos somente no ambiente de desenvolvimento
|   |-- services.spec.ts       Paginação, falhas, gravação, recuperação, idempotência e respostas fora de ordem
|   |-- visual.spec.ts         Regressões visuais de menu, arena e resultado
|   `-- visual.spec.ts-snapshots/ Baselines PNG versionadas da interface e arena
|-- .gitignore                 Exclui dependências, arquivos gerados pelo build e arquivos de ambiente local
|-- .oxlintrc.json             Regras e configuração do Oxlint para o projeto
|-- ARCHITECTURE.md            Decisões sobre integração React/PixiJS, simulação, dados e ciclo de vida
|-- index.html                 Documento HTML de entrada do Vite, metadados e elemento raiz do React
|-- package.json               Metadados, dependências e scripts npm do projeto
|-- package-lock.json          Versões exatas das dependências npm para instalações reproduzíveis
|-- playwright.config.ts       Configuração de navegador, servidor de testes e relatórios do Playwright
|-- tsconfig.json              Referências entre os projetos TypeScript
|-- tsconfig.app.json          Configurações TypeScript estritas para o código da aplicação no navegador
|-- tsconfig.node.json         Configurações TypeScript para a configuração do Vite
`-- vite.config.ts             Build do Vite/React, configuração do Vitest e divisão dos chunks de saída
```

#### Responsabilidades dos arquivos

- **Entrada e interface da aplicação:** `src/main.tsx` inicia o MSW em desenvolvimento, cria o cliente TanStack Query e monta a aplicação. `src/App.tsx` controla o fluxo de telas e usa as funções da API Axios por meio do TanStack Query. `src/App.css` e `src/index.css` estilizam as telas e definem os estilos globais. `index.html` fornece o documento do navegador onde o Vite monta o React.
- **Execução do jogo:** `src/game/engine.ts` contém o modelo da simulação e a lógica de atualização, separada da renderização. `src/game/GameCanvas.tsx` carrega as texturas necessárias do PixiJS, desenha a arena e as entidades, interpreta os controles de teclado/toque e libera os recursos da aplicação PixiJS ao sair da tela. `src/types/game.ts` fornece os tipos compartilhados dos dados do jogo e da API.
- **Simulação de dados remotos:** `src/api/client.ts` é o módulo de comunicação HTTP e usa Axios. `src/mocks/handlers.ts` fornece dados locais para ranking/histórico e os endpoints; `src/mocks/browser.ts` registra esses endpoints no MSW. `public/mockServiceWorker.js` é gerado pelo MSW e permite executar o service worker no navegador.
- **Configuração e testes:** `src/config.ts` controla os valores padrão, a validação das opções locais e o balanceamento tipado do jogo. Cada partida recebe uma cópia do balanceamento para manter os parâmetros estáveis durante sua execução. `src/config.test.ts`, `src/game/engine.test.ts` e `src/mocks/handlers.test.ts` são testes unitários do Vitest. A suíte Playwright está em `tests/`: `naval-shooter.spec.ts` cobre opções e gameplay, `services.spec.ts` cobre ranking/histórico e persistência, `mobile.spec.ts` cobre o viewport móvel e `visual.spec.ts` compara as telas com baselines versionadas. `fixtures.ts` fornece estado isolado e helpers determinísticos. `playwright.config.ts` separa os projetos Chromium desktop e mobile, gera relatório HTML e preserva traces/screenshots em falhas.
- **Ferramentas:** `package.json` lista React, PixiJS, TanStack Query, Axios, MSW, TypeScript, Vite, Vitest, Oxlint e Playwright, além de definir os comandos de desenvolvimento. `package-lock.json` fixa as versões resolvidas. `tsconfig.json` referencia os projetos TypeScript da aplicação e do Node; os dois arquivos tsconfig referenciados definem as opções de compilação de cada um. `vite.config.ts` configura o Vite e o Vitest. `.oxlintrc.json` configura a análise estática, e `.gitignore` exclui arquivos locais e gerados.
- **Assets gráficos e sonoros:** a pasta raiz `assets/` contém a arte original fornecida e imagens de referência. `assets/png/default/` e `assets/png/retina/` agrupam sprites em resolução padrão e alta densidade; ambas incluem subpastas de efeitos, navios, peças dos navios, tiles e interface. A interface é subdividida em controles, HUD e elementos de menu. `assets/spritesheet/` contém atlases com metadados dos quadros; `assets/tilesheet/` contém atlas de tiles e arquivo de referência; `assets/vector/` contém arte vetorial escalável e arquivos SWF fornecidos. `assets/sounds/` agrupa efeitos WAV por ação do jogo e estado da interface/partida. `src/assets/` contém o subconjunto atualmente importado diretamente pela aplicação.

#### Pastas locais geradas

- `node_modules/` é criada pelo comando `npm ci` e contém as dependências instaladas; não faz parte do código-fonte da aplicação.
- `dist/` é criada pelo comando `npm run build` e contém a versão otimizada do site para produção.
- `playwright-report/` e `test-results/` são geradas pelo Playwright para armazenar o relatório HTML e artefatos da execução, como traces, capturas de tela ou vídeos.

Durante o desenvolvimento, ranking e histórico são simulados pelo MSW; a aplicação não precisa de um serviço de backend. Use `W`/`Arrow Up` para avançar, `A`/`D` ou as setas para girar, `Space` para disparar para a frente e `Q`/`E` para os ataques laterais. Pressione `P` ou `Escape` para pausar. Consulte [ARCHITECTURE.md](./ARCHITECTURE.md) para entender a integração React/PixiJS e o ciclo de vida.
