// network.js — rail network model, computed live in the browser.
// Each direct link = fastest scheduled train (2026 timetables incl. the 13 Dec 2026 change),
// verified October 2026. Every change of train costs a fixed, user-set number of minutes.
// Infrastructure projects are applied as segment upgrades or new links in the scenario year
// that follows their official target date (or official + 4 years in "conservative" mode).

const Network = (() => {
  const YEARS = [2026, 2030, 2035, 2040];
  const SCEN = [2030, 2035, 2040];
  const CHECKED = 'October 2026';
  const MAX_MIN = 1200; // > 20 h = no reasonable rail connection

  // ── Source URL helpers ─────────────────────────────────────────────────────
  const kfr = p => `https://www.kombo.co/fr/horaires-train-${p}`;
  const kde = p => `https://www.kombo.co/de/zug-fahrplan-${p}`;
  const kes = p => `https://www.kombo.co/es/horarios-tren-${p}`;
  const tl = (a, b) => `https://www.thetrainline.com/en/train-times/${a}-to-${b}`;
  const bahn = p => `https://www.bahn.de/reisen/view/verbindung/${p}.shtml`;
  const sncf = p => `https://www.sncf-connect.com/de-de/bahn/abfahrtszeiten/${p}`;
  const OEBB = 'https://fahrplan.oebb.at';
  const SBB = 'https://transport.opendata.ch';
  const S61 = p => `https://www.seat61.com/${p}`;

  // ── Cities added to data.js's base 10 (ids 10–40) ──────────────────────────
  const EXTRA_CITIES = [
    [10, 'Lyon', 45.7606, 4.8602, 'Lyon Part-Dieu'], [11, 'Marseille', 43.3026, 5.3806, 'Marseille Saint-Charles'],
    [12, 'Bordeaux', 44.8255, -0.5561, 'Bordeaux Saint-Jean'], [13, 'Zurich', 47.3784, 8.5403, 'Zürich HB'],
    [14, 'Milan', 45.4862, 9.2046, 'Milano Centrale'], [15, 'Munich', 48.1402, 11.5600, 'München Hbf'],
    [16, 'Frankfurt', 50.1070, 8.6637, 'Frankfurt (Main) Hbf'], [17, 'Hamburg', 53.5530, 10.0065, 'Hamburg Hbf'],
    [18, 'Budapest', 47.4979, 19.0793, 'Budapest-Keleti'], [19, 'Prague', 50.0831, 14.4356, 'Praha hlavní nádraží'],
    [20, 'Copenhagen', 55.6726, 12.5641, 'København H'], [21, 'Bologna', 44.5056, 11.3430, 'Bologna Centrale'],
    [22, 'Lille', 50.6392, 3.0756, 'Lille Europe / Flandres'], [23, 'Innsbruck', 47.2633, 11.4008, 'Innsbruck Hbf'],
    [24, 'Florence', 43.7764, 11.2480, 'Firenze Santa Maria Novella'], [25, 'Naples', 40.8530, 14.2722, 'Napoli Centrale'],
    [26, 'Turin', 45.0718, 7.6650, 'Torino Porta Susa'], [27, 'Valencia', 39.4593, -0.3832, 'València Joaquín Sorolla'],
    [28, 'Bilbao', 43.2610, -2.9270, 'Bilbao Abando'], [29, 'Strasbourg', 48.5850, 7.7350, 'Strasbourg'],
    [30, 'Cologne', 50.9430, 6.9589, 'Köln Hbf'], [31, 'Stockholm', 59.3302, 18.0583, 'Stockholm Central'],
    [32, 'Riga', 56.9466, 24.1202, 'Rīga Pasažieru'], [33, 'Vilnius', 54.6704, 25.2839, 'Vilnius'],
    [34, 'Tallinn', 59.4401, 24.7372, 'Tallinn Balti jaam'], [35, 'Oslo', 59.9110, 10.7528, 'Oslo S'],
    [36, 'Gothenburg', 57.7090, 11.9730, 'Göteborg Central'], [37, 'Luxembourg', 49.6000, 6.1340, 'Luxembourg Gare'],
    [38, 'Manchester', 53.4774, -2.2309, 'Manchester Piccadilly'], [39, 'Bari', 41.1178, 16.8695, 'Bari Centrale'],
    [40, 'Lisbon', 38.7678, -9.0990, 'Lisboa Oriente'],
    [41, 'Seville', 37.3917, -5.9750, 'Sevilla Santa Justa'], [42, 'Edinburgh', 55.9520, -3.1890, 'Edinburgh Waverley'],
    [43, 'Bratislava', 48.1588, 17.1063, 'Bratislava hlavná stanica'], [44, 'Ljubljana', 46.0583, 14.5108, 'Ljubljana'],
    [45, 'Zagreb', 45.8047, 15.9787, 'Zagreb Glavni kolodvor'], [46, 'Toulouse', 43.6113, 1.4537, 'Toulouse Matabiau'],
    [47, 'Brno', 49.1903, 16.6128, 'Brno hlavní nádraží'], [48, 'Birmingham', 52.4778, -1.8990, 'Birmingham New Street'],
    [49, 'Łódź', 51.7704, 19.4669, 'Łódź Fabryczna'], [50, 'Poznań', 52.4020, 16.9109, 'Poznań Główny'],
    [51, 'Wrocław', 51.0983, 17.0369, 'Wrocław Główny'],
    [52, 'Stuttgart', 48.7840, 9.1817, 'Stuttgart Hbf'], [53, 'Basel', 47.5476, 7.5897, 'Basel SBB'],
    [54, 'Geneva', 46.2102, 6.1424, 'Genève Cornavin'], [55, 'Nuremberg', 49.4459, 11.0827, 'Nürnberg Hbf'],
    [56, 'Venice', 45.4411, 12.3210, 'Venezia Santa Lucia'], [57, 'Verona', 45.4290, 10.9827, 'Verona Porta Nuova'],
    [58, 'Graz', 47.0723, 15.4170, 'Graz Hbf'], [59, 'Porto', 41.1486, -8.5856, 'Porto Campanhã'],
    [60, 'Kaunas', 54.8854, 23.9093, 'Kaunas'], [61, 'Nice', 43.7046, 7.2617, 'Nice-Ville'],
    [62, 'Dresden', 51.0405, 13.7320, 'Dresden Hbf'], [63, 'Leipzig', 51.3455, 12.3820, 'Leipzig Hbf'],
    [64, 'Hanover', 52.3767, 9.7410, 'Hannover Hbf'], [65, 'Antwerp', 51.2172, 4.4211, 'Antwerpen-Centraal'],
    [66, 'Rotterdam', 51.9249, 4.4690, 'Rotterdam Centraal'],
    [67, 'Helsinki', 60.1719, 24.9414, 'Helsinki', 'Finland\'s only rail link abroad is via Haparanda (Sweden), with cross-border trains since Aug 2026. Helsinki–Stockholm takes ~38–41 h by rail; the overnight ferry is not modelled.'],
    [68, 'Dublin', 53.3530, -6.2460, 'Dublin Connolly', 'Ireland has no rail link to Great Britain or the continent. SailRail via Holyhead combines ferry and rail and is not modelled.'],
    [69, 'Athens', 37.9920, 23.7210, 'Athina (SKA / Larissis)', 'No cross-border passenger trains run from Greece in 2026. Thessaloniki–Sofia passenger rail is planned for 2027 (no journey time stated).'],
    [70, 'Bucharest', 44.4465, 26.0750, 'București Nord', 'Westbound trains are slow: the fastest Bucharest–Budapest train is the overnight Dacia (~15 h).'],
    [71, 'Sofia', 42.7120, 23.3210, 'Sofia Central', 'In 2026 the only international train from Sofia to a city on this map runs to Bucharest (change at Ruse). Trains to Serbia and Greece are suspended.'],
    [72, 'Belgrade', 44.7950, 20.4580, 'Beograd Centar', 'Trains to Zagreb, Sofia and Thessaloniki do not run in 2026; the new Budapest–Belgrade line is the main link.']
  ];
  const CODES = ['PAR','LON','BER','MAD','ROM','AMS','BRU','VIE','WAW','BCN','LYS','MRS','BOD','ZRH','MIL','MUC',
    'FRA','HAM','BUD','PRG','CPH','BLQ','LIL','INN','FLR','NAP','TRN','VLC','BIL','SXB','CGN','STO','RIX','VNO',
    'TLL','OSL','GOT','LUX','MAN','BRI','LIS',
    'SVQ','EDI','BTS','LJU','ZAG','TLS','BRQ','BHX','LCJ','POZ','WRO',
    'STR','BSL','GVA','NUE','VCE','VRN','GRZ','OPO','KUN','NCE','DRS','LEJ','HAJ','ANR','RTM','HEL','DUB','ATH','BUH','SOF','BEG'];

  // Interchange points that are not cities on the map
  const HUBS = {
    MPL: ['Montpellier', 43.6045, 3.8810], OSN: ['Osnabrück', 52.2729, 8.0617], HEN: ['Hendaye/Irun', 43.3532, -1.7836],
    DON: ['San Sebastián', 43.3176, -1.9767], MOK: ['Mockava', 54.0156, 23.4689], VLG: ['Valga', 57.7781, 26.0458],
    BJZ: ['Badajoz', 38.8880, -6.9850], ENT: ['Entroncamento', 39.4675, -8.4697], VGO: ['Vigo', 42.2336, -8.7128],
    VIL: ['Villach', 46.6183, 13.8483], VTG: ['Ventimiglia', 43.7911, 7.6080], SKG: ['Thessaloniki', 40.6447, 22.9306],
    RUS: ['Ruse', 43.8564, 25.9709], OUL: ['Oulu', 65.0121, 25.4682], HAP: ['Haparanda', 65.8353, 24.1350],
    BDN: ['Boden', 65.8250, 21.6890]
  };

  // ── Direct links: [a, b, fastest minutes, confidence h/m/l, source, note] ──
  const EDGES = [
    // France, Benelux, UK
    ['PAR','LON',139,'h',kfr('Paris-Londres'),'Eurostar 9055, 2h19'],
    ['PAR','BRU',82,'h',kfr('Paris-Bruxelles'),'Eurostar, 1h22'],
    ['PAR','AMS',205,'h',kfr('Paris-Amsterdam'),'Eurostar 9415, 3h25'],
    ['PAR','BCN',406,'h',kfr('Barcelone-Paris'),'TGV 9708, 6h46'],
    ['PAR','LYS',113,'h',kfr('Paris-Lyon'),'TGV inOui / Frecciarossa, 1h53'],
    ['PAR','MRS',183,'h',sncf('paris/marseille'),'TGV inOui non-stop, 3h03'],
    ['PAR','BOD',122,'h',sncf('paris/bordeaux'),'Ouigo, 2h02'],
    ['PAR','MPL',192,'h',sncf('paris/montpellier'),'TGV to Montpellier Sud de France, 3h12'],
    ['PAR','ZRH',243,'h',kfr('Paris-Zurich'),'TGV Lyria, 4h03'],
    ['PAR','BSL',179,'h',kfr('Paris-Bale'),'TGV Lyria 9215, 2h59'],
    ['PAR','GVA',197,'h',kfr('Paris-Geneve'),'TGV Lyria, 3h17'],
    ['PAR','FRA',229,'m',kfr('Paris-Francfort'),'ICE 9591, 3h49'],
    ['PAR','STR',189,'h',kfr('Paris-Stuttgart'),'TGV 9577, 3h09'],
    ['PAR','MUC',346,'m',kfr('Paris-Munich'),'TGV 9577 (one a day), 5h46'],
    ['PAR','BER',458,'h',kde('Berlin-Paris'),'ICE 9590 (one a day), 7h38'],
    ['PAR','CGN',200,'m',kfr('Paris-Cologne'),'Eurostar, 3h20'],
    ['PAR','TRN',329,'h',kfr('Paris-Turin'),'TGV 9253 to Porta Susa, 5h29'],
    ['PAR','MIL',397,'h',kfr('Paris-Milan'),'Frecciarossa 9281, 6h37'],
    ['LON','BRU',112,'m',kfr('Bruxelles-Londres'),'Eurostar, 1h52'],
    ['LON','AMS',238,'m','https://everyrail.com/trains/london-to-amsterdam/','Eurostar direct, 3h58'],
    ['BRU','AMS',116,'h',kfr('Amsterdam-Bruxelles'),'Eurostar, 1h56'],
    ['BRU','CGN',101,'h',kfr('Bruxelles-Cologne'),'ICE, 1h41'],
    ['BRU','FRA',173,'m',kfr('Bruxelles-Francfort'),'ICE, 2h53'],
    ['AMS','CGN',151,'m',kde('Amsterdam-Koln'),'ICE, 2h31'],
    ['AMS','FRA',227,'m',kde('Amsterdam-Frankfurt'),'ICE, 3h47'],
    ['AMS','BER',398,'h',kde('Amsterdam-Berlin'),'IC/ICE direct, 6h38'],
    ['AMS','OSN',168,'m',kde('Amsterdam-Osnabruck'),'IC, 2h48'],
    ['LIL','PAR',62,'m',kfr('Lille-Paris'),'TGV, 1h02'],
    ['LIL','LON',81,'h',kfr('Londres-Lille'),'Eurostar, 1h21'],
    ['LIL','BRU',34,'h',sncf('paris/brussel'),'TGV, 34 min'],
    ['LIL','LYS',178,'h',kfr('Lille-Lyon'),'TGV, 2h58'],
    ['LIL','MRS',275,'m',kfr('Lille-Marseille'),'TGV, 4h35'],
    ['LIL','BOD',273,'m',kfr('Lille-Bordeaux'),'TGV (2 a day), 4h33'],
    ['LIL','SXB',174,'h',kfr('Lille-Strasbourg'),'TGV 9874, 2h54'],
    ['SXB','PAR',103,'h',kfr('Strasbourg-Paris'),'TGV/ICE, 1h43'],
    ['SXB','FRA',107,'m',kfr('Strasbourg-Francfort'),'ICE 9591, 1h47'],
    ['SXB','STR',78,'h',kfr('Strasbourg-Stuttgart'),'TGV 9577, 1h18'],
    ['SXB','MUC',235,'m',kfr('Strasbourg-Munich'),'TGV 9577, 3h55'],
    ['SXB','BSL',77,'m',kfr('Strasbourg-Bale'),'TER, 1h17'],
    ['SXB','LUX',95,'h',kfr('Strasbourg-Luxembourg'),'TGV 9896 (2 a day), 1h35'],
    ['SXB','LYS',214,'h',kfr('Strasbourg-Lyon'),'TGV, 3h34'],
    ['SXB','MRS',331,'m',kfr('Strasbourg-Marseille'),'TGV, 5h31'],
    ['LUX','PAR',129,'h',kfr('Luxembourg-Paris'),'TGV, 2h09'],
    ['LUX','BRU',192,'m',kfr('Luxembourg-Bruxelles'),'SNCB IC, 3h12 (engineering works)'],
    ['LUX','CGN',210,'l','https://en.paperjam.lu/article/regular-direct-train-to-cologn','No direct train: ~3h30 including a change at Trier/Koblenz'],
    ['LON','MAN',119,'m','https://www.trainline.com/train-times/london-euston-to-manchester-piccadilly','Avanti from Euston, 1h59'],
    // Iberia and southern France
    ['MAD','BCN',182,'m',kes('Madrid-Barcelona'),'Iryo, 3h02: 2026 speed limits after the Adamuz accident (2h30 before)'],
    ['MAD','MRS',494,'m',kes('Madrid-Marsella'),'Renfe AVE (one a day), 8h14'],
    ['MAD','HEN',342,'m',kes('Madrid-Irun'),'Alvia to Irun, 5h42'],
    ['BOD','HEN',145,'m',kfr('Bordeaux-Hendaye'),'TGV inOui, 2h25'],
    ['BOD','MPL',282,'m',kfr('Bordeaux-Montpellier'),'Intercités via Toulouse, 4h42'],
    ['BCN','MPL',186,'m',kes('Barcelona-Montpellier'),'AVE / TGV, 3h06'],
    ['BCN','LYS',306,'m',kes('Barcelona-Lyon'),'Renfe AVE (one a day), 5h06'],
    ['BCN','MRS',278,'m',kes('Barcelona-Marsella'),'Renfe AVE (one a day), 4h38'],
    ['LYS','MRS',99,'m',kfr('Lyon-Marseille'),'TGV, 1h39'],
    ['LYS','MPL',95,'m',kfr('Lyon-Montpellier'),'TGV, 1h35'],
    ['MRS','MPL',85,'m',kfr('Marseille-Montpellier'),'TGV, 1h25'],
    ['LYS','GVA',110,'m',kfr('Lyon-Geneve'),'TER/TGV, 1h50'],
    ['LYS','TRN',229,'m',kfr('Lyon-Turin'),'Frecciarossa 9281, 3h49'],
    ['LYS','MIL',276,'m',kfr('Lyon-Milan'),'Frecciarossa 9281, 4h36'],
    ['MAD','VLC',114,'m',kes('Madrid-Valencia'),'AVE/Iryo/Ouigo, 1h54 (2026 speed limits)'],
    ['BCN','VLC',167,'m',kes('Barcelona-Valencia'),'Euromed, 2h47'],
    ['MAD','BIL',310,'m',kes('Madrid-Bilbao'),'Alvia, 5h10'],
    ['BCN','BIL',423,'m',kes('Barcelona-Bilbao'),'Alvia (one a day), 7h03'],
    ['BIL','DON',155,'l','https://everyrail.com/spain/euskotren/','Euskotren E1, ~2h35'],
    ['DON','HEN',35,'l','https://everyrail.com/spain/euskotren/','Euskotren E2, ~35 min'],
    ['LIS','ENT',62,'h','https://www.cp.pt/info/documents/d/cp/comboios-regionais-linha-leste-badajoz','Alfa/IC leg of the 3h44 Lisbon–Badajoz CP itinerary'],
    ['ENT','BJZ',152,'h','https://www.cp.pt/info/documents/d/cp/comboios-regionais-linha-leste-badajoz','Regional leg of the Lisbon–Badajoz itinerary'],
    ['BJZ','MAD',257,'m',kes('Badajoz-Madrid'),'Alvia, 4h17'],
    ['LIS','OPO',159,'m','https://everyrail.com/trains/lisbon-to-porto/','Alfa Pendular from Oriente, 2h39'],
    ['OPO','VGO',210,'m',kes('Oporto-Vigo'),'Celta, 3h30'],
    ['VGO','MAD',235,'m',kes('Vigo-Madrid'),'AVE, 3h55'],
    // Germany, Switzerland, Austria, Czechia, Hungary, Poland
    ['OSN','HAM',109,'h',bahn('hamburg/osnabrueck'),'ICE, 1h49'],
    ['GVA','ZRH',173,'h',SBB,'IC1, 2h53'],
    ['ZRH','BSL',52,'h',SBB,'IC3, 52 min'],
    ['ZRH','MUC',212,'h',OEBB,'EC, 3h32'],
    ['ZRH','FRA',238,'h',OEBB,'EC 151, 3h58'],
    ['ZRH','STR',175,'h',bahn('stuttgart/zuerich'),'IC, 2h55'],
    ['ZRH','VIE',472,'h',OEBB,'Railjet, 7h52 (Dec 2026 timetable)'],
    ['ZRH','INN',217,'h',OEBB,'Railjet, 3h37'],
    ['BSL','FRA',170,'h',OEBB,'EC/ICE, 2h50'],
    ['INN','MUC',112,'h',OEBB,'Railjet, 1h52'],
    ['INN','VIE',255,'h',OEBB,'Railjet, 4h15 (Dec 2026 timetable)'],
    ['FRA','CGN',65,'h',bahn('frankfurt/koeln'),'ICE, 1h05'],
    ['FRA','STR',77,'h',bahn('stuttgart/frankfurt'),'ICE, 1h17'],
    ['FRA','MUC',189,'h',OEBB,'ICE, 3h09 (Dec 2026 timetable)'],
    ['FRA','NUE',121,'h',OEBB,'ICE, 2h01'],
    ['FRA','BER',224,'h',OEBB,'ICE, 3h44 (usually 4h01)'],
    ['FRA','HAM',213,'h',bahn('hamburg/frankfurt'),'ICE, 3h33'],
    ['STR','MUC',113,'h',bahn('muenchen/stuttgart'),'ICE, 1h53'],
    ['NUE','MUC',63,'h',OEBB,'ICE, 1h03 (Dec 2026 timetable)'],
    ['NUE','BER',163,'h',bahn('berlin/nuernberg'),'ICE, 2h43'],
    ['NUE','VIE',252,'h',OEBB,'New direct ICE, 4h12 (Dec 2026 timetable)'],
    ['CGN','BER',332,'h',OEBB,'ICE, 5h32'],
    ['CGN','HAM',215,'h',bahn('koeln/hamburg'),'ICE, 3h35'],
    ['CGN','MUC',250,'h',OEBB,'ICE, 4h10'],
    ['BER','HAM',107,'h',bahn('berlin/hamburg'),'ICE, 1h47 (line reopened June 2026)'],
    ['BER','MUC',233,'h',OEBB,'ICE Sprinter, 3h53 (Dec 2026 timetable)'],
    ['BER','WAW',309,'h',OEBB,'EC Berlin–Warszawa Express, 5h09 (Dec 2026 timetable)'],
    ['BER','PRG',237,'h',OEBB,'Railjet/EC, 3h57'],
    ['BER','VIE',501,'h',OEBB,'Railjet via Prague, 8h21'],
    ['HAM','MUC',322,'h',OEBB,'ICE, 5h22 (Dec 2026 timetable)'],
    ['HAM','PRG',351,'h',OEBB,'Railjet/EC, 5h51'],
    ['MUC','VIE',243,'h',OEBB,'Railjet, 4h03 (Dec 2026 timetable)'],
    ['MUC','PRG',337,'h',OEBB,'Express via Plzeň, 5h37'],
    ['MUC','BUD',433,'h',OEBB,'Railjet, 7h13'],
    ['VIE','BUD',167,'h',OEBB,'EC/Railjet to Keleti, 2h47'],
    ['VIE','PRG',252,'h',OEBB,'Railjet, 4h12'],
    ['VIE','WAW',449,'h',OEBB,'EC, 7h29 (Dec 2026 timetable)'],
    ['PRG','BUD',411,'h',OEBB,'Railjet/EC, 6h51'],
    ['PRG','WAW',504,'h',OEBB,'IC direct, 8h24'],
    // Italy and Alpine crossings
    ['TRN','MIL',45,'m',tl('torino-porta-susa','milano-centrale'),'Frecciarossa non-stop from Porta Susa, 45 min'],
    ['TRN','ROM',251,'m',tl('torino-porta-susa','roma-termini'),'Frecciarossa, 4h11'],
    ['MIL','ROM',170,'h','https://www.trenitalia.com/it/frecciarossa/collegamenti-frecciarossa/viaggia-tra-roma-e-milano-con-frecciarossa.html','Frecciarossa non-stop, 2h50'],
    ['MIL','BLQ',64,'m',tl('milano-centrale','bologna-centrale'),'Frecciarossa, 1h04'],
    ['MIL','VCE',149,'m',tl('milano-centrale','venezia-santa-lucia'),'Frecciarossa, 2h29'],
    ['MIL','VRN',70,'m',tl('milano-centrale','verona-porta-nuova'),'Frecciarossa, 1h10'],
    ['BLQ','ROM',123,'m',tl('bologna-centrale','roma-termini'),'Frecciarossa, 2h03'],
    ['VRN','BLQ',51,'m',tl('verona-porta-nuova','bologna-centrale'),'Frecciarossa, 51 min'],
    ['VRN','ROM',198,'m',tl('verona-porta-nuova','roma-termini'),'Frecciarossa, 3h18'],
    ['VCE','ROM',231,'m',tl('venezia-santa-lucia','roma-termini'),'Frecciarossa, 3h51'],
    ['VRN','MUC',333,'m',tl('verona-porta-nuova','munchen-hbf'),'ÖBB/DB EC via Brenner, 5h33'],
    ['VRN','INN',211,'m',tl('verona-porta-nuova','innsbruck-hbf'),'EC, 3h31'],
    ['VCE','VIE',435,'m','https://www.vienna.at/new-oebb-timetable-this-changes-from-december/9674177','Railjet via Koralm line (opened Dec 2025), 7h15'],
    ['GVA','MIL',263,'m',tl('geneve','milano-centrale'),'EC (3 a day), 4h23'],
    ['ZRH','MIL',197,'m',tl('zurich-hb','milano-centrale'),'EC via Gotthard, 3h17'],
    ['BSL','MIL',265,'m',tl('basel-sbb','milano-centrale'),'EC, 4h25'],
    ['BLQ','FLR',37,'m',tl('bologna-centrale','firenze-santa-maria-novella'),'Frecciarossa, 37 min'],
    ['BLQ','VCE',93,'m',tl('bologna-centrale','venezia-santa-lucia'),'Frecciarossa, 1h33'],
    ['BLQ','NAP',211,'m',tl('bologna-centrale','napoli-centrale'),'Frecciarossa, 3h31'],
    ['BLQ','BRI',339,'m',tl('bologna-centrale','bari-centrale'),'Frecciarossa (Adriatic), 5h39'],
    ['BLQ','TRN',123,'m',tl('bologna-centrale','torino-porta-susa'),'Frecciarossa, 2h03'],
    ['MIL','FLR',114,'m',tl('milano-centrale','firenze-santa-maria-novella'),'Frecciarossa, 1h54'],
    ['FLR','ROM',90,'m',tl('firenze-santa-maria-novella','roma-termini'),'Frecciarossa, 1h30'],
    ['FLR','NAP',183,'m',tl('firenze-santa-maria-novella','napoli-centrale'),'Frecciarossa, 3h03'],
    ['FLR','VCE',134,'m',tl('firenze-santa-maria-novella','venezia-santa-lucia'),'Frecciarossa, 2h14'],
    ['FLR','TRN',174,'m',tl('firenze-santa-maria-novella','torino-porta-susa'),'Frecciarossa, 2h54'],
    ['ROM','NAP',73,'m',tl('roma-termini','napoli-centrale'),'Frecciarossa, 1h13'],
    ['MIL','NAP',273,'m',tl('milano-centrale','napoli-centrale'),'Frecciarossa, 4h33'],
    ['ROM','BRI',254,'m',tl('roma-termini','bari-centrale'),'Frecciarossa, 4h14'],
    ['NAP','BRI',214,'m','https://www.trenitalia.com/it/chi-siamo/comunicati-stampa/20260530-frecciarossa-diretto-lecce-napoli.html','Frecciarossa via Naples–Cancello link (from July 2026), 3h34'],
    ['MIL','BRI',412,'m',tl('milano-centrale','bari-centrale'),'Frecciarossa, 6h52'],
    // Nordics and Baltics
    ['BER','CPH',421,'h','https://www.vagonweb.cz/razeni/vlak.php?zeme=CD&kategorie=rj&cislo=383&rok=2026','ČD ComfortJet, 7h01'],
    ['HAM','CPH',274,'h',S61('trains-and-routes/hamburg-to-copenhagen-by-train.htm'),'DSB/DB via Jutland, 4h34'],
    ['PRG','CPH',663,'h','https://www.vagonweb.cz/razeni/vlak.php?zeme=CD&kategorie=rj&cislo=385&rok=2026','ČD ComfortJet, 11h03'],
    ['CPH','GOT',210,'h','https://www.oresundstag.se','Öresundståg, 3h30'],
    ['GOT','OSL',206,'h','https://www.vy.no','Vy RE20, 3h26'],
    ['STO','GOT',203,'m','https://www.omio.se/tag/stockholm/goteborg','SJ, 3h23 (track works; ~3h01 normally)'],
    ['CPH','STO',315,'m',S61('trains-and-routes/copenhagen-to-stockholm-by-train.htm'),'SJ X2000 ~5h15 when running (suspended to 13 Dec 2026; Snälltåget 6h03 meanwhile)'],
    ['STO','OSL',330,'h','https://www.sj.se','SJ, 5h30'],
    ['WAW','MOK',286,'m',S61('trains-and-routes/warsaw-to-vilnius-by-train.htm'),'PKP IC Hańcza to the border, 4h46'],
    ['MOK','VNO',137,'m',S61('trains-and-routes/warsaw-to-vilnius-by-train.htm'),'LTG Link, 2h17'],
    ['VNO','RIX',277,'m',S61('trains-and-routes/vilnius-riga-tallinn-by-train.htm'),'LTG Link, 4h37'],
    ['RIX','VLG',123,'m',S61('trains-and-routes/vilnius-riga-tallinn-by-train.htm'),'Vivi/Elron, 2h03'],
    ['VLG','TLL',207,'m',S61('trains-and-routes/vilnius-riga-tallinn-by-train.htm'),'Elron, 3h27'],
    ['RIX','TLL',348,'m','https://vivi.lv/en/news/267/regular-train-service-launched-on-the-tallinn-tartu-riga-route/','Direct Elron Riga–Tallinn (since Jan 2026), 5h48'],
    // Seville, Toulouse, UK
    ['SVQ','MAD',156,'h',tl('seville','madrid'),'AVE, 2h36 (line under renovation; ~2h21–2h30 before 2026)'],
    ['SVQ','BCN',377,'m',tl('barcelona','seville'),'AVE/Ouigo/Iryo direct, 6h17'],
    ['SVQ','VLC',262,'h',tl('seville','valencia'),'AVE direct, 4h22'],
    ['TLS','PAR',275,'m','https://www.sncf-connect.com/train/trajet/toulouse/paris','TGV inOui to Montparnasse, 4h35'],
    ['TLS','BOD',140,'m','https://www.sncf-connect.com/train/trajet/bordeaux/toulouse','TGV/Intercités, 2h20'],
    ['TLS','MPL',130,'h','https://www.sncf-connect.com/train/trajet/toulouse/montpellier','TGV/Intercités, 2h10'],
    ['TLS','MRS',234,'h','https://www.sncf-connect.com/train/trajet/toulouse/marseille','Intercités, 3h54'],
    ['TLS','LYS',235,'h','https://www.sncf-connect.com/train/trajet/toulouse/lyon','TGV inOui, 3h55'],
    ['EDI','LON',249,'m',tl('edinburgh','london'),'LNER to King\'s Cross, 4h09 (Dec 2025 timetable)'],
    ['EDI','MAN',189,'m',tl('edinburgh','manchester-piccadilly'),'TransPennine Express, 3h09'],
    ['EDI','BHX',246,'m',tl('edinburgh','birmingham'),'Avanti/CrossCountry, 4h06'],
    ['BHX','LON',79,'m',tl('birmingham','london-euston'),'Avanti to Euston, 1h19'],
    ['BHX','MAN',87,'h',tl('birmingham-new-street','manchester-piccadilly'),'Avanti/CrossCountry, 1h27'],
    // Bratislava, Brno, Ljubljana, Zagreb, Austrian south
    ['BTS','VIE',47,'h',OEBB,'New non-stop RJX/EC via Marchegg, 47 min (Dec 2026 timetable)'],
    ['BTS','BUD',143,'h',OEBB,'Railjet to Keleti, 2h23'],
    ['BTS','PRG',265,'h',OEBB,'EC/Railjet, 4h25'],
    ['BTS','BRQ',100,'h',OEBB,'RegioJet, 1h40'],
    ['BTS','WAW',493,'m',OEBB,'IC 131, 8h13 (Dec 2026 timetable)'],
    ['BTS','BER',510,'m',OEBB,'New daytime Railjet, 8h30 (Dec 2026 timetable)'],
    ['BRQ','PRG',156,'h',OEBB,'ČD Railjet, 2h36'],
    ['BRQ','VIE',90,'h',OEBB,'RegioJet/ČD Railjet, 1h30'],
    ['BRQ','BUD',250,'h',OEBB,'Railjet, 4h10'],
    ['BRQ','BER',402,'h',OEBB,'Railjet, 6h42 (Dec 2026 timetable)'],
    ['LJU','ZAG',135,'h','https://potniski.sz.si/en/zagreb/','IR/EC, 2h15'],
    ['LJU','VIE',360,'h','https://potniski.sz.si/en/vienna/','EC Emona via Graz, 6h00'],
    ['LJU','MUC',375,'m','https://potniski.sz.si/en/international-travel/germany-d/munich/','EC, 6h15'],
    ['LJU','BUD',464,'m','https://potniski.sz.si/en/budapest/','MÁV via Hodoš, 7h44'],
    ['LJU','GRZ',190,'h',OEBB,'IR, 3h10'],
    ['LJU','VIL',91,'h',OEBB,'SŽ IR via Karawanken tunnel, 1h31'],
    ['ZAG','BUD',354,'m','https://hzpp.hr/en/international/hungary','IC, 5h54 (one a day)'],
    ['ZAG','VIE',387,'h','https://hzpp.hr/en/international/vienna','EC via Maribor/Graz, 6h27'],
    ['ZAG','MUC',534,'m','https://hzpp.hr/en/international/germany','EC, 8h54 (Dec 2026 timetable)'],
    ['ZAG','GRZ',232,'h',OEBB,'EC, 3h52'],
    ['ZAG','VIL',251,'m',OEBB,'IR via Ljubljana, 4h11'],
    ['VIE','GRZ',146,'h',OEBB,'Railjet, 2h26'],
    ['GRZ','VIL',65,'h',OEBB,'Railjet via Koralm line, 1h05'],
    ['VIL','MUC',252,'h',OEBB,'EC/ICE via Salzburg, 4h12'],
    ['VIL','VCE',202,'h',OEBB,'Railjet, 3h22'],
    // Poland
    ['WAW','LCJ',65,'h',OEBB,'IC to Łódź Fabryczna, 1h05'],
    ['WAW','POZ',136,'h','https://www.intercity.pl/pl/site/o-nas/dzial-prasowy/aktualnosci/nowosci-w-rocznym-rozkladzie-jazdy-pkp-intercity-dla-wojewodztwa-wielkopolskiego.html','EIP, 2h16'],
    ['WAW','WRO',207,'h','https://www.intercity.pl/pl/site/o-nas/dzial-prasowy/aktualnosci/pkp-intercity:-nowy-rozklad-jazdy-2026/2027-dla-wojewodztwa-dolnoslaskiego.html','EIC, 3h27 (Dec 2026 timetable)'],
    ['LCJ','POZ',160,'m',OEBB,'IC from Łódź Kaliska, 2h40'],
    ['LCJ','WRO',178,'m',OEBB,'IC from Łódź Widzew, 2h58'],
    ['POZ','WRO',76,'h',OEBB,'IC, 1h16'],
    ['POZ','BER',152,'h',OEBB,'EC to Berlin Hbf, 2h32 (Dec 2026 timetable)'],
    ['WRO','BER',235,'h',OEBB,'EC to Berlin Hbf, 3h55 (Dec 2026 timetable)'],
    ['WRO','PRG',236,'h',OEBB,'IC/EC via Kłodzko, 3h56'],
    ['WRO','VIE',311,'h',OEBB,'EC via Ostrava, 5h11'],
    ['POZ','PRG',340,'h',OEBB,'EC Baltic Express, 5h40'],
    ['POZ','VIE',392,'h',OEBB,'EC Danubius, 6h32'],
    // Germany, Benelux, Switzerland (new cities; Dec 2026 timetable via ÖBB planner)
    ['STR','CGN',136,'h',OEBB,'ICE, 2h16 (Dec 2026 timetable)'],
    ['STR','HAM',306,'h',OEBB,'ICE, 5h06'],
    ['STR','BER',284,'h',OEBB,'ICE via Nuremberg–Erfurt, 4h44 (Dec 2026 timetable)'],
    ['STR','NUE',114,'h',OEBB,'ICE, 1h54 (Dec 2026 timetable)'],
    ['STR','LEJ',260,'h',OEBB,'ICE, 4h20 (Dec 2026 timetable)'],
    ['STR','BSL',162,'m',OEBB,'ICE (one a day), 2h42 (Dec 2026 timetable)'],
    ['STR','HAJ',222,'h',OEBB,'ICE, 3h42'],
    ['BSL','CGN',229,'h',OEBB,'ICE, 3h49 (Dec 2026 timetable)'],
    ['BSL','HAM',403,'h',OEBB,'EC/ICE, 6h43 (Dec 2026 timetable)'],
    ['BSL','BER',424,'h',OEBB,'ICE, 7h04 (Dec 2026 timetable)'],
    ['BSL','HAJ',316,'h',OEBB,'ICE, 5h16 (Dec 2026 timetable)'],
    ['NUE','HAM',249,'h',OEBB,'ICE via Würzburg–Hanover, 4h09 (Dec 2026 timetable)'],
    ['NUE','LEJ',117,'h',OEBB,'ICE, 1h57 (Dec 2026 timetable)'],
    ['NUE','HAJ',168,'h',OEBB,'ICE, 2h48 (Dec 2026 timetable)'],
    ['NUE','CGN',202,'m',OEBB,'ICE (evening), 3h22'],
    ['DRS','BER',95,'h',OEBB,'Railjet, 1h35 (Dec 2026 timetable)'],
    ['DRS','PRG',135,'h',OEBB,'Railjet, 2h15 (Dec 2026 timetable)'],
    ['DRS','LEJ',62,'h',OEBB,'ICE, 1h02 (Dec 2026 timetable)'],
    ['DRS','HAM',211,'h',OEBB,'Railjet via Berlin, 3h31 (Dec 2026 timetable)'],
    ['DRS','FRA',263,'h',OEBB,'ICE, 4h23 (Dec 2026 timetable)'],
    ['DRS','VIE',399,'h',OEBB,'Railjet via Prague, 6h39 (Dec 2026 timetable)'],
    ['LEJ','BER',73,'h',OEBB,'ICE, 1h13 (Dec 2026 timetable)'],
    ['LEJ','MUC',186,'h',OEBB,'ICE, 3h06 (Dec 2026 timetable)'],
    ['LEJ','FRA',174,'h',OEBB,'ICE, 2h54 (Dec 2026 timetable)'],
    ['LEJ','HAM',191,'h',OEBB,'ICE, 3h11 (Dec 2026 timetable)'],
    ['LEJ','CGN',345,'m',OEBB,'ICE (few a day), 5h45'],
    ['HAJ','HAM',75,'h',OEBB,'ICE, 1h15 (Dec 2026 timetable)'],
    ['HAJ','BER',166,'h','https://www.infranken.de/deutschland/berlin-hannover-80-minuten-mehr-fahrzeit-bis-ende-2027-art-6394443','ICE diverted via Magdeburg, 2h46 (Hanover–Berlin line closed Oct 2026–Dec 2027; normally ~1h36)'],
    ['HAJ','FRA',135,'h',OEBB,'ICE, 2h15 (Dec 2026 timetable)'],
    ['HAJ','CGN',154,'h',OEBB,'ICE, 2h34 (Dec 2026 timetable)'],
    ['HAJ','MUC',244,'h',OEBB,'ICE, 4h04 (Dec 2026 timetable)'],
    ['HAJ','AMS',243,'m',OEBB,'IC/ICE via Osnabrück (2 a day), 4h03'],
    ['HAJ','OSN',68,'h',OEBB,'ICE/IC, 1h08 (Dec 2026 timetable)'],
    ['ANR','BRU',33,'h',OEBB,'Eurostar (ex-Thalys), 33 min'],
    ['ANR','AMS',80,'h',OEBB,'Eurostar (ex-Thalys), 1h20 (Dec 2026 timetable)'],
    ['ANR','RTM',32,'h',OEBB,'Eurostar (ex-Thalys), 32 min (Dec 2026 timetable)'],
    ['ANR','PAR',122,'h',OEBB,'Eurostar (ex-Thalys) to Paris Nord, 2h02 (Dec 2026 timetable)'],
    ['ANR','LON',161,'m','https://traveltomorrow.com/eurostar-to-launch-new-direct-london-to-antwerp-service-from-december-2026/','New Eurostar London→Antwerp stop from 14 Dec 2026, 2h41 (London→Antwerp only)'],
    ['ANR','CGN',143,'m',OEBB,'ICE (1–2 a day), 2h23 (Dec 2026 timetable)'],
    ['RTM','AMS',44,'h',OEBB,'Eurostar / NS Intercity Direct, 44 min'],
    ['RTM','BRU',68,'h',OEBB,'Eurostar (ex-Thalys), 1h08 (Dec 2026 timetable)'],
    ['RTM','PAR',157,'h',OEBB,'Eurostar (ex-Thalys) to Paris Nord, 2h37 (Dec 2026 timetable)'],
    ['RTM','LON',196,'m',S61('trains-and-routes/london-to-amsterdam-by-eurostar.htm'),'Eurostar, 3h16'],
    // Italy, Austria, France (Riviera)
    ['VCE','TRN',217,'h',OEBB,'Frecciarossa, 3h37 (Dec 2026 timetable)'],
    ['VCE','NAP',322,'h',OEBB,'Frecciarossa, 5h22'],
    ['VRN','VCE',72,'h',OEBB,'Frecciarossa, 1h12'],
    ['VRN','FLR',91,'h',OEBB,'Frecciarossa, 1h31'],
    ['VRN','TRN',134,'h',OEBB,'Frecciarossa, 2h14'],
    ['VRN','NAP',281,'m',OEBB,'Frecciarossa (one a day), 4h41'],
    ['VCE','MUC',412,'h',OEBB,'Railjet via Brenner (2 a day), 6h52'],
    ['GRZ','BUD',289,'h',OEBB,'IC via Szombathely (2 a day), 4h49'],
    ['GRZ','MUC',338,'h',OEBB,'ICE/RJ via Koralm line and Salzburg, 5h38'],
    ['GRZ','VCE',281,'h',OEBB,'Railjet via Koralm line, 4h41'],
    ['GRZ','INN',350,'h',OEBB,'EC Transalpin via Selzthal, 5h50'],
    ['NCE','MRS',147,'h',OEBB,'TER, 2h27 (TGV 2h34)'],
    ['NCE','PAR',342,'h',OEBB,'Ouigo, 5h42'],
    ['NCE','LYS',271,'h',OEBB,'TGV (about 2 a day), 4h31'],
    ['NCE','VTG',40,'l',S61('trains-and-routes/nice-to-italy-by-train.htm'),'TER to Ventimiglia, ~40 min (Nice–Milan 5h04 with a change)'],
    ['VTG','MIL',254,'l',S61('trains-and-routes/nice-to-italy-by-train.htm'),'Trenitalia IC Ventimiglia–Milan, ~4h14'],
    // Balkans, Greece, Romania
    ['BEG','BUD',197,'m',S61('trains-and-routes/budapest-to-belgrade-by-train.htm'),'Planned direct SOKO trains on the new line from 13 Dec 2026, 3h17 (start has slipped several times; until then ~6h09 with two changes)'],
    ['BEG','VIE',400,'m','https://www.oebb.at/de/neuigkeiten/fahrplan-2027','EC Avala via Budapest from Dec 2026, 6h40'],
    ['ATH','SKG',312,'m',OEBB,'Hellenic Train IC, 5h12 (reduced timetable during Thessaly reconstruction; ~4h15 before 2023)'],
    ['SOF','RUS',392,'h',S61('international-trains/trains-from-Sofia.htm'),'BDŽ to Ruse, 6h32'],
    ['RUS','BUH',161,'h',S61('international-trains/trains-from-Sofia.htm'),'CFR Ruse–Bucharest, 2h41'],
    ['BUH','BUD',897,'h',OEBB,'Overnight D 346 Dacia, 14h57 (fastest day train 16h21)'],
    ['BUH','VIE',1073,'m',S61('international-trains/trains-from-Bucharest.htm'),'Overnight D 346 Dacia, 17h53'],
    // Baltics, Finland
    ['KUN','VNO',59,'h','https://sumin.lrv.lt/en/news/from-vilnius-to-kaunas-without-stops-ltg-link-express-train-began-operating-on-march-29-aMfX','LTG Link non-stop express (since Mar 2026), 59 min'],
    ['KUN','MOK',73,'h',S61('trains-and-routes/warsaw-to-vilnius-by-train.htm'),'LTG Link to the border, 1h13 (then PKP IC to Warsaw)'],
    ['HEL','OUL',318,'l','https://www.vr.fi/en','VR Pendolino/IC Helsinki–Oulu, ~5h18 (estimate)'],
    ['OUL','HAP',100,'h','https://www.vr.fi/en/news/2026/06/25/sweden-soon-reachable-from-finland-by-train-traffic-to-haparanda-begins-in-august','VR IC to Haparanda (since Aug 2026), 1h40'],
    ['HAP','BDN',91,'h',S61('international-trains/trains-from-Helsinki.htm'),'Norrtåg regional, 1h31'],
    ['BDN','STO',972,'m',S61('international-trains/trains-from-Helsinki.htm'),'SJ overnight sleeper, 16h12']
  ];

  // ── Infrastructure projects (official pages and dates, checked October 2026) ──
  const P = (id, name, shortName, year, official, url, description, status, dateSource) =>
    ({ id, name, shortName, year, official, url, description, status, dateSource });
  const PROJECTS = Object.fromEntries([
    P('spain-limits', 'End of 2026 Spanish high-speed speed limits', 'Spanish HSL limits lifted', 2027, 'Limits announced until end of 2026',
      'https://en.ara.cat/politics/the-25-minute-increase-in-travel-time-between-madrid-and-barcelona-will-be-extended-until-the-end-of-the-year_1_5639216.html',
      'Temporary Adif speed restrictions imposed after the January 2026 Adamuz accident add ~30 min to Madrid–Barcelona and ~15 min to Madrid–Valencia.',
      'Restrictions extended to the end of 2026; normal running assumed from 2027.', ''),
    P('deutschlandtakt', 'Deutschlandtakt (stages to 2030 and 2035)', 'Deutschlandtakt', 2030, 'Staged; next stage 2030 (not a completion date)',
      'https://www.deutschlandtakt.de/', 'Germany\'s integrated national clock-face timetable, delivered through staged infrastructure upgrades. Modelled as −5% on German links by 2030 and a further −3% by 2035.',
      'Official FAQ: 2030 is a stage, not a completion date; target timetable being revised against the 2040 forecast.', 'https://www.deutschlandtakt.de/faqs/'),
    P('deutschlandtakt-full', 'Deutschlandtakt (full target network)', 'Deutschlandtakt (full)', 2040, 'Target network aligned to the 2040 forecast',
      'https://www.deutschlandtakt.de/', 'Full target network including new lines on bottleneck corridors. Modelled as a further −4% on German links.',
      'No official completion year.', 'https://www.deutschlandtakt.de/faqs/'),
    P('stuttgart21', 'Stuttgart 21', 'Stuttgart 21', 2031, 'Main station Dec 2031 (staged Dec 2027–2033)',
      'https://www.bahnprojekt-stuttgart-ulm.de/projekt-en', 'New underground through-station and approach tunnels, fully exploiting the Wendlingen–Ulm line. Stated saving ~15 min for through trains (e.g. Stuttgart–Munich, Paris–Munich).',
      'DB reset (June 2026): December 2026 dropped; airport station Dec 2030, main station Dec 2031, final stages to 2033.',
      'https://www.deutschebahn.com/de/presse/pressestart_zentrales_uebersicht/Stuttgart-21-Deutsche-Bahn-stellt-Inbetriebnahmeplan-neu-auf--13956556'),
    P('rastatt', 'Karlsruhe–Offenburg new line: Rastatt section', 'Rastatt section', 2027, 'TT2027 (December 2026)',
      'https://www.karlsruhe-basel.de/', 'Continuous four tracks between Karlsruhe and Offenburg with 250 km/h running through the Rastatt tunnel; ~3 min saved on Rhine Valley long-distance services (Frankfurt/Karlsruhe–Basel, Strasbourg/Paris–Stuttgart/Munich).',
      'Listed for TT2027 (Dec 2026) in the RNE Common Capacity Strategy TT2030; not yet reflected in the Oct–Nov 2026 timetable samples used for the 2026 baseline, so it counts from 2030.',
      'https://rne.eu/wp-content/uploads/Draft-_Common-Capacity-Strategy-TT-2030.pdf'),
    P('lyon-turin', 'Lyon–Turin base tunnel', 'Lyon–Turin', 2033, 'End of 2033',
      'https://www.telt.eu/en/project/understand-the-lyon-turin-project', '57.5 km base tunnel under the Alps; Lyon–Turin ~1h55 and Paris–Milan ~4h with full access lines.',
      'About 30% complete; 49.8 of 164 km of tunnels dug (Oct 2026). Date fixed in the EU implementing decision (July 2025).',
      'https://www.telt.eu/en/highlight/telt-replies-to-the-2025-eu-court-of-auditors-report'),
    P('brenner', 'Brenner Base Tunnel', 'Brenner Base Tunnel', 2034, '2034 (delay announced 20 Oct 2026)',
      'https://www.bbt-se.com/en/brenner-base-tunnel/project-overview/', '55 km tunnel Innsbruck–Fortezza; cuts ~1 hour from Munich–Verona.',
      'New delay announced 20 October 2026 (was 2032): works finish 2033, then a year of commissioning; cost ~€11.7bn.',
      'https://www.bbt-se.com/newsroom/detail/vom-tunnel-zum-bahnsystem-neuplanung-staerkt-sicherheit-des-infrastrukturprojekts-und-bringt-anpassung-von-bauzeiten-und-kosten/'),
    P('semmering', 'Semmering Base Tunnel', 'Semmering Base Tunnel', 2029, 'End of 2029',
      'https://infrastruktur.oebb.at/en/projects-for-austria/railway-lines/southern-line-vienna-villach/semmering-base-tunnel', '27 km tunnel on Austria\'s Southern Railway. ÖBB states Vienna–Graz in under 2 hours (now 2h26) and Vienna–Klagenfurt 2h45 (now 3h10), i.e. ~25 min off journeys south of Vienna (Venice, Ljubljana, Zagreb).',
      'Excavation finished 2024; rail systems being fitted.', 'https://infrastruktur.oebb.at/en/projects-for-austria/railway-lines/southern-line-vienna-villach/semmering-base-tunnel'),
    P('fehmarn', 'Fehmarn Belt fixed link', 'Fehmarn Belt', 2032, 'No official year; road ≥2031, rail later (≥2032)',
      'https://femern.com/the-tunnel/fehmarnbelt-tunnel/', '18 km immersed tunnel Denmark–Germany; Hamburg–Copenhagen ~2h30.',
      'Two-stage opening announced 17 May 2026: road first, rail once German land works are ready (at least 2032). New schedule due after first elements are sunk.',
      'https://femern.com/press/news/the-fehmarnbelt-tunnel-will-open-in-two-stages/'),
    P('cpk', 'CPK high-speed rail (Warsaw–Łódź and extensions)', 'CPK high-speed rail', 2032, '2032 (Warsaw–Łódź); Poznań/Wrocław ~2035',
      'https://portpolska.pl/en/project-status', 'Poland\'s "Y" high-speed line via the new airport. Stated times: Warsaw–Łódź 40 min (2032); Warsaw–Poznań and Warsaw–Wrocław ~1h40, Łódź–Poznań and Łódź–Wrocław ~1h (2035).',
      'Stage 1 Warsaw–airport–Łódź 2032; extension to Poznań and Wrocław 2035. Tenders for line sections under way.', 'https://zsk.gov.pl/en/benefits/transport-corridors/y-line/'),
    P('montpellier-perpignan', 'Montpellier–Perpignan new line (LNMP)', 'Montpellier–Perpignan', 2034, 'Phase 1 Montpellier–Béziers 2034; phase 2 ~2040',
      'https://www.ligne-montpellier-perpignan.com/', 'Missing high-speed link between France and Spain. Phase 1 saves ~20 min, phase 2 a further ~40 min on Paris/Lyon/Marseille–Barcelona.',
      'Steering committee of 3 July 2026 confirmed works start by end of 2029; phase 2 date "being consolidated".', 'https://www.ligne-montpellier-perpignan.com/'),
    P('rail-baltica', 'Rail Baltica', 'Rail Baltica', 2030, 'Phase 1 (single track) 2030; Polish section to Warsaw undated',
      'https://www.railbaltica.org/about-rail-baltica/', 'New standard-gauge line Tallinn–Riga–Kaunas/Vilnius–Polish border. Stated times: Tallinn–Riga 1h42, Riga–Vilnius 1h54, Riga–Kaunas ~1h32, Vilnius–Kaunas 38 min; Vilnius–Kaunas–Warsaw 3h52 once the Polish section is done.',
      'EU milestone: single-track electrified line Tallinn–LT/PL border by 2030 (RB Rail CEO calls this demanding). Polish Ełk–border section still in design.',
      'https://www.railbaltica.org/news/european-commission-adopts-milestones-for-the-completion-of-rail-baltica/'),
    P('napoli-bari', 'Naples–Bari high-speed/high-capacity line', 'Naples–Bari', 2030, '2030 (last sections)',
      'https://www.fsitaliane.it/it/opere-strategiche/napoli---bari.html', 'Naples–Bari ~2h, Rome–Bari ~3h.',
      'Naples–Cancello open; Telese–Vitulano and Orsara–Bovino 2028; Apice–Hirpinia and Hirpinia–Orsara 2030.', 'https://www.fsitaliane.it/it/opere-strategiche/napoli---bari.html'),
    P('y-vasca', 'Basque Y high-speed network', 'Basque Y', 2030, 'No official date (estimate)',
      'https://www.ets-rfv.euskadi.eus/la-y-vasca/', 'High-speed triangle Bilbao–Vitoria–San Sebastián linking to Irun; Bilbao–San Sebastián ~50 min.',
      'March 2026: track bed to be finished "in less than a year"; officials avoid giving dates. 2030 is this tool\'s estimate.',
      'https://www.lamoncloa.gob.es/serviciosdeprensa/notasprensa/transportes-movilidad-sostenible/Paginas/2026/060326-puente-movilidad-euskadi.aspx'),
    P('ostlanken', 'Ostlänken (East Link)', 'Ostlänken', 2035, 'About 2035',
      'https://www.trafikverket.se/ostlanken', 'New high-speed line Järna–Linköping (Torvinge); saves ~35 min on Stockholm–Copenhagen.',
      'Under the 2026–2037 national plan the line ends at Torvinge, east of Linköping.', 'https://www.trafikverket.se/ostlanken'),
    P('hs2', 'HS2 Phase 1 (London–Birmingham)', 'HS2', 2039, 'May 2036 – Oct 2039 (Old Oak Common–Birmingham)',
      'https://www.hs2.org.uk/hs2-project-update/', 'New line London–Birmingham. HS2 states Old Oak Common–Birmingham Curzon Street ~42–45 min and Euston–Curzon Street 49 min (now 1h17–1h19). Modelled from 2039 as 55 min to central London (Old Oak + Elizabeth line). Manchester/Scotland trains only gain once Euston and the Handsacre link open (2040–2043, beyond this tool\'s horizon).',
      'Reset of 19 May 2026: first services Old Oak Common–Birmingham May 2036–Oct 2039; Euston and full scheme 2040–2043; top speed cut to 320 km/h.', 'https://www.hs2.org.uk/why/connectivity/'),
    P('brescia-verona', 'Brescia–Verona high-speed line', 'Brescia–Verona HSL', 2027, 'First half of 2027',
      'https://www.fsitaliane.it/en/strategic-projects/brescia-verona-padua-hs-hc-line.html', 'Completes high speed from Milan to Verona; ~12 min saved.',
      'Slipped from February 2026; trial runs since June 2026.', 'https://www.fsitaliane.it/en/strategic-projects/brescia-verona-padua-hs-hc-line.html'),
    P('verona-padua', 'Verona–Vicenza–Padua high-speed line', 'Verona–Padua HSL', 2033, 'Verona–Vicenza 2027; Vicenza crossing Sept 2033; Vicenza–Padua undated',
      'https://www.fsitaliane.it/en/strategic-projects/brescia-verona-padua-hs-hc-line.html', 'Extends high speed towards Venice; Milan–Venice ~1h50 when complete.',
      'Lot 1 works finished (Aug 2026); lot 3 Vicenza–Padua only funded for final design.', 'https://www.fsitaliane.it/en/strategic-projects/brescia-verona-padua-hs-hc-line.html'),
    P('med-corridor', 'Mediterranean Corridor: Valencia–Castellón–Tarragona', 'Mediterranean Corridor', 2027, '2027 (standard gauge Castellón–Tarragona)',
      'https://www.adif.es/w/obras-implantacion-ancho-estandar-aldea-vinaros-les-palmes-benicassim-', 'Gauge conversion and upgrades; Barcelona–Valencia ~2h15.',
      'Closure dates for the gauge change still being set. No dedicated project page; link is an Adif press note.',
      'https://www.transportes.gob.es/ministerio/comunicacion/sala-prensa/jue-20112025-1607'),
    P('gpso', 'GPSO: Bordeaux–Toulouse high-speed line', 'Bordeaux–Toulouse LGV', 2032, '2032 (project target; ~2035 suggested by advisers)',
      'https://www.ln-so.fr/en', 'New 222 km line. Stated: Bordeaux–Toulouse 1h05 (now 2h20) and Paris–Toulouse 3h10 (now 4h35).',
      'May 2026 State–local deal releases ~€500m for tenders; COI advisers call 2032/33 very hard to meet.',
      'https://metropole.toulouse.fr/espace-presse/1ere-reunion-du-conseil-de-surveillance-du-gpso'),
    P('prague-brno', 'Prague–Brno high-speed line', 'Prague–Brno HSL', 2035, 'About 2035 (indicative)',
      'https://vrtky.cz/useky-a-mapy/praha-brno-ostrava-a-brno-breclav', 'First Czech high-speed line. Správa železnic states Prague–Brno ~1h (now 2h36), so ~1h30 off every train via Brno (Prague–Vienna, –Bratislava, –Budapest, Berlin–Vienna).',
      'Construction from ~2030, 5–6 years to build (Správa železnic interview); the transport minister has said high-speed trains will come "first in 2040". No formal date.',
      'https://seznamzpravy.cz/clanek/ekonomika-byznys-rozhovory-rychlovlakem-z-prahy-do-brna-za-hodinu-kilometr-trate-vyjde-na-miliardu-237398'),
    P('berlin-dresden', 'Berlin–Dresden 200 km/h upgrade', 'Berlin–Dresden upgrade', 2033, 'End of 2033 (Blankenfelde–Wünsdorf section)',
      'https://www.deutschebahn.com/de/bauprojekte/projekte_im_bau/ausbaustrecke-berlin-dresden', 'Upgrade to 200 km/h. DB states Berlin–Dresden 80 min (fastest today ~94 min), ~14 min off all Berlin/Hamburg–Prague/Brno/Vienna/Bratislava trains.',
      'Total closure Apr 2028–Dec 2029 (RNE); last section delayed to end of 2033.', 'https://www.berliner-zeitung.de/article/db-ausbau-berlin-dresden-erst-bis-2033-10028383'),
    P('plzen-domazlice', 'Plzeň–Domažlice upgrade (Prague–Munich line)', 'Plzeň–Domažlice upgrade', 2030, 'Plzeň–Stod section after total closure Jan 2028–Jun 2030',
      'https://www.seznamzpravy.cz/clanek/vlaky-z-plzne-do-bavorska-pojedou-po-nove-trati-dve-ste-kilometru-v-hodine-126144', 'New 200 km/h alignment Plzeň–Stod; Správa železnic states Plzeň–Domažlice ~35 min instead of ~45.',
      'RNE Common Capacity Strategy TT2030 lists the Plzeň–Stod total closure Jan 2028–Jun 2030.', 'https://rne.eu/wp-content/uploads/Draft-_Common-Capacity-Strategy-TT-2030.pdf'),
    P('dk-fyn', 'Danish Funen upgrades: Vestfyn new line + Ringsted–Odense 200 km/h', 'Funen upgrades (DK)', 2029, 'Vestfyn end 2029; 200 km/h 2028–2030',
      'https://www.trm.dk/media/nwkbufiz/faktaark-ny-bane-over-vestfynpdf.pdf', 'Danish Transport Ministry: Vestfyn new line ~6 min faster Odense–Jutland; 200 km/h Ringsted–Odense ~5 min faster. ~11 min off Copenhagen–Jutland (Hamburg–Copenhagen via Jutland until Fehmarn opens).',
      'Banedanmark capacity strategy TT2030: Vestfyn opens end of 2029; 180→200 km/h Ringsted–Slagelse, Nyborg–Odense 2028–2029.', 'https://www.trm.dk/media/jezbiitd/faktaar-hastighedsopgradering-ringstedodense-final-a.pdf'),
    P('hannover-berlin-works', 'Hanover–Berlin line rebuild (closure Oct 2026–Dec 2027)', 'Hanover–Berlin reopening', 2028, 'Reopening Dec 2027',
      'https://www.infranken.de/deutschland/berlin-hannover-80-minuten-mehr-fahrzeit-bis-ende-2027-art-6394443', 'The Hanover–Berlin high-speed line is closed for general renovation, adding ~70 min to Hanover/Cologne/Amsterdam–Berlin trains. Normal running (Hanover–Berlin ~1h36, Cologne–Berlin ~4h20, Amsterdam–Berlin ~5h42) is assumed after reopening.',
      'Closure Oct 2026–Dec 2027 (RNE: Lehrte–Berlin general renovation 2027).', 'https://rne.eu/wp-content/uploads/Common-pilot-Capacity-Strategy-TT-2029-1.pdf'),
    P('fra-mannheim', 'New line Frankfurt–Mannheim (NBS Rhein/Main–Rhein/Neckar)', 'Frankfurt–Mannheim NBS', 2037, 'Full commissioning expected 2037',
      'https://www.baden-wuerttemberg.de/de/service/presse/pressemitteilung/pid/neue-bahnstrecke-zwischen-frankfurt-und-mannheim', 'New 300 km/h line; DB states Frankfurt–Mannheim 29 instead of 38 min, i.e. −9 min on trains from Frankfurt/Cologne/Hamburg/Paris towards Stuttgart, Basel and Zurich.',
      'Federal government report (July 2026): full commissioning expected 2037.', 'https://www.bundestag.de/presse/hib/kurzmeldungen-1200722'),
    P('gaeubahn', 'Gäubahn: Pfaffensteig tunnel (Stuttgart–Zurich)', 'Pfaffensteig tunnel', 2033, 'December 2033',
      'https://www.stuttgart.de/service/aktuelle-meldungen/2026/juni/geaenderter-stufenplan-fuer-inbetriebnahme-ab-dezember-2027', 'New 11 km tunnel linking the Gäubahn to Stuttgart Airport and the S21 network; DB states ~15 min shorter Stuttgart–Zurich.',
      'Symbolic construction start 12 Oct 2026; opening Dec 2033 in the City of Stuttgart staging plan (June 2026).', 'https://www.wochenblatt-reporter.de/c-lokales/baustart-bei-stuttgart-tunnel-soll-zuerich-reisezeit-verkuerzen_a907499'),
    P('budapest-belgrade', 'Budapest–Belgrade railway', 'Budapest–Belgrade line', 2027, 'Line complete 2026; full-speed service target ~2027',
      'https://biznis.kurir.rs/info-biz/9925820/otvaranje-pruge-beograd-budimpesta', 'Rebuilt 160–200 km/h line. Hungarian government: Budapest–Kelebia 90 min; Serbian government: Belgrade–Budapest 2h40 (first through trains from Dec 2026 at 3h17).',
      'Hungarian section finished Jan 2026; freight since Feb 2026; passenger start slipped to 13 Dec 2026.', 'https://infostart.hu/belfold/2026/01/14/mar-tudni-mikor-indulhat-a-forgalom-a-budapest-belgrad-vasutvonalon'),
    P('lnpca', 'Ligne nouvelle Provence Côte d\'Azur (phases 1–2)', 'LNPCA', 2032, 'Phase 1 2029/2030; phase 2 (Marseille through station) from 2032',
      'https://www.lignenouvelle-provencecotedazur.fr/foire-aux-questions-nos-reponses-aux-questions-frequentes', 'Underground through station at Marseille Saint-Charles; stated −20 min for trains crossing Marseille (e.g. Paris/Lyon–Nice TGVs, which today reverse there).',
      'Phases 3–4 (new Marseille–Toulon–Nice sections) around 2040, no stated times yet.', 'https://www.lignenouvelle-provencecotedazur.fr/foire-aux-questions-nos-reponses-aux-questions-frequentes'),
    P('athens-thessaloniki', 'Athens–Thessaloniki line restoration (OSE/ERGOSE)', 'Athens–Thessaloniki upgrade', 2028, 'No firm year (estimate); new trains by end of 2027',
      'https://www.ergose.gr/2021/03/?lang=en', 'ERGOSE states Athens–Thessaloniki will take 3 h once works are complete (5h12 in the 2026 works timetable; ~4h15 before 2023).',
      'Reconstruction after the 2023 Tempi accident continues through 2026; 2028 is this tool\'s estimate.', 'https://www.ethnos.gr/englishversion/amp/39962/athensthessalonikirailwayjourneywillbelessthan35hoursinafewdays'),
    P('porto-vigo', 'Porto–Vigo high-speed line (LAV Porto–Valença)', 'Porto–Vigo HSL', 2033, 'Construction 2028–2033',
      'https://www.infraestruturasdeportugal.pt/pt-pt/rede-de-alta-velocidade', 'IP: direct Porto–Vigo in 50 min (now ~2h30–3h30).',
      'Phase 1 tenders 2027; environmental assessments submitted mid-2026.', 'https://www.infraestruturasdeportugal.pt/pt-pt/rede-de-alta-velocidade'),
    P('dresden-prague', 'New line Dresden–Prague (Erzgebirge base tunnel)', 'Dresden–Prague NBS', 2044, 'Opening end of 2044',
      'https://www.berliner-zeitung.de/article/bahnstrecke-dresdenprag-bundestag-gibt-gruenes-licht-fuer-milliardenprojekt-10037826', 'BMV: Dresden–Prague from 2.5 h to 1 h. Beyond this tool\'s 2040 horizon.',
      'Bundestag approved further planning May 2026; construction from Dec 2032.', 'https://www.berliner-zeitung.de/article/bahnstrecke-dresdenprag-bundestag-gibt-gruenes-licht-fuer-milliardenprojekt-10037826'),
    P('lisbon-madrid', 'Lisbon–Madrid link (Évora–Elvas + Madrid–Extremadura HSL)', 'Lisbon–Madrid link', 2027, 'Évora–Elvas end 2026/early 2027; Madrid–Lisbon direct "by 2030"; high speed 2034',
      'https://www.infraestruturasdeportugal.pt/pt-pt/corredor-internacional-sul', 'Lisbon–Badajoz under 2h (Évora–Elvas), a direct Lisbon–Madrid train (~5h, 2030), then high speed (~3h, 2034).',
      'Évora–Elvas track complete (Jan 2026), signalling/certification pending. Madrid–Extremadura: Plasencia–Badajoz open since 2022, other sections in works or design.',
      'https://eco.sapo.pt/2026/01/16/linha-evora-espanha-pronta-mas-comboios-so-no-final-do-ano/'),
    P('lisbon-porto', 'Lisbon–Porto high-speed line', 'Lisbon–Porto HSL', 2033, '~2033 for Porto–Carregado (1h19 non-stop); full 1h15 later',
      'https://www.infraestruturasdeportugal.pt/pt-pt/rede-de-alta-velocidade', 'New high-speed line. IP: after phase 2 (~2033) a non-stop Porto–Lisbon train takes 1h19 (now 2h39); the headline 1h15 needs phase 3, with no date.',
      'Porto–Oiã under concession (July 2025); Oiã–Soure re-tendered Jan 2026; Carregado–Lisbon later.',
      'https://portugal.gov.pt/pt/gc25/comunicacao/comunicados/alta-velocidade-porto-lisboa-lancamento-de-concurso-entre-oia-e-soure-afirma-compromisso-com-ferrovia')
  ].map(p => [p.id, p]));

  // ── What the RNE capacity strategies say about each modelled project (read Oct 2026) ──
  const CS30 = 'https://rne.eu/wp-content/uploads/Draft-_Common-Capacity-Strategy-TT-2030.pdf';
  const CS29 = 'https://rne.eu/wp-content/uploads/Common-pilot-Capacity-Strategy-TT-2029-1.pdf';
  const RNE = {
    stuttgart21: ['States "Travel time reduction approx. 15 min" (used here). Its Dec 2026 date is superseded; the TT2030 draft no longer lists S21 before TT2030, consistent with Dec 2031.', CS29],
    rastatt: ['States "approx. 3 min in long distance traffic"; 250 km/h; TT2027.', CS29],
    semmering: ['Confirms Dec 2029 and "reduction in journey time" (no figure).', CS30],
    brenner: ['No opening date given; the southern access Fortezza–Ponte Gardena is listed for 2029 ("reducing travel time", no figure).', CS30],
    'lyon-turin': ['Lists the base tunnel as "Phase 4 beyond 2030"; the existing Fréjus line has tunnel-maintenance closures 2026–2030.', CS30],
    gpso: ['Speed-increase phases dated 2031 (Toulouse end) and TT2032; no time figure.', CS30],
    'brescia-verona': ['Dated 2027 ("running times reduction", no figure); the TT2029 edition said Dec 2026.', CS30],
    'verona-padua': ['Dates the Verona–Vicenza section 2027, yet lists a line closure for the same works in 2029–2030; Vicenza–Padua not mentioned. 2033 kept.', CS30],
    fehmarn: ['Banedanmark plans the Danish landside line (Ringsted–Rødby) ready in 2029; through rail service still depends on the tunnel and German works (≥2032, kept).', 'https://rne.eu/wp-content/uploads/Banedanmarks-Capacity-Strategy-TT30_Draft_Version-1_English-Version.pdf'],
    'med-corridor': ['ADIF confirms the Castellón–Tarragona gauge conversion but gives no date or journey time.', 'https://rne.eu/wp-content/uploads/Capacity-Strategy-2030.pdf'],
    'lisbon-madrid': ['ADIF lists only the Mérida–Aljucén doubling (to 2030); no Badajoz–Elvas works, and 0 long-distance border paths/h planned.', 'https://rne.eu/wp-content/uploads/Capacity-Strategy-2030.pdf'],
    'y-vasca': ['Not mentioned by ADIF; SNCF Réseau lists a double standard-gauge track Hendaye–Irun for 2029.', 'https://rne.eu/wp-content/uploads/2028-Capacity-Strategy-Mature-Draft-SNCF-R-EN.pdf'],
    ostlanken: ['Trafikverket gives no opening date; only Norrköping C station works 2030–2036.', 'https://rne.eu/wp-content/uploads/trafikverkets_capacity_strategy_2030_draft.pdf'],
    'prague-brno': ['Prague-end connection works (Běchovice–Libeň) run 10/2029–10/2035; no date or time for the line.', CS30],
    deutschlandtakt: ['Named only as the "guiding political principle"; no dates or figures. The generic speed-up used here may partly overlap named German projects.', CS30]
  };
  Object.entries(RNE).forEach(([id, [text, url]]) => { if (PROJECTS[id]) PROJECTS[id].rne = { text, url }; });

  // ── Project phases: segment upgrades (f) or new links (add), with official year ──
  const GER = new Set(['BER','FRA','MUC','HAM','CGN','STR','NUE','OSN']);
  const has = (e, x, y) => (e.a === x && e.b === y) || (e.a === y && e.b === x);
  const delta = list => (e, t) => { for (const [x, y, d] of list) if (has(e, x, y)) return t - d; return t; };
  const setMin = list => (e, t) => { for (const [x, y, v] of list) if (has(e, x, y)) return Math.min(t, v); return t; };
  const dt = (fd, fb) => (e, t) => { const g = GER.has(e.a) + GER.has(e.b); return g === 2 ? t * fd : g === 1 ? t * fb : t; };
  const PHASES = [
    { project: 'spain-limits', year: 2027, f: setMin([['MAD','BCN',150],['MAD','VLC',98]]) },
    { project: 'spain-limits', year: 2027, f: delta([['MAD','MRS',30]]) },
    { project: 'deutschlandtakt', year: 2030, f: dt(0.95, 0.97) },
    { project: 'deutschlandtakt', year: 2035, f: dt(0.97, 0.98) },
    { project: 'deutschlandtakt-full', year: 2040, f: dt(0.96, 0.98) },
    // Stated saving: 'Travel time reduction approx. 15 min' (RNE Common Capacity Strategy TT2029, p.11) — applied to through traffic
    { project: 'stuttgart21', year: 2031, f: delta([['STR','MUC',15],['PAR','MUC',15],['SXB','MUC',15]]) },
    // Stated saving: 'approx. 3 min in long distance traffic' (RNE CCS TT2029 p.11; TT2027 per CCS TT2030 Table 6)
    { project: 'rastatt', year: 2027, f: delta([['BSL','FRA',3],['ZRH','FRA',3],['SXB','FRA',3],['SXB','STR',3],['SXB','MUC',3],['PAR','STR',3],['PAR','MUC',3]]) },
    { project: 'lyon-turin', year: 2033, f: delta([['LYS','TRN',113],['PAR','TRN',120],['PAR','MIL',165],['LYS','MIL',120]]) },
    { project: 'brenner', year: 2034, f: delta([['VRN','MUC',60],['VRN','INN',55]]) },
    { project: 'semmering', year: 2029, f: setMin([['VIE','GRZ',119]]) },
    { project: 'semmering', year: 2029, f: delta([['VCE','VIE',25],['LJU','VIE',25],['ZAG','VIE',25]]) },
    { project: 'fehmarn', year: 2032, f: setMin([['HAM','CPH',150],['BER','CPH',260],['PRG','CPH',500]]) },
    { project: 'cpk', year: 2032, f: setMin([['WAW','LCJ',40]]) },
    { project: 'cpk', year: 2035, f: setMin([['WAW','POZ',100],['WAW','WRO',100],['LCJ','POZ',60],['LCJ','WRO',60]]) },
    { project: 'montpellier-perpignan', year: 2034, f: delta([['BCN','MPL',20],['PAR','BCN',20],['BCN','LYS',20],['BCN','MRS',20],['MAD','MRS',20]]) },
    { project: 'montpellier-perpignan', year: 2040, f: delta([['BCN','MPL',40],['PAR','BCN',40],['BCN','LYS',40],['BCN','MRS',40],['MAD','MRS',40]]) },
    { project: 'rail-baltica', year: 2030, add: [['TLL','RIX',102],['RIX','VNO',114],['RIX','KUN',92]] },
    { project: 'rail-baltica', year: 2030, f: setMin([['KUN','VNO',38]]) },
    { project: 'rail-baltica', year: 2035, add: [['KUN','WAW',194]] },
    { project: 'napoli-bari', year: 2030, f: setMin([['NAP','BRI',120],['ROM','BRI',180]]) },
    { project: 'y-vasca', year: 2030, f: setMin([['BIL','DON',50],['DON','HEN',20]]) },
    { project: 'y-vasca', year: 2030, f: delta([['MAD','BIL',45]]) },
    { project: 'ostlanken', year: 2035, f: delta([['CPH','STO',35],['STO','GOT',15]]) },
    { project: 'hs2', year: 2039, f: setMin([['BHX','LON',55]]) },
    { project: 'brescia-verona', year: 2027, f: delta([['MIL','VRN',12],['MIL','VCE',12]]) },
    { project: 'verona-padua', year: 2033, f: delta([['MIL','VCE',25],['VRN','ROM',0]]) },
    { project: 'med-corridor', year: 2027, f: setMin([['BCN','VLC',135]]) },
    { project: 'gpso', year: 2032, f: setMin([['TLS','BOD',65],['TLS','PAR',190]]) },
    { project: 'gpso', year: 2032, f: delta([['BOD','MPL',75]]) },
    { project: 'prague-brno', year: 2035, f: setMin([['BRQ','PRG',60]]) },
    { project: 'prague-brno', year: 2035, f: delta([['VIE','PRG',90],['PRG','BUD',90],['BTS','PRG',90],['BER','VIE',90],['BRQ','BER',90]]) },
    { project: 'berlin-dresden', year: 2033, f: setMin([['DRS','BER',80]]) },
    { project: 'berlin-dresden', year: 2033, f: delta([['BER','PRG',14],['HAM','PRG',14],['BER','VIE',14],['BRQ','BER',14],['BTS','BER',14],['PRG','CPH',14]]) },
    { project: 'plzen-domazlice', year: 2030, f: delta([['MUC','PRG',10]]) },
    { project: 'dk-fyn', year: 2029, f: delta([['HAM','CPH',11],['BER','CPH',11],['PRG','CPH',11]]) },
    { project: 'lisbon-madrid', year: 2027, add: [['LIS','BJZ',115]] },
    { project: 'lisbon-madrid', year: 2030, add: [['LIS','MAD',300]] },
    { project: 'lisbon-madrid', year: 2034, add: [['LIS','MAD',180]] },
    { project: 'lisbon-porto', year: 2033, add: [['LIS','OPO',79]] },
    { project: 'hannover-berlin-works', year: 2028, f: setMin([['HAJ','BER',96],['CGN','BER',260],['AMS','BER',342]]) },
    { project: 'fra-mannheim', year: 2037, f: delta([['FRA','STR',9],['BSL','FRA',9],['ZRH','FRA',9],['SXB','FRA',9],['PAR','FRA',9],['CGN','MUC',9],['BSL','CGN',9],['BSL','HAM',9],['BSL','BER',9],['STR','HAM',9],['STR','CGN',9],['BSL','HAJ',9],['STR','HAJ',9]]) },
    { project: 'gaeubahn', year: 2033, f: delta([['ZRH','STR',15]]) },
    { project: 'budapest-belgrade', year: 2027, f: setMin([['BEG','BUD',160]]) },
    { project: 'budapest-belgrade', year: 2027, f: delta([['BEG','VIE',37]]) },
    { project: 'lnpca', year: 2032, f: delta([['NCE','PAR',20],['NCE','LYS',20]]) },
    { project: 'athens-thessaloniki', year: 2028, f: setMin([['ATH','SKG',180]]) },
    { project: 'porto-vigo', year: 2033, f: setMin([['OPO','VGO',50]]) },
    { project: 'dresden-prague', year: 2044, f: setMin([['DRS','PRG',60]]) }
  ];

  // ── Engine ─────────────────────────────────────────────────────────────────
  const scenarioFor = y => SCEN.find(s => s >= y) || null; // null = beyond 2040
  const CONSERVATIVE_SLIP = 4; // years added to every official date in conservative mode

  function node(code) {
    const i = CODES.indexOf(code);
    if (i >= 0) { const c = CITIES[i]; return { code, name: c.name, lat: c.lat, lng: c.lng, city: true }; }
    const h = HUBS[code]; return { code, name: h[0], lat: h[1], lng: h[2], city: false };
  }

  function build(settings) {
    const transfer = settings.transfer, slip = settings.timing === 'conservative' ? CONSERVATIVE_SLIP : 0;
    const links = EDGES.map(e => ({ a: e[0], b: e[1], t: e[2], conf: e[3], src: e[4], note: e[5] }));
    PHASES.forEach(p => (p.add || []).forEach(([a, b, t]) => links.push({
      a, b, t: Infinity, future: { phase: p, t }, conf: 'plan', src: PROJECTS[p.project].url,
      note: 'New line: ' + PROJECTS[p.project].shortName })));
    const active = PHASES.map(p => ({ p, s: scenarioFor(p.year + slip) })).filter(x => x.s !== null).sort((x, y) => x.s - y.s);

    const W = {}, CH = {};
    YEARS.forEach(y => {
      W[y] = []; CH[y] = [];
      links.forEach((e, i) => {
        let t = e.t; const ch = new Set();
        active.forEach(({ p, s }) => {
          if (s > y) return;
          const n = p.add ? (e.future && e.future.phase === p ? Math.min(t, e.future.t) : t) : p.f(e, t);
          if (n < t && s === y) ch.add(p.project);
          t = n;
        });
        W[y][i] = t; CH[y][i] = ch;
      });
    });

    const adj = {};
    links.forEach((e, i) => { (adj[e.a] ||= []).push([e.b, i]); (adj[e.b] ||= []).push([e.a, i]); });

    function sssp(src, y) {
      const dist = { [src]: 0 }, prev = {}, done = new Set();
      for (;;) {
        let u = null;
        for (const k in dist) if (!done.has(k) && dist[k] < Infinity && (u === null || dist[k] < dist[u])) u = k;
        if (u === null) break;
        done.add(u);
        const pen = u === src ? 0 : transfer;
        for (const [v, i] of adj[u] || []) {
          const c = dist[u] + W[y][i] + pen;
          if (c < Infinity && (dist[v] === undefined || c < dist[v])) { dist[v] = c; prev[v] = [u, i]; }
        }
      }
      return { dist, prev };
    }

    const runs = {};
    YEARS.forEach(y => { runs[y] = CODES.map(c => sssp(c, y)); });

    const routes = [];
    for (let a = 0; a < CODES.length; a++) for (let b = a + 1; b < CODES.length; b++) {
      const r = { from: a, to: b, times: {}, viaByYear: {}, transfersByYear: {}, pathByYear: {}, legsByYear: {},
                  improvements: { y2030: [], y2035: [], y2040: [] } };
      YEARS.forEach(y => {
        const k = 'y' + y, { dist, prev } = runs[y][a], d = dist[CODES[b]];
        if (d === undefined || d > MAX_MIN) {
          r.times[k] = null; r.viaByYear[k] = null; r.transfersByYear[k] = null; r.pathByYear[k] = null; r.legsByYear[k] = null;
          return;
        }
        const nodes = [CODES[b]], legs = [];
        for (let n = CODES[b]; n !== CODES[a]; n = prev[n][0]) {
          const i = prev[n][1], e = links[i];
          legs.push({ a: prev[n][0], b: n, t: Math.round(W[y][i]), conf: e.conf, src: e.src, note: e.note, i });
          nodes.push(prev[n][0]);
        }
        nodes.reverse(); legs.reverse();
        r.times[k] = Math.round(d);
        r.pathByYear[k] = nodes;
        r.legsByYear[k] = legs;
        r.transfersByYear[k] = nodes.length - 2;
        r.viaByYear[k] = nodes.length === 2 ? 'Direct' : 'via ' + nodes.slice(1, -1).map(c => node(c).name).join(', ');
        if (y !== 2026) {
          const ps = new Set(); legs.forEach(l => CH[y][l.i].forEach(p => ps.add(p)));
          r.improvements[k] = [...ps];
        }
      });
      r.via = r.viaByYear.y2026; r.transfers = r.transfersByYear.y2026;
      routes.push(r);
    }
    return routes;
  }

  // ── Flights: estimated door-to-door time from great-circle distance ─────────
  const FLIGHT = { taxiAndClimb: 35, cruiseKmh: 800, airportAllowance: 150, minKm: 300 };
  function flight(fromId, toId) {
    const p = CITIES[fromId], q = CITIES[toId], R = 6371, rad = Math.PI / 180;
    const dLat = (q.lat - p.lat) * rad, dLng = (q.lng - p.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * rad) * Math.cos(q.lat * rad) * Math.sin(dLng / 2) ** 2;
    const km = Math.round(2 * R * Math.asin(Math.sqrt(h)));
    if (km < FLIGHT.minKm) return { km, block: null, doorToDoor: null };
    const block = Math.round(FLIGHT.taxiAndClimb + km / FLIGHT.cruiseKmh * 60);
    return { km, block, doorToDoor: block + FLIGHT.airportAllowance };
  }

  // ── Night trains (regular services, timetable as of Oct 2026; sources per row) ──
  // CityA|CityB|operator / train|frequency|dep–arr (A→B, local)|minutes|source key
  const NSRC = {
    BOT: 'https://github.com/Back-on-Track-eu/night-train-data', ES: 'https://www.europeansleeper.eu/timetable',
    ESPB: 'https://www.seat61.com/trains-and-routes/european-sleeper-paris-berlin.htm',
    ESBM: 'https://www.seat61.com/trains-and-routes/european-sleeper-brussels-milan.htm',
    SN: 'https://www.snalltaget.se/en/berlin', SNA: 'https://www.snalltaget.se/en/train-to-austria-winter',
    RDC: 'https://blog.nightride.com/en-344-345-berlin-stockholm-rdc-night-train/',
    VZ: 'https://www.thelocal.com/20260618/what-you-need-to-know-about-the-new-zurich-vienna-night-trains',
    ERT: 'https://europeanrailtimetable.eu/blogs/railway-news/newlines-may-18-2026',
    NJ: 'https://www.nightjet.com/en', S61N: 'https://www.seat61.com/trains-and-routes/paris-to-nice-by-train.htm'
  };
  const NIGHT = `
Amsterdam|Berlin|European Sleeper|3×/week|22:42–06:18|456|ES
Amsterdam|Innsbruck|ÖBB Nightjet|daily|18:59–08:49|830|BOT
Amsterdam|Munich|ÖBB Nightjet|daily|18:59–06:42|703|BOT
Amsterdam|Prague|European Sleeper|3×/week|22:42–10:45|723|ES
Amsterdam|Vienna|ÖBB Nightjet|daily|18:01–09:48|947|BOT
Amsterdam|Zurich|ÖBB Nightjet|daily|21:01–08:05|664|BOT
Bari|Bologna|Trenitalia Intercity Notte|daily|21:25–04:52|447|BOT
Bari|Milan|Trenitalia Intercity Notte|daily|21:25–07:05|580|BOT
Bari|Rome|Trenitalia Intercity Notte|weekly|00:01–06:10|369|BOT
Bari|Turin|Trenitalia Intercity Notte|daily|22:10–09:15|665|BOT
Berlin|Bratislava|EuroNight Metropol|daily|20:11–06:02|591|BOT
Berlin|Brno|EuroNight Metropol / Nightjet|daily|20:11–03:16|425|BOT
Berlin|Brussels|European Sleeper|6×/week|18:31–07:06|755|ESPB
Berlin|Budapest|EuroNight Metropol|daily|20:11–08:29|738|BOT
Berlin|Copenhagen|Snälltåget / RDC EuroNight|2–4×/week (pause 8 Jan 2027–Easter)|21:09–06:03|534|SN
Berlin|Paris|European Sleeper|3×/week|18:31–10:00|929|ESPB
Berlin|Prague|ÖBB Nightjet|daily|18:06–00:26|380|BOT
Berlin|Stockholm|Snälltåget / RDC EuroNight|2–4×/week (pause 8 Jan 2027–Easter)|21:09–13:17|968|SN
Berlin|Vienna|ÖBB Nightjet|daily|18:06–06:37|751|BOT
Berlin|Zurich|ÖBB Nightjet|daily|20:48–09:05|737|BOT
Bologna|Munich|ÖBB Nightjet|daily|22:54–09:33|639|BOT
Bologna|Rome|Trenitalia Intercity Notte|daily|01:51–06:35|284|BOT
Bologna|Vienna|ÖBB Nightjet|daily|22:54–08:52|598|BOT
Bratislava|Prague|EuroNight Metropol|daily|21:58–03:09|311|BOT
Bratislava|Warsaw|EuroNight|daily|21:58–08:00|602|BOT
Brno|Budapest|EuroNight Metropol|daily|03:16–08:29|313|BOT
Brussels|Hamburg|European Sleeper|3×/week|21:45–06:57|552|ESPB
Brussels|Milan|European Sleeper|3×/week|17:56–11:45|1069|ESBM
Brussels|Munich|ÖBB Nightjet|3×/week|19:06–05:43|637|BOT
Brussels|Prague|European Sleeper|3×/week|19:22–10:45|923|ES
Brussels|Vienna|ÖBB Nightjet|3×/week|19:06–10:13|907|BOT
Budapest|Ljubljana|MÁV Istria Express|seasonal (late Jun–Aug)|21:30–05:55|505|ERT
Budapest|Munich|EuroNight Kálmán Imre|daily|20:30–05:50|560|BOT
Budapest|Prague|EuroNight Metropol|daily|19:30–03:09|459|BOT
Budapest|Warsaw|EuroNight|daily|19:30–08:00|750|BOT
Budapest|Zurich|EuroNight (via Vienna)|daily|20:30–08:20|710|BOT
Cologne|Innsbruck|Urlaubs-Express (car train)|seasonal (May–Oct)|21:18–08:20|662|BOT
Cologne|Milan|European Sleeper|3×/week|22:07–11:45|818|ESBM
Cologne|Munich|ÖBB Nightjet|3×/week|22:01–05:43|462|BOT
Cologne|Vienna|ÖBB Nightjet|3×/week|22:01–10:13|732|BOT
Cologne|Zurich|ÖBB Nightjet|daily|23:45–08:05|500|BOT
Copenhagen|Hamburg|Snälltåget / RDC EuroNight|2–4×/week (pause 8 Jan 2027–Easter)|22:32–05:06|394|SN
Copenhagen|Innsbruck|Snälltåget Alps train|seasonal weekly (Jul; 18 Dec 2026–12 Mar 2027)|16:20–13:02|1242|SNA
Copenhagen|Munich|Snälltåget|seasonal weekly (Jul)|16:20–06:58|878|BOT
Edinburgh|London|Caledonian Sleeper (Lowlander)|Sun–Fri|23:40–07:15|455|BOT
Florence|Milan|Trenitalia Intercity Notte|daily|05:36–10:10|274|BOT
Florence|Munich|ÖBB Nightjet|daily|21:48–09:33|705|BOT
Florence|Vienna|ÖBB Nightjet|daily|21:48–08:52|664|BOT
Frankfurt|Hamburg|ÖBB Nightjet (Frankfurt Süd)|daily|02:14–08:00|346|BOT
Frankfurt|Prague|EuroNight (Frankfurt Süd → Prague only)|daily, one direction|00:28–09:25|537|BOT
Frankfurt|Zurich|ÖBB Nightjet (Frankfurt Süd)|daily|04:32–10:05|333|BOT
Hamburg|Innsbruck|ÖBB Nightjet|daily|19:19–08:49|810|BOT
Hamburg|Munich|ÖBB Nightjet|daily|20:10–05:02|532|BOT
Hamburg|Paris|European Sleeper|3×/week|21:55–10:00|725|ESPB
Hamburg|Stockholm|RDC EuroNight / Snälltåget|3×/week (2027 not confirmed)|21:53–09:45|712|RDC
Hamburg|Vienna|ÖBB Nightjet|daily|20:10–09:48|818|BOT
Hamburg|Zurich|ÖBB Nightjet|daily|21:44–10:05|741|BOT
Innsbruck|Ljubljana|EuroNight (Zurich–Zagreb)|daily|00:59–07:49|410|BOT
Innsbruck|Vienna|ÖBB Nightjet|daily|00:47–06:58|371|BOT
Innsbruck|Zagreb|EuroNight (Zurich–Zagreb)|daily|00:59–10:30|571|BOT
Ljubljana|Munich|EuroNight Lisinski|daily|22:10–05:55|465|BOT
Ljubljana|Warsaw|PKP Intercity (Warsaw–Rijeka)|seasonal (Jun–Aug)|14:04–05:37 (Warsaw→Ljubljana)|933|BOT
Ljubljana|Zurich|EuroNight|daily|22:10–09:20|670|BOT
Marseille|Paris|SNCF Intercités de nuit|daily|20:59–06:55|596|BOT
Milan|Naples|Trenitalia Intercity Notte|daily|22:13–08:46|633|BOT
Milan|Rome|Trenitalia Intercity Notte|daily|22:13–05:53|460|BOT
Munich|Rome|ÖBB Nightjet|daily (not 7 Feb–4 May 2027)|20:10–09:10|780|BOT
Munich|Vienna|several Nightjets / EuroNights|daily|23:53–06:32|399|BOT
Munich|Warsaw|EuroNight Chopin|daily|18:35–08:00|805|BOT
Munich|Zagreb|EuroNight Lisinski|daily|23:53–10:30|637|BOT
Naples|Turin|Trenitalia Intercity Notte|daily|21:35–09:05|690|BOT
Paris|Toulouse|SNCF Intercités de nuit|daily|22:13–07:44|571|BOT
Poznań|Prague|PKP/ČD EC 460 (Prague → Poznań only)|daily, one direction|18:49–01:18 (Prague→Poznań)|389|BOT
Prague|Vienna|ÖBB Nightjet|daily|00:36–06:37|361|BOT
Prague|Warsaw|EuroNight|daily|22:16–08:00|584|BOT
Prague|Wrocław|PKP/ČD EC 460/461|daily|18:49–23:30|281|BOT
Prague|Zurich|EuroNight|daily|17:25–09:05|940|BOT
Rome|Turin|Trenitalia Intercity Notte|daily|23:55–09:05|550|BOT
Rome|Vienna|ÖBB Nightjet|daily|18:10–08:52|882|BOT
Vienna|Warsaw|EuroNight Chopin|daily|23:19–08:00|521|BOT
Vienna|Zagreb|ÖBB EuroNight (Vienna–Split)|seasonal 3×/week (late May–Sep)|19:05–01:39|394|BOT
Vienna|Zurich|ÖBB Nightjet|daily|21:39–10:36|777|VZ
Warsaw|Wrocław|PKP Intercity sleeper|daily|23:47–04:25|278|BOT
Zagreb|Zurich|EuroNight|daily|19:39–09:20|821|BOT
Amsterdam|Basel|ÖBB Nightjet|daily|21:01–06:11|550|NJ
Amsterdam|Dresden|European Sleeper|3×/week|22:42–08:20|578|ES
Amsterdam|Nuremberg|ÖBB Nightjet|daily|18:01–02:51|530|NJ
Antwerp|Berlin|European Sleeper|3×/week|20:01–06:18|617|ES
Antwerp|Dresden|European Sleeper|3×/week|20:01–08:20|739|ES
Antwerp|Prague|European Sleeper|3×/week|20:01–10:45|884|ES
Basel|Berlin|ÖBB Nightjet|daily|21:13–07:13|600|NJ
Basel|Cologne|ÖBB Nightjet|daily|23:16–05:44|388|NJ
Basel|Dresden|ČD/ÖBB EuroNight|daily|21:25–06:59|574|NJ
Basel|Hamburg|ÖBB Nightjet|daily|22:16–07:47|571|NJ
Basel|Hanover|ÖBB Nightjet|daily|22:16–05:29|433|NJ
Basel|Leipzig|ÖBB Nightjet / EuroNight|daily|21:13–04:48|455|NJ
Basel|Prague|ČD/ÖBB EuroNight|daily|21:25–09:15|710|NJ
Berlin|Graz|ÖBB Nightjet|daily|18:06–09:19|913|NJ
Berlin|Rotterdam|European Sleeper|3×/week|22:56–07:27|511|ES
Bologna|Graz|ÖBB Nightjet|daily|22:54–06:06|432|NJ
Bratislava|Dresden|EuroNight Metropol|daily|21:58–05:48|470|BOT
Brno|Dresden|EuroNight Metropol / Nightjet|daily|00:31–05:48|317|BOT
Brno|Graz|ÖBB Nightjet|daily|03:21–09:19|358|NJ
Brussels|Dresden|European Sleeper|3×/week|19:22–08:20|778|ES
Bucharest|Budapest|CFR/MÁV Dacia, Ister, IC 78/79|daily (3 trains)|16:00–06:16|916|BOT
Bucharest|Vienna|CFR/MÁV/ÖBB Dacia|daily|16:00–08:53|1073|BOT
Budapest|Dresden|EuroNight Metropol|daily|19:30–05:48|618|BOT
Budapest|Stuttgart|EuroNight (through coaches)|daily|20:55–08:38|703|NJ
Dresden|Frankfurt|ČD/ÖBB EuroNight (Frankfurt Süd → Dresden only)|daily, one direction|00:28–06:59 (Frankfurt→Dresden)|391|NJ
Dresden|Graz|ÖBB Nightjet|daily|20:11–09:19|788|NJ
Dresden|Rotterdam|European Sleeper|3×/week|20:37–07:27|650|ES
Dresden|Vienna|ÖBB Nightjet|daily|20:11–06:37|626|NJ
Dresden|Zurich|ČD/ÖBB EuroNight|daily|21:09–09:05|716|NJ
Florence|Graz|ÖBB Nightjet|daily|21:48–06:06|498|NJ
Frankfurt|Leipzig|ČD/ÖBB EuroNight (Frankfurt Süd)|daily|00:28–05:49|321|NJ
Graz|Innsbruck|ÖBB Nightjet|daily|21:43–04:44|421|NJ
Graz|Prague|ÖBB Nightjet|daily|19:21–03:09|468|NJ
Graz|Rome|ÖBB Nightjet|daily|22:45–10:05|680|NJ
Graz|Zurich|ÖBB Nightjet|daily|21:43–09:20|697|NJ
Hamburg|Nuremberg|ÖBB Nightjet|daily|19:19–03:15|476|NJ
Hanover|Innsbruck|ÖBB Nightjet|daily|21:42–08:49|667|NJ
Hanover|Munich|ÖBB Nightjet|daily|21:42–06:42|540|NJ
Hanover|Nuremberg|ÖBB Nightjet|daily|21:42–03:15|333|NJ
Hanover|Vienna|ÖBB Nightjet|daily|21:42–09:39|717|NJ
Hanover|Zurich|ÖBB Nightjet|daily|00:30–10:05|575|NJ
Leipzig|Zurich|ČD/ÖBB EuroNight / Nightjet|daily|23:49–09:05|556|NJ
Ljubljana|Stuttgart|EuroNight (through coaches)|daily|22:10–08:43|633|BOT
Munich|Venice|ÖBB Nightjet (to Venezia Mestre)|daily|23:54–08:23|509|NJ
Nice|Paris|SNCF Intercités de nuit|daily|19:00–06:55|715|S61N
Nuremberg|Vienna|ÖBB Nightjet|daily|03:21–09:39|378|NJ
Prague|Rotterdam|European Sleeper|3×/week|18:04–07:27|803|ES
Rome|Venice|Trenitalia Intercity Notte|daily|22:35–06:25|470|BOT
Rome|Verona|Trenitalia Intercity Notte|weekends|23:00–04:28|328|BOT
Stuttgart|Venice|ÖBB Nightjet (to Venezia Mestre)|daily|20:29–08:23|714|NJ
Stuttgart|Vienna|EuroNight (through coaches)|daily|20:29–06:24|595|NJ
Stuttgart|Zagreb|EuroNight (through coaches)|daily|20:29–10:30|841|BOT
Venice|Vienna|ÖBB Nightjet|daily|21:05–07:51|646|NJ`.trim().split('\n').map(l => {
    const [a, b, op, freq, times, min, src] = l.split('|');
    return { a, b, op, freq, times, minutes: +min, src: NSRC[src] };
  });
  function nightTrains(idA, idB) {
    const na = CITIES[idA].name, nb = CITIES[idB].name;
    return NIGHT.filter(n => (n.a === na && n.b === nb) || (n.a === nb && n.b === na))
      .map(n => ({ ...n, reversed: n.a !== na }));
  }

  // ── CO₂e per passenger (EEA EU-27 averages, well-to-wheel; aviation incl. non-CO₂ ×1.7) ──
  const CO2 = { railG: 33, airG: 160, railDetour: 1.2, airExtraKm: 95,
    src: 'https://www.eea.europa.eu/en/analysis/publications/rail-and-waterborne-best-for-low-carbon-motorised-transport' };
  const gcKm = (p, q) => {
    const R = 6371, rad = Math.PI / 180, dLat = (q.lat - p.lat) * rad, dLng = (q.lng - p.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * rad) * Math.cos(q.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  function co2(route, year, fromId, toId) {
    const legs = route && route.legsByYear['y' + year];
    const railKm = legs ? legs.reduce((s, l) => s + gcKm(node(l.a), node(l.b)), 0) * CO2.railDetour : null;
    const airKm = gcKm(CITIES[fromId], CITIES[toId]) + CO2.airExtraKm;
    return { railKm: railKm && Math.round(railKm), railKg: railKm && Math.round(railKm * CO2.railG / 1000),
             airKm: Math.round(airKm), airKg: Math.round(airKm * CO2.airG / 1000) };
  }

  // ── Wire into data.js globals ──────────────────────────────────────────────
  EXTRA_CITIES.forEach(([id, name, lat, lng, station, note]) => CITIES.push(note ? { id, name, lat, lng, station, note } : { id, name, lat, lng, station }));

  const settings = { transfer: 10, timing: 'official' };
  function rebuild(next) {
    Object.assign(settings, next || {});
    const routes = build(settings);
    ROUTES.length = 0; routes.forEach(r => ROUTES.push(r));
  }

  return { rebuild, settings, node, flight, FLIGHT, PROJECTS, EDGES, PHASES, CS29, CS30, NIGHT, nightTrains, CO2, co2, YEARS, CHECKED, CONSERVATIVE_SLIP, scenarioFor };
})();

// Expose project metadata through the existing global used by the UI
Object.keys(PROJECTS).forEach(k => delete PROJECTS[k]);
Object.assign(PROJECTS, Network.PROJECTS);
Network.rebuild();
