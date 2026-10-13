// Bibliotecas do painel empacotadas localmente (sem depender de CDN)
import { Replayer } from '@rrweb/replay';
import Player from 'rrweb-player';
import { sankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey';
window.RV = { Replayer, Player, sankey, sankeyLinkHorizontal, sankeyLeft };
