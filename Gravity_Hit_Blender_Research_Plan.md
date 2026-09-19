# Gravity Hit / ZNICZ — przebudowa rekwizytów i interaktywnej wody

**Dokument wykonawczy dla agenta · audyt 16–17 września 2026**

## 1. Cel, zakres i najważniejsze ustalenia

Przebudować lufkę, butelkę PET, worek strunowy i susz tak, aby miały wiarygodną sylwetkę, materiały i zachowanie w aktualnej grze. Blender odpowiada za geometrię, UV, materiały bazowe, warianty stanów, morph targety i geometrię wnętrza butelki. Three.js odpowiada za interakcje, poziomowanie i kołysanie wody, odpływ, dym, osad oraz synchronizację z automatem gry.

**Najważniejsze odkrycie: obecne pliki `bottle.glb` i `pipe.glb` nie są ostatecznymi modelami widocznymi w grze.** `world.js:loadAssets()` je ładuje, ale `upgradeHeroProps()` w `props.js` zastępuje ich reprezentacje geometrią proceduralną. Sam eksport pięknego GLB pod starą nazwą nie poprawi obrazu. Najpierw potrzebny jest adapter zasobów, który ominie tę przebudowę.

**Drugi problem: obecna woda nie zna dokładnego wnętrza butelki.** Geometria, funkcja losowania próbek i maska tafli mają uproszczone, nieidentyczne definicje kształtu. Mogą przecinać żebra powłoki. `time` przekazywany do `Liquid.update()` nie animuje kołysania.

**Trzeci problem: odpływ w symulacji i wysokość otworu nie są spójne.** Próg `.072` nie odpowiada pozycji otworu `y=.032`. Wymianę grafiki i zmianę mechaniki należy wykonać w dwóch osobnych etapach, z zachowaniem kompatybilności zapisów.

To plan wraz z kodem generatora kandydatów, nie deklaracja ukończonej integracji. Docelowa jakość wymaga bake tekstur, wykończenia geometrii i kontroli w rendererze gry. Nie oceniać realizmu wyłącznie na renderze Cycles.

## 2. Odnaleziona wersja i zakres audytu

Na [Dysku w folderze Gravity Hit](https://drive.google.com/drive/folders/134bX4fHpotnyBViJNHhBLQ_b-T8yTvTB) znajdowały się foldery `15.09.2026`, `12.09.2026` i `old`. Najnowszy według nazwy to [15.09.2026](https://drive.google.com/drive/folders/1t1eu67yvMkmjf4fVYAZ3Jie4Iu6Ovs1V). Zawiera 128 części `Gravity Hit.zip.001`–`.128`; ostatnia część ma czas modyfikacji 14.09.2026 20:08:27 UTC. Nazwa folderu nie dowodzi daty wszystkich źródeł ani zgodności z kopią uruchamianą obecnie na komputerze użytkownika.

Odczytano pełny katalog ZIP64: **144 117 wpisów**. Selektywnie wydobyto bieżące źródła `Gravity Hit/work/game/src/`, konfigurację projektu, starsze generatory i GLB, `AGENTS.md`, istotne sekcje `PROJECT_HANDOFF.md` oraz `work/reference_pipe.png`. Analizowano bieżący `work/game`, nie checkpointy. Nie było potrzeby pobierania całego około 26,6 GB archiwum.

Stos: **Three.js 0.180.0**, `three-gpu-pathtracer 0.0.24`, `three-mesh-bvh 0.9.1`, Vite/Electron. Aktualizacja stosu nie jest częścią tego zadania.

| Element | Bieżące źródło | Co znaleziono |
|---|---|---|
| Butelka | `props.js:rebuildBottle` | Lathe 96 segmentów, żebra, pięciopłatkowe dno, wgniecenia, gwint, Canvas STILLWATER 2048×512 |
| Lufka | `props.js:rebuildPipe` | Wydrążony profil lathe, rozszerzenie końca, osad, szkło |
| Nakrętka | `props.js:createCapGeometry` | Pełna i z otworem; części zespołu rozpoznawane m.in. po materiale |
| Otwór butelki | `world.js` + `props.js` | Czarny `CircleGeometry` i rant `TorusGeometry`, bez wycięcia powłoki |
| Worek | `weed-bag.js` | Zdeformowany `BoxGeometry(…,30,30,10)`, normal map, grube listwy |
| Susz | `bud.js` i `weed-bag.js` | Proceduralne przysadki, liście i znamiona; 9 wariantów, 35 sztuk w torbie |
| Woda butelki | `liquid.js` | Przycinana objętość, osobna tafla, 1600 próbek wnętrza |
| Potok | `stream-water.js` | Odbicia, kolor/głębia dna, refrakcja, absorpcja, fale i własne składanie sceny |

Historyczne GLB: butelka **5440 trójkątów** (`BottleLabel`, `BottleShell`, `OutletMeltRim`, `PlasticCap`); lufka **2176 trójkątów** (`PipeGlass`, `RubberGrommet`). W bieżącym runtime ich wygląd jest zastępowany.

### Granice dowodów

Odczyt kodu, modeli i referencji wykonano; analizę matematyczną i testy modułu numerycznego wykonano. **Nie uruchomiono kompletnej gry ani sceny lasu.** Nie uzyskano zakończonego testu generatora w Blenderze: próba uruchomienia środowiska zakończyła się błędem przed walidacją generatora, a pliki robocze nie przetrwały przerwy sesji. Finalny generator został odtworzony i sprawdzony składniowo; status eksportu pozostaje `CURRENT BUILD NEEDS MANUAL CHECK`. Żaden model nie otrzymuje tu oceny „fotorealistyczny” bez oględzin.

Stosować słownik projektu: `USER VERIFIED CURRENT`, `AUTOMATED VERIFIED`, `CURRENT BUILD NEEDS MANUAL CHECK`, `PREVIOUS AGENT CLAIM`, `FIXED BUT REGRESSION-PRONE`, `SUPERSEDED`. Komentarze wcześniejszych agentów nie są dowodem jakości. Nie zmieniać lasu, zaakceptowanych krzewów, dna potoku, UI, audio ani przebiegu strumienia w ramach pracy nad rekwizytami.

## 3. Research — referencje i ich przełożenie na model

### 3.1. Typowa prosta lufka z polskiego sklepu

[iSmoking — Lufka Szklana Prosta 8 cm](https://www.ismoking.pl/lufka-szklana-prosta-8cm/) opisuje prostą szklaną rurkę długości 8 cm, z rozszerzeniem na jednym końcu i przewężeniem w pobliżu drugiego. Obecność klasycznej prostej lufki 8 cm potwierdza też [DYM, kategoria lufek, P10.196](https://dym.pl/lufki). Nie jest to fajka typu spoon ani gruby szklany cybuch laboratoryjny.

Bezpośrednio obejrzana referencja `work/reference_pipe.png` pokazuje bezbarwne szkło, prosty smukły korpus, łagodne rozszerzenie oraz lokalne przewężenie. Najsilniejsze sygnały wizualne to kontur, odbicia przy obrzeżach, światło widoczne przez kanał i grubość materiału na końcach. Mikro-rysy nie zastąpią poprawnego przekroju.

Aktualna geometria ma długość **96,5 mm** (`-.049` do `.0475`), około 21% większą od 80 mm. Przygotować dwa presety generatora:

- `--pipe-length-mm 80`: docelowa sklepowa referencja, kotwice z manifestu;
- `--pipe-length-mm 96.5`: porównanie bez zmiany dotychczasowego rozmiaru.

Nie skalować nakrętki razem z lufką. Skraca się tylko szkło, osad i kotwice szkła. Średnice w kodzie są propozycją artystyczną opartą na obecnym assetcie; nie są pomiarem konkretnej sztuki. Źródła nie dostarczyły technicznego przekroju, tolerancji ani pewnego rodzaju szkła. Nazwa „borosilicate” w kodzie nie dowodzi materiału każdej taniej lufki.

**Wymagania modelu:** dwa otwarte końce kanału; zamknięta objętość samego szkła; zaokrąglone obrzeża; przewężenie w geometrii; minimalna asymetria, nie organiczne pofalowanie całego korpusu. Przezroczystość głównie transmisją, nie niską alfą. Osad oddzielny, nierówny i przyklejony do powierzchni, narastający według `sim.residue`.

### 3.2. Butelka PET

[Petainer, 500 ml, 28 mm PCO 1810](https://www.petainer.com/pet-plastic-bottles/water-bottles/500ml-water-bottle-28mm-pco-1810) podaje średnicę 65 mm i wysokość 216,5 mm. Aktualna butelka gry ma korpus około 65,2 mm i wylot na 226 mm. To sensowna zbliżona klasa opakowania. Zachować kształt gry, zamiast wymuszać dokładną kopię Petainer i przenosić wszystkie interakcje.

Rozdzielić powłokę PET, szyjkę, gwint, etykietę, nakrętkę, wariant otworu i niewidoczne wnętrze. Zachować fikcyjną etykietę **STILLWATER**. Nie zastępować jej marką ze zdjęcia produktu. Grubość szyjki i obrzeża jest większa od korpusu; nie robić całej butelki jak kryształowej karafki. Żebra mają zmieniać refleksy, a wgniecenia być szerokie i umiarkowane. Rysy służą głównie roughness/normal, nie displacementowi całej siatki.

„Standard 28 mm” nie oznacza pełnej zgodności z dowolnym certyfikowanym gwintem. Model do gry wymaga dopasowania wizualnego i kotwic, a nie wytwórczej dokumentacji nakrętki.

### 3.3. Worek strunowy

[AZET, woreczki LDPE 40×60](https://www.azet.net.pl/pl/p/Woreczki-strunowe-40x60-LDPE-100szt./1407) podaje folię 40 μm i zamknięcie strunowe. To referencja materiału i konstrukcji, **nie docelowego wymiaru worka**. Gra używa około 92×132 mm; tę skalę zachować do kontroli ujęć dłoni i ilości zawartości.

Obecna shaderowa `thickness=.0011` to 1,1 mm. Nie jest automatycznie fizyczną grubością folii, ale może wzmacniać wygląd szkła. Jeszcze większy problem to listwy struny o głębokości około 20–22 mm — konstrukcyjnie robią z worka sztywny pojemnik.

Docelowo dwie cienkie ścianki, trzy zgrzane krawędzie, delikatne profile struny i luźna folia powyżej. Fałdy skupione przy chwytaniu, zgrzewach i kontaktach z zawartością. Unikać jednolitej sinusoidalnej kołdry i równomiernego szumu. Czerwony pasek jest wariantem referencji, nie obowiązkiem. Wnętrze musi pozostać czytelne przez folię.

### 3.4. Susz — forma i materiał

[Livingston i in., The Plant Journal](https://onlinelibrary.wiley.com/doi/full/10.1111/tpj.14516) opisują morfologię gruczołowych trichomów. [Badanie morfologii Cannabis sativa, Plants 12(20), 3646](https://www.mdpi.com/2223-7747/12/20/3646) dostarcza odniesienia do przysadek, znamion i cech kwiatów; wykorzystano informację indeksowaną, pełny tekst tego drugiego źródła nie został pobrany. Są to źródła botaniczne, nie dokładna referencja konkretnego wysuszonego produktu.

Własna specyfikacja artystyczna:

- asymetryczne zwarte kępy, kilka kierunków wzrostu i nieregularny obrys;
- przysadki jako dominująca struktura, bez wyglądu zielonych winogron;
- małe poskręcane fragmenty liści, bez wielkich rozpostartych wachlarzy;
- cienkie przygaszone rdzawo-brązowe znamiona, bez pomarańczowych kabli;
- trichomy głównie w normal/roughness i mikrorefleksie, geometria tylko przy najbliższym LOD;
- kolor plamami w skali fragmentu rośliny, bez losowego konfetti na każdym wierzchołku;
- osobna drobna porcja w czaszy, zamiast całego dużego topa włożonego w mały otwór.

Dziewięć wariantów ma różnić się sylwetką i rozgałęzieniem, nie tylko skalą. Proceduralny generator to baza rzeźby i bake, nie samodzielna gwarancja realizmu.

### 3.5. Woda — wybór techniki

[Wywiad autorski z Gilem Damoiseaux](https://80.lv/articles/simulating-liquids-in-a-bottle-with-a-shader) omawia sprężyny i shaderowe przedstawienie cieczy oraz ograniczenia deformowania bryły w zwężającym się pojemniku. [Andy Green, Container Water 00](https://andytech.art/container-water-00) i [Container Water 01](https://andytech.art/container-water-01) pokazują kontekst kosztów i potrzebę domknięcia powierzchni. Nie kopiować bezkrytycznie rozwiązania dla prostego cylindra do żebrowanej butelki.

**Decyzja dla tej gry:** zamknięte wnętrze z Blendera + ułamek objętości + dynamiczna płaszczyzna w świecie + tłumione kołysanie + osobna tafla będąca przekrojem wnętrza. To kontrolowane przybliżenie, nie CFD ani wierna rekonstrukcja Alyx.

| Technika | Przydatność tutaj | Decyzja |
|---|---|---|
| Mantaflow → cache siatki | Ładny ustalony ruch, brak dowolnego poziomu i reakcji gracza | Tylko opcjonalna referencja filmowa |
| Obracana bryła przypięta do butelki | Ciecz obraca się ze szkłem | Odrzucić |
| Duża płaszczyzna z promieniem cylindra | Tania, przecina żebra i źle działa po przechyleniu | Zastąpić wspólną granicą wnętrza |
| Przekrój cavity + kołysanie | Reaguje na poziom i transformacje, rozsądny koszt | Wariant bazowy |
| SDF wnętrza + shader | Obsługuje falowanie, wymaga buforu i testów rozdzielczości | Opcjonalne rozwinięcie |
| Pełny solver cząstkowy | Drogi w istniejącej ciężkiej scenie, utrudnia dym i save | Nie wprowadzać na start |

## 4. Kontrakt stanów gry i kotwic

### 4.1. Stany i wymagane warianty

| Stan / działanie | Wymagane zachowanie assetu |
|---|---|
| `collect`, `heat`, `prep=0` | Osobna lufka i pełna nakrętka; efekt na właściwej końcówce |
| `press` | Kontrolowane zbliżenie, wariant przygotowanej nakrętki ujawniany z postępem |
| `unscrew`, `uncap`, `screw` | Lufka i jej nakrętka poruszają się jako logiczne `items.pipe` |
| `hole` | Zamiana powłoki pełnej na powłokę z rzeczywistym prześwitem |
| `pack` | Otwarcie worka, transfer drobnej porcji do `BudSeat`, ubytek zawartości |
| `fill` | Nakrętka zdjęta, butelka przechylona przy potoku, poziom rośnie |
| `free`, odpływ | Ubytek wody; strumień dokładnie z `Outlet`; uszczelnienie go wyłącza |
| `inhale` | Obecna sekwencja, kamera i granica woda/dym pozostają zsynchronizowane |
| dzień 2 | Worek ukrywany, większy zapas `trash`; zachować rozgałęzienie |

To opis automatu programu. Model nie wprowadza nowych progów ani nie przejmuje sterowania kamerą. Zachować `held`, `supporting`, `prep`, `cap`, `outlet`, `water`, `stock`, `bud`, `embers`, `smoke`, `residue` i wersję zapisu 3.

### 4.2. Aktualne kotwice lokalne, metry, Y-up

| Kotwica | XYZ | Właściciel |
|---|---|---|
| `BottleMouth` | `(0,.226,0)` | `items.bottle` |
| `Outlet` | `(.0326,.032,0)` | `items.bottle` |
| kierunek odpływu | `(1,0,0)` | lokalna oś butelki |
| `PipeTip` | `(0,-.049,0)` | `items.pipe` |
| `BowlTarget` | `(0,.045,0)` | `items.pipe` |
| `BudSeat` | `(0,.040,0)` | `items.pipe` |
| nakrętka zespołu | `(0,0,0)` | `items.pipe`, przy montażu przenoszona do `BottleMouth` |

Przy lufce 80 mm trzy kotwice szkła zmieniają się proporcjonalnie zgodnie z manifestem; butelka i nakrętka nie zmieniają skali. Obecny montaż wykorzystuje obrót `6π*progress` i uniesienie `(1-progress)*.065`; przejście pozy trwa około `.32 s`. Zachować rytm ruchu i sprawdzić brak kolizji krótszej lufki z dłonią/UI. `interaction-view.js` ma własne kotwice etykiet — także przenieść do kontraktu.

Blender Z-up: punkt gry `(x,y,z)` zapisujemy jako `(x,-z,y)`. Eksporter `export_yup=True` wraca do Y-up. Po imporcie nie wykonywać drugiego automatycznego obrotu −90°.

### 4.3. Dwanaście konkretnych problemów integracji

1. `removeTree()`/przebudowa w `props.js` usuwa importowane modele. Nowy backend omija przebudowę butelki/lufki, zachowuje `correctLighter()`.
2. Nakrętka jest rozpoznawana przez tożsamość materiału i bezpośrednie dzieci grupy. GLB zagnieżdża obiekty. Zastąpić heurystykę jawnymi referencjami `capParts` lub rolami `userData`.
3. Czarny dysk nie wycina PET. Rant bez rzeczywistego prześwitu powtórzy problem.
4. `liquid.js` ma różne definicje wnętrza w geometrii, samplerze i GLSL. Zastąpić wspólnym `BottleCavity`.
5. Rowek przy `y=.1325` ma zewnętrzny promień `.0296`, a uproszczona ciecz około `.0318–.032`: możliwe wyjście ponad 2 mm poza powłokę.
6. `Liquid.update(amount,time)` nie wykorzystuje czasu do kołysania. Poziomowanie to nie animacja bezwładności.
7. Ciecz łączy `transmission=.78`, `opacity=.72`, `transparent=true`; worek podobnie. [Dokumentacja MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) zaleca `opacity=1` przy transmisji. Odstępstwo może być świadomym fallbackiem, ale nie utożsamiać go z poprawną optyką.
8. `world.js` co klatkę tworzy i usuwa `TubeGeometry` odpływu. Zastąpić stałym buforem.
9. Zawartość worka jest wskaźnikiem zapasu: `i < sim.stock*3.5`, 35 modeli. Nie importować torby z nieruchomą zawartością.
10. Globalny `lastDrawnResidue` utrudnia wiele instancji; cache osadu powinien być per instancja. Canvas 512×1024 wymaga zgodnych UV i kierunku V.
11. Zastępcza ciecz path tracera w `world.js` ma promień do `.059`, inny od butelki `.0326`. Tryb screenshot/offline również podłączyć do cavity.
12. Potok ma własny rendering sceny. Nowy pass butelki wpiąć w `stream.userData.renderScene`, bez dodatkowego pełnego renderowania lasu na każdy rekwizyt.

## 5. Specyfikacja pracy w Blenderze

### 5.1. Wyjścia generatora i organizacja

Załącznik A zapisać jako `generate_gravity_props.py`. Tworzy `gravity_props.blend`, osobne `bottle_hero.glb`, `pipe_hero.glb`, `cap_spare.glb`, `bag_hero.glb`, dziewięć `bud_N.glb`, `bottle_cavity.glb`, `prop_contract.json` oraz `generation_report.json`. To baza do wykończenia. Jeden plik `.blend` zawiera wszystkie edytowalne źródła; osobne rooty umożliwiają eksport niezależnych zasobów. Nakładające się rooty w roboczej scenie to wspólny układ odniesienia, nie docelowa scena prezentacyjna.

Dla finalnych modeli utrzymać kolekcje/warstwy HIGH, GAME, COLLISION/PHYSICS i QA. HIGH nie eksportować do gry. Opcjonalne osobne `.blend` dla butelki i lufki zapisać po wykończeniu przez odfiltrowanie właściwego rootu, z zachowaniem wspólnych materiałów i manifestu.

Jednostki: metry, scale 1. Nie stosować automatycznego normalize-to-unit-box. Nazwy i osie są kontraktem API, nie estetyczną preferencją.

### 5.2. Lufka i osad

Zbudować ciągły przekrój obejmujący zewnętrzną i wewnętrzną powierzchnię oraz obrzeża obu końców. Zamknięta objętość szkła ma pozostawić otwarty kanał. Nie zamykać kanału dyskiem. 96 segmentów obwodu to punkt startowy; więcej lokalnych pierścieni przy obrzeżach jest skuteczniejsze od globalnego subdivision.

Przewężenie modelować w obu powierzchniach. Grubość nie może stać się ujemna. Minimalne nieregularności ręcznie formowanego szkła wprowadzić po kontroli podstawowej bryły. Nie zakładać, że każda sklepowa sztuka jest identyczna.

UV cylindryczne; poligony przy szwie mają ciągłe U, nawet jeśli jedna strona otrzymuje U>1. Unikać interpolacji przez całą teksturę. Osad ma niezależny UV lub udokumentowane współdzielenie. Warstwa osadu leży odrobinę bliżej osi niż powierzchnia kanału; brak z-fighting i brak grubej brązowej tulei. Materiał generowany w kodzie jest placeholderem do zastąpienia maską Canvas/teksturą. Widoczność i pokrycie wynikają z `sim.residue`, nie czasu ściennego.

### 5.3. Powłoka butelki i prawdziwy otwór

Dwa warianty tej samej bryły: `BottleShell_Intact` i `BottleShell_Open`. Boolean `DIFFERENCE` wykonać w Blenderze na zamkniętej objętości ścianki. Wycięcie ma przeciąć tylko najbliższą stronę, nie przeciwległą. Rant asymetryczny, mały; bez idealnego czarnego torusa. Po Boolean sprawdzić ostre trójkąty, normalne, minimalną grubość i prześwit pod różnymi kątami.

Nie wykonywać CSG co klatkę w JavaScript. W fazie `hole` można lokalnie odkształcić pełną powłokę i zmienić barwę, a pod koniec istniejącego postępu zamienić wariant. Morph target nie zmienia topologii — sam nie tworzy nowego otworu. Stan po wczytaniu save musi od razu pokazać właściwy wariant, bez jednorazowego błysku pełnej powłoki.

Cavity reprezentuje pojemność. Jest zamknięte wirtualną pokrywą przy szyjce, bez wycięcia bocznego otworu. Otwory definiują przepływy, nie brak objętości referencyjnej. Próbki wody losować wewnątrz tej bryły, a nie wewnątrz uproszczonego cylindra.

Wspólny deformator dla zewnętrznej i wewnętrznej powierzchni ogranicza przenikanie. To jednak nie jest matematyczna gwarancja stałej grubości po normalnej: generator wykorzystuje odsunięcie radialne. Połączenia dna i szyjki oraz rowki wymagają kontroli odległości i samoprzecięć. Docelowe cavity powinno leżeć wewnątrz powłoki z małym, przetestowanym marginesem optycznym.

Etykieta ma zostać przypięta do aktualnego Canvas STILLWATER, z zachowaniem orientacji tekstu i zakładki. Jednolity materiał generatora nie jest finalną etykietą.

### 5.4. Nakrętki i montaż

Pełna nakrętka to oddzielny root. Przygotowana nakrętka jest częścią `items.pipe`. Nie scalać zespołu na stałe z butelką. `CapSeat` ma pozostać przy lokalnym początku zespołu; podczas montażu root trafia do `BottleMouth`.

Generator ma 48 oddzielnych małych żeber uchwytu, aby uniknąć niedopróbkowania powtarzalnego konturu. To rozwiązanie robocze. Przed eksportem finalnym scalić siatki współdzielące materiał albo wypalić żebra do normal mapy. Kilkadziesiąt osobnych draw calls dla nakrętki jest nieuzasadnione. Kołnierz/uszczelka jest osobnym elementem zespołu, nie częścią sklepowej lufki.

### 5.5. Worek

Model bazowy: dwie pofalowane siatki paneli, zgrzane boki i dół, otwarta góra. Cienką folię można renderować jako powierzchnię dwustronną; nie wymaga wielkiej zamkniętej bryły. Profile struny są oddzielne i muszą podążać za ustami worka.

Morph targety: `Basis`, `Empty`, `Open`; ręcznie dodać opcjonalne `Grip` i `RestOnSlab`. Sprawdzać kombinacje wag, szczególnie Empty=1/Open=1. Topologia wszystkich kluczy musi być zgodna. Generator nie implementuje pełnego cloth ani kontaktów z zawartością — to kolejne zadanie modelarskie.

Cloth w Blenderze można wykorzystać do ustalenia kształtu statycznego na zawartości, następnie zastosować wynik i uporządkować morph targety. Nie uruchamiać solvera cloth stale w przeglądarce. Stałe sinusoidy generatora wykończyć tak, aby fałdy wynikały z punktów chwytu i kontaktu.

Zawartość ma być osobno instancjonowana. Rozkład deterministyczny od dołu, liczba widocznych elementów zgodna z `stock`. Po ubytku górne sztuki znikają/opadają, zamiast odsłaniać pustki na dnie. Leżący worek potrzebuje drugiego rozkładu lub ograniczonego blendu pozycji. Ograniczanie tylko środka topa nie chroni przed przenikaniem: testować obrys po skali i rotacji. Obecne `layoutBagContents` nie daje pełnej gwarancji dla wszystkich obróconych anizotropowych brył.

### 5.6. Susz, porcja i zużycie

Zestaw końcowy: `Bud_A…Bud_I`, `PackedCharge`, `SpentCharge`, kilka `PackingParticle`. Generator daje całe budy i deformację `Spent`; osobną rozdrobnioną porcję agent tworzy z mniejszych części dopasowanych do wnętrza czaszy. Nie włożyć całego topa w skali 1 do `BudSeat`.

W HIGH rozwinąć kształt przysadek, lokalne zawinięcia liści i bardzo cienkie znamiona. W GAME zachować główne kontury, a trichomy przenieść do normal/roughness. Atlas tekstur wspólny dla wariantów, z niezależnymi obszarami lub przemyślanym ponownym użyciem.

`Spent` redukuje objętość; barwa i emisja wymagają osobnego materiału/maski. Emisja zależy od `sim.embers`, ma być plamista i znikać przy braku żaru. Zewnętrzny popielaty obszar i ciemniejsze wnętrze powinny mieć inną roughness. Zielona bryła nie powinna jednolicie świecić na czerwono.

## 6. Materiały, bake, eksport i wydajność

### 6.1. Co przenosi glTF

[Dokumentacja eksportera Blender glTF](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html) obejmuje siatki, materiały Principled, tekstury i morph targets. [Khronos o PBR extensions](https://www.khronos.org/blog/blender-gltf-i-o-support-for-gltf-pbr-material-extensions) wyjaśnia transmisję i objętość. Dowolne proceduralne shadery, Geometry Nodes, cloth i Mantaflow nie stają się automatycznie działającymi systemami Three.js. Efekty trzeba zastosować/wypalić albo odtworzyć w runtime.

Blender i Three nie są identycznymi rendererami. Ustawienia materiału po imporcie są częścią adaptera. `hide_render` nie jest niezawodnym kontraktem widoczności GLB — oba warianty eksportować i jawnie ustawiać ich widoczność przed pierwszą klatką.

### 6.2. Materiały docelowe

| Materiał | Kierunek | Co sprawdzić |
|---|---|---|
| Szkło lufki | transmission blisko 1, opacity 1, mała roughness, IOR bliski obecnemu 1.474 | Obrzeża, kanał, osad, tło; brak mleczności |
| PET | Cienka powłoka, IOR około obecnego 1.57, szersze refleksy niż szkło | Żebra i szyjka; grubość shaderowa nie równa się całej średnicy |
| LDPE | Bardzo cienki materiał, pofałdowany normal, umiarkowana roughness | Czytelność zawartości; brak wrażenia szklanego pudełka |
| Woda | IOR około 1.333, delikatna absorpcja i refleksy | Dym za i nad cieczą, granica tafli, brak białej farby |
| Nakrętka | Nieprzezroczysty matowy plastik | Odpowiedni skok roughness względem PET |
| Susz | Wysoka roughness, przestrzenny kolor, drobny normal | Brak plastikowych kulek i migoczącego brokatu |

Wartości IOR są punktem startowym z obecnego projektu, nie pomiarem konkretnego produktu. Obecny PET używa niestandardowej zależności alfa od kąta; nie usuwać jej bez porównania. Ustalić jeden tor optyczny dla danego materiału, zamiast przypadkowo sumować transmisję, alfę i dodatkowy efekt Fresnela.

### 6.3. Konkretna procedura bake

1. Uporządkować HIGH/GAME, zastosować skalę, sprawdzić normalne i nazwy. Drobne części powiązać z odpowiednimi meshami GAME.
2. UV z sensowną gęstością texeli, bez nakładania tam, gdzie wymagana unikalna maska osadu/zużycia. Zachować miejsce na dylatację mipów.
3. Zacząć od 2K dla bliskiego wspólnego atlasu; 1K może wystarczyć dla części, które zajmują mało ekranu. 4K dopiero po dowodzie niedostatecznej ostrości. Nie wymuszać maksymalnych tekstur dla wszystkich obiektów.
4. Cycles, Selected to Active, dopasowana cage HIGH→GAME. Normal tangent-space; [Blender Render Baking](https://docs.blender.org/manual/en/latest/render/cycles/baking.html). Sprawdzić projekcję drobnych znamion i cienkich krawędzi osobno.
5. Base Color bez oświetlenia, Roughness i AO jako dane. Normal/Roughness/AO w Non-Color; Base Color w sRGB. Nie wypalać jasnego światła studyjnego w albedo.
6. Nie przepalać czarnych szczelin AO. Drobne otwory mają wynikać z geometrii/normal, a nie z czarnej farby.
7. Eksport i reimport do pustej sceny; następnie GLTFLoader w Three 0.180.0. Sprawdzić UV, rozszerzenia, morph targety, kolory i normalne pod światłem gry.
8. Dopiero po porównaniu spakować kanały i ewentualnie dodać KTX2/Meshopt. Nowe dekodery to świadoma zmiana pipeline, nie domyślny obowiązek.

### 6.4. Budżety startowe, do pomiaru

To hipotezy projektowe, nie wynik benchmarku:

- butelka hero około 10–30 tys. widocznych trójkątów, wyłączony drugi wariant;
- lufka około 4–10 tys.; nakrętka kilka tys. lub mniej z bake;
- worek kilka tys. do około 10 tys. z morphami;
- top w torbie około 0,5–2 tys. w GAME; najbliższy wariant może mieć więcej;
- dziewięć wariantów grupować według materiału i instancjonować, nie mnożyć materiałów na każdą przysadkę;
- generator może przekraczać te budżety: jest bazą do optymalizacji, nie finalnym LOD.

Zmierzyć draw calls, trójkąty, pamięć tekstur i p95 czasu klatki przed/po na tym samym GPU i ustawieniach. W ciężkim lesie dodatkowy pełny render sceny może być droższy niż wszystkie nowe modele razem. Nie deklarować 60 FPS na podstawie rozmiaru GLB.

## 7. Dokładna architektura wody

### 7.1. Jeden kontrakt wnętrza

`prop_contract.json` zawiera osie, jednostki, kotwice, trójkąty cavity, objętość i próbki objętości. Wszystkie próbki są we współrzędnych lokalnych butelki Y-up. Cavity ma wirtualną pokrywę na szyjce. Stałe `.032` i ręczne funkcje promienia z różnych shaderów przestają być autorytetem kształtu.

Losowanie: równomiernie w pudełku ograniczającym, odrzucić punkty poza zamkniętą siatką. Generator używa parity ray cast z BVH i deterministycznego ziarna. Osobno sprawdzić manifold, orientację i samoprzecięcia; manifold nie gwarantuje braku samoprzecięć. Przy produkcyjnej walidacji porównać objętość siatki z niezależnym oszacowaniem próbkowym.

8192 próbek to punkt startowy. Porównać 4096/8192/16384 na docelowym CPU. Rozkład deterministyczny lub stratified może zmniejszyć migotanie kwantyla. Przy zerowej wodzie ukryć objętość i taflę; min/max losowych próbek nie są dokładnym dnem ani sufitem.

### 7.2. Równanie poziomu w świecie

Niech `p_i` będą punktami wnętrza, `M` macierzą świata butelki, `n` jednostkową normalną skierowaną w górę. Szukamy `d`, dla którego żądany ułamek próbek spełnia:

`n · (M p_i) <= d`.

Policzyć projekcje, posortować i interpolować kwantyl. To przybliżenie objętości, nie rozwiązanie dokładne. Dla pozycji nieruchomej `n=(0,1,0)`, niezależnie od osi butelki. Przy ruchu normalna może odchylić się o mały kąt wynikający z tłumionego modelu.

Lokalna płaszczyzna to transformacja pełnej płaszczyzny przez `Mᵀ`; nie tylko obrócenie normalnej. Załącznik B używa liniowej części macierzy do projekcji próbek i osobno translacji. Działa także przy skali, choć assety powinny mieć scale 1. Testy sprawdzają zgodność przestrzeni lokalnej i świata.

**Zgodność z grą:** obecny renderer używa `fraction=sim.water*.94`. Moduł B przyjmuje już ułamek cavity, więc początkowo przekazać właśnie `sim.water*.94`. Nie mnożyć dwa razy. Zmiana na fizyczne mililitry jest osobnym etapem.

### 7.3. Kołysanie

Model drugiego rzędu dla dwóch małych odchyleń: sprężyna + tłumienie. Pobudzenie pochodzi z filtrowanego przyspieszenia środka butelki w świecie, nie z kątów kamery. W kodzie bazowym kroki maksymalnie 1/120 s, ograniczenie impulsu i wygaszenie przy niemal pustej/pełnej bryle.

Procedura w runtime:

1. Po wszystkich animacjach przedmiotów wywołać aktualizację macierzy świata.
2. Wyznaczyć prędkość i przyspieszenie środka z pozycji świata; filtrować i ograniczać skoki.
3. Po teleportacji, zmianie właściciela, pauzie lub dużym dt zresetować historię ruchu oraz sprężynę.
4. Przekazać macierz i ilość do `BottleSurface.update`.
5. Z tego samego wyniku zaktualizować clipping objętości, taflę, granicę dymu i wysokość nad odpływem.

Bazowy kod nie dodaje pełnego wzbudzenia od czystego obrotu wokół nieruchomego środka. Agent powinien osobno dodać ograniczony impuls wynikający ze zmiany prędkości kątowej, jeśli porównanie ruchu wymaga tej reakcji. Nie mieszać osi lokalnych i świata. To świadomie uproszczony model, a nie ukryta obietnica pełnej dynamiki cieczy.

### 7.4. Tafla: przekrój cavity, nie dysk

Algorytm bazowy do wdrożenia w `liquid.js`:

1. Dla każdego trójkąta cavity obliczyć podpisane odległości do lokalnej płaszczyzny.
2. Jeśli krawędzie zmieniają znak, interpolować punkty przecięcia. Dla wierzchołków dokładnie na płaszczyźnie użyć jednej spójnej reguły epsilon.
3. Uzyskać odcinki przekroju. Łączyć końce z tolerancją dużo mniejszą od grubości rowka, np. startowo 1e-6–1e-5 m do sprawdzenia.
4. Zbudować graf sąsiedztwa i zamknięte pętle. Każdy zwykły punkt ma stopień 2. Inny stopień oznacza degenerację do rozwiązania, nie powód do losowego sortowania.
5. Zbudować ortonormalną bazę na płaszczyźnie i rzutować pętle do 2D.
6. Określić orientację i zawieranie pętli; triangulować z obsługą wklęsłości i otworów. Nie sortować wszystkich punktów po kącie wokół centroidu — przy wklęsłym przekroju daje niepoprawne połączenia.
7. Zapisać wynik w stałym `BufferGeometry`, ustawić `drawRange`; pozostałe trójkąty z poprzedniej klatki nie mogą pozostać widoczne.
8. Używać jednej płaszczyzny dla boków cieczy i tafli; minimalny offset optyczny tylko po sprawdzeniu szczeliny.

Cavity można uprościć z zachowaniem żeber i szyjki. Przeliczać przekrój tylko po istotnej zmianie płaszczyzny/poziomu; nie robić alokacji tysięcy obiektów Vector3 w każdej klatce. Budżet ustalić pomiarem. Kod B dostarcza obliczenia płaszczyzny, nie gotowy triangulator tego przekroju.

Drobne fale na start wyłącznie w normal mapie powierzchni. Geometryczne falowanie narusza zgodność płaskiej granicy i wymaga wspólnej funkcji dla tafli, clippingu, dymu i objętości. SDF jest opcją późniejszą, z osobnym kosztem pamięci i testem cienkich żeber.

### 7.5. Optyka: PET → woda → dym

Samo zwiększenie `renderOrder` nie rozwiązuje wielowarstwowej refrakcji. Wbudowany bufor transmisji nie jest uniwersalnym ray tracerem wszystkich przezroczystych warstw. Osobno testować pustą butelkę, półpełną, sam dym i dym nad wodą na tle potoku.

Najpierw wykorzystać istniejący renderer i materiały fizyczne. Jeśli warstwy znikają lub źle się załamują, wprowadzić kontrolowany pass dla rekwizytów:

- scenę nieprzezroczystą i potok przygotować tak jak dotąd;
- pobrać kolor i głębię w istniejącym etapie kompozycji;
- wyrenderować wymagane wnętrze/efekty do dedykowanego bufora;
- powłoka PET pobiera tło/wnętrze i stosuje ograniczoną refrakcję, absorpcję i refleksy;
- nie czytać tekstury render targetu, do którego właśnie trwa zapis — potrzebny osobny target/ping-pong;
- materiał końcowy przechodzi zarządzanie kolorem i tone mapping dokładnie raz.

To specyfikacja architektury, nie gotowy shader w załączniku. Nie należy deklarować błędu podwójnego tone mappingu w obecnej grze bez testu — jest to punkt kontroli przy nowym passie. Fallback jakościowy może uprościć refrakcję, zachowując poprawną granicę i czytelność wody.

`localWaterPlane` istniejącego kodu jest używane przez dym. Zmiana znaku normalnej w nowym module wymaga dostosowania nierówności w shaderze, nie bezmyślnego kopiowania czterech liczb. Woda poniżej płaszczyzny, dym powyżej; sprawdzić próbne punkty znane jako mokre/suche.

### 7.6. Niespójność odpływu: oddzielny etap

Obecna zwykła gałąź odpływu używa:

`flow = min(water-.072, dt*.15*sqrt(water-.072))`

przy otwartym i nieuszczelnionym odpływie, poza `fill`. `dt` ograniczane jest do `.05`. Uszczelnienie to zarówno `input.seal`, jak i `sim.seal`. Inne fazy mają własne reguły, więc nie zastępować całego automatu tym jednym wzorem.

Niezależna integracja uproszczonego profilu obecnej wody dała około **562,5 ml** pojemności proxy; przy `sim.water=.072` i mnożniku `.94` poziom pionowej butelki wynosi około **17,8 mm**. Otwór leży na **32 mm**. Udział objętości poniżej otworu odpowiada około `sim.water=.158`, nie `.072`. To przybliżone liczby dla starego proxy, nie pomiar rzeczywistej butelki i nie wartość do przepisania do nowego cavity.

**Etap A:** zachować przepływ mechaniki, poprawić grafikę i udokumentować niespójność. **Etap B:** liczyć wysokość nad otworem z tej samej tafli, co renderowanie; prędkość zależną od wysokości, przepływ od efektywnego pola i współczynnika wypływu, przeliczenie objętości na `sim.water`. Kalibrować tempo i pełny cykl gry, uwzględnić automatyzację dnia 2 i zapisy. Nie podawać fizycznie poprawnego przepływu, jeśli reszta automatu nadal używa starej skali.

Przy wylocie ponad taflą skorygowany przepływ musi wynosić 0. Przy niemal pustej butelce ukryć strumień bez NaN i ujemnej objętości. Otwarte ujście szyjki i odwrócenie butelki wymagają osobnych warunków rozlewania, jeśli gra ma je obsługiwać; nie są automatyczną konsekwencją shaderowego clippingu.

### 7.7. Strumień i napełnianie

Obecny strumień tworzy TubeGeometry na nowo. Zastąpić stałym buforem środka trajektorii i pierścieni. Załącznik B generuje środki paraboli; agent dopisuje pierścienie wzdłuż ciągłej ramy, normalne i indeksy. Ramę transportować, aby rurka nie skręcała się nagle przy zmianie kierunku. Ustawiać `needsUpdate`, `drawRange`, ewentualnie `DynamicDrawUsage`; [BufferAttribute](https://threejs.org/docs/pages/BufferAttribute.html).

Punkt startowy i kierunek przekształcać z `Outlet` przez aktualny matrixWorld. Czas lotu ustalić względem rzeczywistego miejsca trafienia w teren; obecny odczyt podłoża pod początkowym XZ nie daje gwarancji poprawnego miejsca uderzenia. Używać raycastu/heightfield dla trajektorii, nie jednego pionowego próbkowania pod wylotem.

Dla napełniania zachować istniejący obszar potoku i tor przedmiotu. Można dodać ograniczone bąbelki i falowanie przy szyjce, sterowane rzeczywistym stanem `fill`; po zakończeniu wygasić. Nie animować drugiej niezależnej ilości wody. Potok ma już własne fale, refrakcję i odbicia — nie przebudowywać go w ramach tego zadania.

## 8. Integracja — instrukcja wykonawcza plik po pliku

| Plik | Zadanie | Warunek zakończenia |
|---|---|---|
| `props.js` | Backend GLB obok legacy; ominąć rebuild dla nowych modeli; zachować lighter | Nowe modele nie znikają po `upgradeHeroProps` |
| `world.js` | Import rootów, explicit cap refs, kotwice, kolejność update, stały bufor odpływu | Pełna sekwencja interakcji działa |
| `liquid.js` | Cavity, próbkowanie/kwantyl, sprężyna, przekrój, wspólna płaszczyzna | Woda pozostaje w butelce i kołysze się |
| shader dymu / aktualizacja dymu | Odczyt tej samej płaszczyzny z poprawnym znakiem | Brak dymu pod taflą i szczeliny nad nią |
| `weed-bag.js` | Import folii i morphów, kontrola zapasu, nowy rozkład budów | Worek otwiera się i opróżnia |
| `bud.js` | Warianty atlasowane, oddzielna porcja, emisja i zużycie | Brak całego topa przecinającego szkło |
| `interaction-view.js` | Kotwice z kontraktu zamiast starych liczb | Etykiety wskazują krótszą lufkę poprawnie |
| `simulation.js` | Początkowo bez zmiany mechaniki; później osobna flaga fizycznego odpływu | Zachowane zapisy i automatyzacja |
| `stream-water.js` | Tylko potrzebne wpięcie optyki rekwizytów | Potok i las bez regresji |
| ścieżka path tracingu | Zastąpić osobną bryłę `.059` wspólnym cavity | Offline i runtime używają tego samego kształtu |

### Bezpieczna kolejność adaptera

1. Wczytać GLB oraz manifest asynchronicznie, bez usuwania dotychczasowego działającego zestawu.
2. Sprawdzić `schema`, jednostki, wymagane nazwy rootów, kotwic i morph targetów. Brak krytycznego elementu kończy się czytelnym błędem i fallbackiem do legacy.
3. Rozwiązać referencje przez `getObjectByName`/role; nie przez tożsamość materiału. [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [Object3D](https://threejs.org/docs/pages/Object3D.html).
4. Dodać root modelu pod istniejący logiczny `items.bottle`/`items.pipe`/`items.bag`, zachowując macierze i ownership. Nie tworzyć równoległego automatu ruchu.
5. Podłączyć Canvas etykiety, maskę osadu, materiały runtime i morph influences. Referencje do morphów pobierać z `morphTargetDictionary`, nie przez założony indeks.
6. Jawnie ustawić widoczność pełnej/przygotowanej nakrętki, powłok i rantu według `sim` jeszcze przed pierwszą klatką.
7. Podłączyć raycast tylko do właściwych części. Efekty, cavity, tafla, etykiety debug i kotwice nie mogą przechwytywać kliknięć; zachować `pickable=false` tam, gdzie potrzeba.
8. Dopiero po poprawnej walidacji odłączyć stary zestaw. Uważać na współdzielone tekstury i materiały przy `dispose()`; nie usuwać zasobu nadal używanego przez inne instancje.
9. Przed oceną wizualną potwierdzić skalę, obrót osi, położenie ujścia, punkt chwytu i dopasowanie montażu.
10. Zachować przełącznik backendu, aby porównanie before/after miało identyczną kamerę, pogodę, ekspozycję i stan gry.

### Etapy i wyniki

**P0 — bazowy dowód:** odczytać aktualne `AGENTS.md` i handoff, sprawdzić hashe, wykonać zrzuty i krótki film istniejącej gry, zapisać przykładowy save. Nie rozpoczynać od zmiany lasu.

**P1 — kontrakt:** szare modele i kotwice, import, kliknięcia, montaż/odkładanie. To ujawnia problemy osi i hierarchii przed pracą nad teksturami.

**P2 — geometria:** 80 mm lufka, butelka z rzeczywistym otworem, nakrętki, cienki worek, warianty budów i porcja. Walidacja przekrojów, normalnych i kolizji.

**P3 — PBR:** rzeźba HIGH, retopologia GAME, UV i bake; atlas, osad, etykieta, zużycie. Reimport GLB, kontrola w aktualnym świetle gry.

**P4 — ciecz:** cavity, poziom, przekrój, sprężyna i granica dymu; na początku zachować mapowanie `.94` i mechanikę legacy.

**P5 — optyka:** kontrola warstw PET/woda/dym i folia/susz. Dodatkowy pass tylko gdy istniejący renderer nie daje poprawnego wyniku.

**P6 — przepływ:** osobna zmiana za flagą; geometria otworu i wysokość tafli sterują odpływem; migracja/strojenie mechaniki i pełne przejście gry.

**P7 — optymalizacja/odbiór:** LOD, instancing, materiały, pamięć, p95, wszystkie stany i zapisy. Zestaw before/after i film ruchu; raport ograniczeń.

Nie oznaczać P3/P5/P7 jako wykonanych tylko dlatego, że generator zapisał plik. Współdzielona mapa roughness ani kolejny noise nie zastępuje oceny sylwetki i materiału.

## 9. Kontrola jakości

### 9.1. Geometria i eksport

- Lufka: otwarty kanał z obu stron, brak samoprzecięć profilu, dodatnia grubość i manifold szkła.
- Powłoka PET: oba warianty manifold; otwór tylko po jednej stronie; brak zerowych trójkątów i przewróconych normalnych po Boolean.
- Cavity: objętość dodatnia, zamknięcie, brak samoprzecięć i wyjść poza shell. Manifold sam nie wystarcza.
- Nakrętki: właściwy prześwit i skala, bez przenikania szyjki; kontrola po pełnym dokręceniu i w trakcie ruchu.
- GLB: ponowny import do pustej sceny, komplet nazw, scale 1, właściwe wymiary, poprawny kierunek kotwic.
- Worek: `Open` i `Empty` przy 0/0,5/1 oraz kombinacjach; struna podąża za folią; zawartość nie przenika po rotacji.
- Budy: różne kontury, atlas bez szwów w oczywistych miejscach, brak migotania trichomów w ruchu.
- Wszystkie state variants obecne w pliku; adapter wybiera widoczność, eksporter nie może ich przypadkowo pominąć.

### 9.2. Woda i stany

| Próba | Kryterium |
|---|---|
| Napełnienie 10/50/90%, obroty 0/45/90/135/180° | Ciecz wewnątrz, brak latającego dysku i zmiany objętości w zamkniętych warunkach |
| Nagły ruch i zatrzymanie | Kołysanie wygasa, brak trwałego dryfu |
| Ruch kamery bez zmiany macierzy butelki | Brak sztucznego impulsu |
| Zmiana held→fill→held, teleport/pauza | Brak eksplozji prędkości |
| 20/30/60/120 FPS | Zbliżona odpowiedź i tłumienie |
| Dym nad wodą | Wspólna granica, właściwy znak płaszczyzny |
| Pusty/pełny stan | Brak NaN, odwróconych trójkątów i resztkowej tafli |
| Otwór nad poziomem | Skorygowany odpływ 0; legacy opisane jako znany kompromis |
| Reload w połowie działania | Właściwe cap/outlet/water/stock, bez zdublowanych części |
| Dzień 2 | Zachowana automatyzacja i inny zapas |

Początkowy cel błędu objętości przy obrocie <1%, docelowo <0,5% dla hero. Weryfikować niezależną metodą, nie na tych samych próbkach użytych do znalezienia kwantyla. 8192 próbek nie gwarantuje tych tolerancji.

### 9.3. Obrazy i filmy

Identyczne światło, ekspozycja, FOV, kamera i stan. Ujęcia: lufka z boku i oba końce, czysta/z osadem, nakrętka góra/dół, butelka pusta/pełna/półpełna, otwór makro, worek pełny/pusty/otwarty, top makro, napełnianie przy potoku, odpływ, dym, wszystkie przedmioty na skale. Film 5–10 s pokazujący ruch i migotanie.

Najpierw oceniać sylwetkę i proporcje, potem materiał, mikrodetal i kontakt. Używać rzeczywistych zrzutów runtime. Nie zastępować ich obrazem generowanym AI ani renderem, który nie korzysta z tego samego pipeline. Status akceptacji wizualnej oddzielić od wyników testów automatycznych.

### 9.4. Wydajność

Ten sam sprzęt i ustawienia przed/po. Raport mediany i p95 czasu klatki, CPU/GPU, draw calls, trójkątów, pamięci tekstur i render targetów. Sprawdzić alokacje podczas 30 s odpływu. Początkowy cel: wzrost p95 nie większy niż 10%; jeśli potrzebny pass przekracza budżet, przygotować prostszy wariant optyki. Nie przenosić wyników z Unity/Alyx na tę grę.

## 10. Uruchomienie kodu i zakres gotowości

Wyodrębnić załączniki A/B/C do plików o podanych nazwach. Generator uruchamiać w **nowym procesie Blendera** — zaczyna od pustej sceny, więc nie wolno odpalać go w niezapisanym projekcie użytkownika.

```bash
blender --background --python generate_gravity_props.py -- --out ./gravity-props-candidates --pipe-length-mm 80 --samples 8192
node check_liquid.mjs
```

Najpierw wygenerować obok gry; nie nadpisywać od razu starych GLB. Po walidacji backendu używać nowych nazw `*_hero.glb`. Zmiany integracji wykonywać w osobnej gałęzi, małymi commitami odpowiadającymi etapom P1–P7.

**Wykonane w trakcie przygotowania dokumentu:**

- audyt wskazanej wersji źródeł i historycznych GLB;
- research produktowy, botaniczny i techniczny z rejestrem źródeł;
- kontrola składni finalnego skryptu Python;
- sprawdzenie odwrotności konwersji osi i długości 80 mm;
- niezależna kontrola braku ścisłych przecięć odcinków profilu lufki i skończonych wyników deformacji butelki;
- testy modułu B: poziomy w sześcianie, obroty, ogólna transformacja płaszczyzny, odpowiedź i wygaszenie przy czterech FPS, reset, suchy odpływ, parabola strumienia, uszczelnienie i ograniczenie dt — **PASS**.

**Pozostaje do wykonania przez agenta:** uruchomienie Blendera i poprawienie ewentualnych różnic API eksportera; oględziny oraz retopologia/bake; sprawdzenie samoprzecięć i rzeczywistej grubości; osobna porcja `PackedCharge`; atlas i LOD; triangulator tafli; materiały/kompozycja runtime; adapter i test pełnej gry. Kod B jest modułem numerycznym, nie gotowym zamiennikiem całego `liquid.js`.

`advanceLegacyFlow` zwraca tylko wielkość odpływu w zwykłej gałęzi. Nie mutuje stanu, nie uwzględnia całego automatu faz, nie zastępuje `inhale` ani automatyzacji dnia 2. Wywołujący zachowuje istniejące warunki faz, kolejność i przekazuje `input.seal`.

## 11. Rejestr źródeł

| Źródło | Wykorzystanie / ograniczenie |
|---|---|
| [iSmoking — prosta lufka 8 cm](https://www.ismoking.pl/lufka-szklana-prosta-8cm/) | Długość, forma, przewężenie; bez technicznego przekroju |
| [DYM — lufki](https://dym.pl/lufki) | Potwierdzenie typu produktu na polskim rynku |
| `work/reference_pipe.png` z archiwum | Obejrzana referencja projektu |
| [Petainer 500 ml PCO 1810](https://www.petainer.com/pet-plastic-bottles/water-bottles/500ml-water-bottle-28mm-pco-1810) | Wymiary producenta; sąsiednia referencja, nie replika |
| [AZET LDPE 40×60](https://www.azet.net.pl/pl/p/Woreczki-strunowe-40x60-LDPE-100szt./1407) | Folia, grubość, struna; inny rozmiar niż torba gry |
| [Livingston i in.](https://onlinelibrary.wiley.com/doi/full/10.1111/tpj.14516) | Trichomy; biologia nie jest pomiarem wysuszonego assetu |
| [Plants 12(20), 3646](https://www.mdpi.com/2223-7747/12/20/3646) | Indeksowane informacje o morfologii; pełny tekst niepobrany |
| [Gil Damoiseaux — wywiad techniczny](https://80.lv/articles/simulating-liquids-in-a-bottle-with-a-shader) | Pseudofizyka, sprężyny i ograniczenia geometrii |
| [Andy Green — Container Water 00](https://andytech.art/container-water-00) | Kontekst wyboru techniki |
| [Andy Green — Container Water 01](https://andytech.art/container-water-01) | Domknięcie cieczy |
| [Blender glTF](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html) | Eksport materiałów, siatek i deformacji; dokumentacja pobrana również bezpośrednio |
| [Blender Shape Keys](https://docs.blender.org/manual/en/latest/animation/shape_keys/shape_keys_panel.html) | Względne deformacje i wagi |
| [Blender Render Baking](https://docs.blender.org/manual/en/latest/render/cycles/baking.html) | Bake normalnych i danych PBR |
| [Khronos PBR](https://www.khronos.org/blog/blender-gltf-i-o-support-for-gltf-pbr-material-extensions) | Rozszerzenia transmisji/objętości |
| [Three MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) | Transmisja, opacity, thickness |
| [Three GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) | Import zasobów |
| [Three Object3D](https://threejs.org/docs/pages/Object3D.html) | Hierarchia i macierze |
| [Three BufferAttribute](https://threejs.org/docs/pages/BufferAttribute.html) | Aktualizacja geometrii bez ciągłej realokacji |

Dokumentacja `latest` może wyprzedzać Three 0.180.0 i wybraną wersję Blendera. Agent sprawdza nową właściwość w lokalnej wersji przed jej użyciem. Nie aktualizować automatycznie zależności tylko dlatego, że dokumentacja prezentuje nowsze API. Specyfikacja produktu dotyczy wskazanego produktu, a nie wszystkich sklepów i wszystkich typów opakowań. Własne parametry artystyczne wyraźnie oddzielono od danych źródłowych.

## 12. Identyfikacja audytowanej kopii

SHA-256 źródeł obliczone podczas audytu. Inny hash nie oznacza błędu — oznacza konieczność ponownego odczytu zmienionego pliku przed wdrożeniem.

```text
props.js            8f4c7b8b7802263ae3316244e5b0040e41402e95e12cc0908562cbd274e96ab3
liquid.js           b78090b09ef2a1ad5b61d4037cd90924f8757ac4aa1026b2c1cba0d42b74f49c
simulation.js       cc5803ca4a5bd1c2add960070da5e58c6e4fffa0172391ec79345789aee0447f
world.js            5866261c9acca21c0390ab60bd7b0c020471a1a25e2a9a3bd0f45c987dd9a041
weed-bag.js         616a640e7ba757c9a0d2205e527d8e9ae4ec10573e93b10208ee4e520f405f65
bud.js              cefeb2a24c72695a42293dfe13f0fee9fb8812449eb03c61a3efe16c2965d1b3
interaction-view.js 78a19590cab5553a91b23d7775135b725f3809f23751ecfcae0c148724f008a8
stream-water.js     2186454b3cc25104402abdb6ee47ff72d0c1c0537bb44e41777e0d1883d21576
```

## Załącznik A — Generator Blendera

Zapisz jako `generate_gravity_props.py`.

```python
"""Gravity Hit asset candidates. Blender 4.5+, NEW background process.
Run: blender --background --python generate_gravity_props.py -- --out ./out
All lengths metres. Engine (x,y,z) -> Blender (x,-z,y).
Not a finished PBR asset pack: follow the accompanying bake/integration plan.
"""
import math, json, random, argparse, sys
from pathlib import Path

OUTER=[(.0005,.007),(.0025,.0068),(.006,.0055),(.011,.0042),(.017,.0022),
 (.022,.0008),(.0255,.0002),(.0285,.0022),(.0308,.0075),(.032,.0155),
 (.0324,.0235),(.0326,.032),(.0326,.0365),(.0312,.0385),(.0298,.0405),
 (.0314,.0425),(.0326,.0445),(.0312,.0465),(.0298,.0485),(.0314,.0505),
 (.0326,.0525),(.0312,.0545),(.030,.0565),(.0326,.059),(.03205,.0605),
 (.032,.075),(.03185,.0895),(.032,.104),(.03205,.1185),(.0326,.1205),
 (.0312,.1225),(.0297,.1245),(.0313,.1265),(.0326,.1285),(.0312,.1305),
 (.0296,.1325),(.0313,.1345),(.0326,.1365),(.0312,.1385),(.0297,.1405),
 (.0313,.1425),(.0325,.1445),(.0314,.1465),(.0302,.1485),(.0324,.151),
 (.0315,.155),(.0295,.159),(.0308,.161),(.0296,.166),(.027,.171),
 (.0284,.173),(.0262,.179),(.0232,.186),(.0196,.193),(.0158,.200),
 (.0135,.205),(.0134,.2068),(.0168,.2075),(.0168,.209),(.0134,.2096),
 (.0134,.2105),(.0145,.2115),(.0133,.2125),(.0132,.214),(.0132,.222),
 (.0131,.2245),(.0128,.226)]
PIPE=[(.00345,-.049),(.00388,-.0487),(.00405,-.0478),(.00405,-.0462),
 (.00366,-.0448),(.00334,-.0427),(.00265,-.038),(.00334,-.034),(.00335,-.010),
 (.00336,.015),(.00340,.022),(.00356,.025),(.00390,.028),(.00435,.032),
 (.00485,.036),(.00525,.040),(.00545,.043),(.00546,.045),(.00530,.0465),
 (.00505,.0475),(.00466,.047),(.00435,.0457),(.00405,.0435),(.00365,.040),
 (.00320,.036),(.00295,.032),(.00275,.029),(.00275,.024),(.00272,.017),
 (.00272,-.010),(.00272,-.033),(.00195,-.038),(.00274,-.043),(.003,-.049)]

def eng(p):return (p[0],p[2],-p[1])
def blend(p):return (p[0],-p[2],p[1])
def clamp(x,a=0.,b=1.):return max(a,min(b,x))
def smooth(a,b,x):
 t=clamp((x-a)/(b-a));return t*t*(3-2*t)
def distort(r,y,a):
 if r<.004:return r,y
 foot=max(0,1-y/.024);petal=math.cos(a*5);dr=petal*.002*foot
 if y<.020:y+=max(0,-petal)*.006*foot
 dr+=abs(math.sin(a))**60*.00028*(y<.206)
 if .155<=y<=.198:
  dr+=(.5+.5*math.cos(a*8))**2.5*.00042*math.sin((y-.155)/.043*math.pi)
 for angle,cy,sy,sa,depth in [(.8,.105,.025,.55,.00085),(-2.15,.138,.022,.60,.00065)]:
  da=math.atan2(math.sin(a-angle),math.cos(a-angle))
  dr-=depth*math.exp(-((y-cy)/sy)**2-(da/sa)**2)
 return max(.00001,r+dr),y

def main():
 import bpy,bmesh
 from mathutils import Vector
 from mathutils.bvhtree import BVHTree
 argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
 ap=argparse.ArgumentParser();ap.add_argument('--out',required=True)
 ap.add_argument('--pipe-length-mm',type=float,default=80.)
 ap.add_argument('--samples',type=int,default=8192)
 args=ap.parse_args(argv);out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
 if bpy.app.version<(4,5,0):raise RuntimeError('Blender 4.5+ required; verify exporter API')
 if not 70<=args.pipe_length_mm<=100:raise ValueError('Unsupported art preset')
 if args.samples<1024:raise ValueError('At least 1024 samples required')
 bpy.ops.wm.read_factory_settings(use_empty=True)
 scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
 report={};roots={}
 def material(name,color,rough,trans=0,ior=1.5):
  m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
  for k,v in [('Base Color',(*color,1)),('Roughness',rough),('Metallic',0.),('IOR',ior),('Transmission Weight',trans)]:p.inputs[k].default_value=v
  return m
 glass=material('Glass_Clean',(.975,.99,.98),.04,1,1.474)
 pet=material('PET_Clear',(.985,.995,.99),.09,1,1.57)
 capmat=material('Cap_Green',(.018,.08,.037),.38)
 filmat=material('LDPE_Film',(.985,.99,.985),.23,1,1.46)
 residue=material('Residue_Amber_Placeholder',(.18,.065,.014),.40)
 green=[material('Bud_Olive_'+str(i),(.065+i*.015,.10+i*.016,.022+i*.006),.84) for i in range(4)]
 hairmat=material('Stigma_Russet',(.29,.095,.024),.72)
 stemmat=material('Stem_Dry',(.24,.17,.07),.87)
 def root(name):
  o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);roots[name]=o;return o
 def mesh(name,verts,faces,mat,parent):
  me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
  ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);ob.parent=parent
  if mat:me.materials.append(mat)
  bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
  for f in me.polygons:f.use_smooth=True
  return ob
 def lathe(name,profile,mat,parent,n=96,closed=False,deform=False):
  vv=[];rings=[]
  for r,y in profile:
   ids=[]
   for i in range(1 if r==0 else n):
    a=i*math.tau/n;rr,yy=distort(r,y,a) if deform else (r,y)
    ids.append(len(vv));vv.append(blend((rr*math.cos(a),yy,rr*math.sin(a))))
   rings.append(ids)
  ff=[]
  for j in range(len(rings) if closed else len(rings)-1):
   aa,bb=rings[j],rings[(j+1)%len(rings)]
   for i in range(n):
    k=(i+1)%n
    if len(aa)==len(bb)==1:break
    if len(aa)==1:ff.append((aa[0],bb[k],bb[i]))
    elif len(bb)==1:ff.append((aa[i],aa[k],bb[0]))
    else:ff.append((aa[i],aa[k],bb[k],bb[i]))
  ob=mesh(name,vv,ff,mat,parent);uv=ob.data.uv_layers.new(name='UVMap')
  lo=min(p[1] for p in profile);span=max(p[1] for p in profile)-lo or 1
  for f in ob.data.polygons:
   us=[]
   for li in f.loop_indices:
    x,y,z=eng(ob.data.vertices[ob.data.loops[li].vertex_index].co)
    us.append((math.atan2(z,x)/math.tau)%1)
   wrap=max(us)-min(us)>.5
   for li,u in zip(f.loop_indices,us):
    p=eng(ob.data.vertices[ob.data.loops[li].vertex_index].co)
    uv.data[li].uv=(u+1 if wrap and u<.5 else u,(p[1]-lo)/span)
  return ob
 def anchor(name,p,parent):
  o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=blend(p)
  o.empty_display_size=.004;o['role']='anchor';return o
 def tube(name,points,r,mat,parent):
  c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=2
  c.bevel_depth=r;c.bevel_resolution=2;c.use_fill_caps=True
  s=c.splines.new('POLY');s.points.add(len(points)-1)
  for p,q in zip(s.points,points):p.co=(*blend(q),1)
  o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=parent;c.materials.append(mat)
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  bpy.ops.object.convert(target='MESH');return bpy.context.object
 def copyobj(ob,name):
  o=ob.copy();o.data=ob.data.copy();o.name=name;scene.collection.objects.link(o);return o
 def cut(ob,center,r,depth,axis=(1,0,0)):
  bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=r,depth=depth,location=blend(center))
  cutter=bpy.context.object;cutter.rotation_mode='QUATERNION'
  cutter.rotation_quaternion=Vector((0,0,1)).rotation_difference(Vector(blend(axis)))
  mod=ob.modifiers.new('Authored_aperture','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
  bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
  bpy.data.objects.remove(cutter,do_unlink=True)
 def manifold(ob):
  bm=bmesh.new();bm.from_mesh(ob.data);bad=sum(not e.is_manifold for e in bm.edges)
  volume=abs(bm.calc_volume(signed=True));bm.free()
  if bad:raise RuntimeError(f'{ob.name}: {bad} non-manifold edges')
  if not math.isfinite(volume) or volume<=0:raise RuntimeError(f'{ob.name}: invalid volume')
  return volume
 bottle=root('BottleRoot')
 inner=[(0,.0075)]+[((.0118 if y>.205 else max(.00001,r-.00035)),y+(.00035 if y<.012 else 0)) for r,y in OUTER[1:]]
 skin=[(0,.007)]+OUTER[1:]+list(reversed(inner))
 intact=lathe('BottleShell_Intact',skin,pet,bottle,deform=True)
 opened=copyobj(intact,'BottleShell_Open');cut(opened,(.0326,.032,0),.0025,.012)
 manifold(intact);manifold(opened)
 intact['state']='outlet_false';opened['state']='outlet_true'
 # Do not hide variants before export. Adapter sets initial visibility.
 labelmat=material('Label_Preserve_Runtime_Canvas',(.72,.77,.67),.25)
 label=lathe('BottleLabel',[(.03215,.060),(.03215,.1185)],labelmat,bottle)
 label['runtimeTexture']='props.js:bottleLabel; preserve STILLWATER and UV orientation'
 pts=[(.01348*math.sin(t*math.tau*2.2),.2135+t*.0095,.01348*math.cos(t*math.tau*2.2)) for t in [i/144 for i in range(145)]]
 tube('NeckThread',pts,.00045,pet,bottle)
 for name,p in [('BottleMouth',(0,.226,0)),('Outlet',(.0326,.032,0)),('Grip',(0,.095,0))]:anchor(name,p,bottle)
 pts=[]
 for i in range(65):
  a=i*math.tau/64;r=.0026*(1+.05*math.sin(3*a)+.035*math.cos(7*a))
  pts.append((.03265+.00012*math.sin(5*a),.032+r*math.sin(a),r*math.cos(a)))
 rim=tube('OutletRim',pts,.00027,pet,bottle);rim['state']='outlet_true'
 physics=root('PhysicsRoot');cavity=lathe('BottleCavity',inner+[(0,.226)],None,physics,deform=True)
 volume=manifold(cavity)
 def cap_profile(hole):
  return [(hole,.0055),(.0134,.0055),(.0152,.0042),(.01535,.003),(.01535,-.0105),(.0146,-.0112),(.0142,-.0135),(.0135,-.009),(.0135,.0035),(hole,.0035)]
 spare=root('SpareCapRoot');fullcap=lathe('Cap_Intact',cap_profile(0),capmat,spare,closed=True)
 pipe=root('PipeRoot');drilled=lathe('Cap_Drilled',cap_profile(.00370),capmat,pipe,closed=True)
 manifold(fullcap);manifold(drilled)
 for par in [spare,pipe]:
  for i in range(48):
   a=i*math.tau/48
   tube('CapGrip_'+par.name+'_'+str(i),[(.01538*math.cos(a),y,.01538*math.sin(a)) for y in [-.009,.002]],.00017,capmat,par)
 scale=args.pipe_length_mm/96.5
 glassob=lathe('PipeGlass',[(r,y*scale) for r,y in PIPE],glass,pipe,closed=True);manifold(glassob)
 res=lathe('PipeResidue',[(r-.00008,y*scale) for r,y in PIPE[20:]],residue,pipe,n=64)
 res['runtimeMask']='sim.residue; replace placeholder opaque material'
 for name,p in [('PipeTip',(0,-.049*scale,0)),('BowlTarget',(0,.045*scale,0)),('BudSeat',(0,.040*scale,0)),('CapSeat',(0,0,0))]:anchor(name,p,pipe)
 collar=lathe('CapCollar',[(.0034,.0045),(.0045,.0045),(.0045,.0065),(.0034,.0065)],capmat,pipe,closed=True)
 collar['state']='prep_positive'
 bag=root('BagRoot');nx=32;ny=40;vv=[];ff=[]
 for side in [-1,1]:
  for j in range(ny+1):
   v=j/ny;y=.132*v
   for i in range(nx+1):
    u=2*i/nx-1;x=.046*u
    envelope=max(0,math.sin(math.pi*v))**.7*max(0,1-u*u)
    z=side*(.00010+.0178*envelope)
    wrinkle=(math.sin(u*16+v*27)+.35*math.sin(u*41-v*19))*.00042*envelope
    vv.append(blend((x,y,z+side*wrinkle)))
 stride=(nx+1)*(ny+1)
 for side in range(2):
  off=side*stride
  for j in range(ny):
   for i in range(nx):
    a=off+j*(nx+1)+i;f=(a,a+1,a+nx+2,a+nx+1);ff.append(f if side else tuple(reversed(f)))
 for i in range(nx):ff.append((i,i+1,stride+i+1,stride+i))
 for j in range(ny):
  a=j*(nx+1);b=(j+1)*(nx+1);ff.append((a,b,stride+b,stride+a))
  a+=nx;b+=nx;ff.append((a,stride+a,stride+b,b))
 film=mesh('BagFilm',vv,ff,filmat,bag);film.shape_key_add(name='Basis')
 uv=film.data.uv_layers.new(name='UVMap')
 for f in film.data.polygons:
  for li in f.loop_indices:
   x,y,z=eng(film.data.vertices[film.data.loops[li].vertex_index].co)
   uv.data[li].uv=(x/.092+.5,y/.132)
 empty=film.shape_key_add(name='Empty');op=film.shape_key_add(name='Open')
 for i,v in enumerate(film.data.vertices):
  x,y,z=eng(v.co);empty.data[i].co=blend((x,y,z*.12));sign=-1 if i<stride else 1
  op.data[i].co=blend((x,y,z+sign*.008*smooth(.098,.129,y)*max(0,1-(x/.046)**2)))
 for side in [-1,1]:
  rail=tube('ZipRail_'+str(side),[(x,.1255,side*.0021) for x in [-.046+i*.092/32 for i in range(33)]],.00045,filmat,bag)
  rail.shape_key_add(name='Basis');k=rail.shape_key_add(name='Open')
  for i,v in enumerate(rail.data.vertices):
   x,y,z=eng(v.co);k.data[i].co=blend((x,y,z+side*.008*smooth(.098,.129,y)*max(0,1-(x/.046)**2)))
 anchor('BagMouth',(0,.129,0),bag);anchor('BagGrip',(-.038,.115,0),bag)
 def ellipsoid(p,sc,mat,parent,rng):
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1)
  o=bpy.context.object;o.name='Bract';o.parent=parent
  for v in o.data.vertices:
   q=v.co;noise=1+rng.uniform(-.085,.085);q.x*=sc[0]*noise;q.y*=sc[2]*noise;q.z*=sc[1]*noise
  o.location=blend(p);o.data.materials.append(mat)
  for f in o.data.polygons:f.use_smooth=True
  return o
 budroots=[]
 for variant in range(9):
  rng=random.Random(420+variant*37);br=root('BudRoot_'+str(variant));parts=[]
  for i in range(38+variant%4*3):
   t=i/(37+variant%4*3);a=i*2.399963+rng.uniform(-.35,.35)
   radial=(.0006+.0018*math.sin(t*math.pi))*(1+.13*math.sin(variant+a*3))
   p=(math.cos(a)*radial,(t-.5)*.006,math.sin(a)*radial);rr=rng.uniform(.00065,.00105)
   o=ellipsoid(p,(rr,rr*rng.uniform(1.25,1.9),rr*.8),rng.choice(green),br,rng)
   o.rotation_euler=(rng.uniform(-.8,.8),rng.uniform(-.8,.8),a);parts.append(o)
  for i in range(10):
   a=rng.uniform(0,math.tau);y=rng.uniform(-.002,.002);r=.002
   base=(r*math.cos(a),y,r*math.sin(a));tip=((r+.0016)*math.cos(a),y+.0005,(r+.0016)*math.sin(a))
   tangent=(-math.sin(a)*.00045,0,math.cos(a)*.00045)
   pts=[base,tuple(base[k]+tangent[k] for k in range(3)),tip,tuple(base[k]-tangent[k] for k in range(3)),((r+.0008)*math.cos(a),y+.0004,(r+.0008)*math.sin(a))]
   parts.append(mesh('SmallLeaf',[blend(p) for p in pts],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],rng.choice(green),br))
  for i in range(18):
   a=rng.uniform(0,math.tau);y=rng.uniform(-.0015,.0025)
   pts=[((.002+t*.0008)*math.cos(a+t*.8),y+t*.0013,(.002+t*.0008)*math.sin(a+t*.8)) for t in [j/6 for j in range(7)]]
   parts.append(tube('Stigma',pts,.000045,hairmat,br))
  parts.append(tube('Stem',[(0,-.0035,0),(0,.001,0)],.00022,stemmat,br))
  bpy.ops.object.select_all(action='DESELECT')
  for o in parts:o.select_set(True)
  bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();bud=bpy.context.object;bud.name='Bud_'+str(variant)
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
  bpy.ops.uv.smart_project(island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
  bud.shape_key_add(name='Basis');burn=bud.shape_key_add(name='Spent')
  for i,v in enumerate(bud.data.vertices):
   x,y,z=eng(v.co);burn.data[i].co=blend((x*.78,(y+.0035)*.62-.0035,z*.78))
  bud['needsPBRBake']=True;budroots.append(br)
 cavity.data.calc_loop_triangles();verts=[eng(v.co) for v in cavity.data.vertices]
 triangles=[list(t.vertices) for t in cavity.data.loop_triangles]
 bvh=BVHTree.FromPolygons([Vector(v) for v in verts],triangles,all_triangles=True)
 def inside(p):
  ray=Vector((1,0,0));p=Vector(p);hits=0
  for _ in range(128):
   hit,normal,index,d=bvh.ray_cast(p,ray,1.)
   if hit is None:return hits%2==1
   hits+=1;p=hit+ray*1e-8
  raise RuntimeError('Cavity ray did not converge')
 rng=random.Random(881);samples=[];tries=0
 while len(samples)<args.samples:
  tries+=1
  if tries>args.samples*20:raise RuntimeError('Cavity sampling failed')
  p=(rng.uniform(-.035,.035),rng.uniform(0,.226),rng.uniform(-.035,.035))
  if inside(p):samples.append(p)
 manifest={'schema':1,'units':'m','engineAxes':'Y-up','blenderAxes':'Z-up',
  'pipeLengthMM':args.pipe_length_mm,'bottleMouth':[0,.226,0],
  'outlet':[.0326,.032,0],'outletDirection':[1,0,0],
  'pipeTip':[0,-.049*scale,0],'bowlTarget':[0,.045*scale,0],'budSeat':[0,.040*scale,0],
  'cavityVolumeM3':volume,'vertices':verts,'triangles':triangles,'samples':samples,
  'legacyWaterScale':.94,'legacyDrainThreshold':.072,
  'status':'CURRENT BUILD NEEDS MANUAL CHECK'}
 (out/'prop_contract.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
 def export_root(par,filename):
  bpy.ops.object.select_all(action='DESELECT');par.select_set(True)
  for o in par.children_recursive:o.select_set(True)
  bpy.ops.export_scene.gltf(filepath=str(out/filename),export_format='GLB',use_selection=True,
   export_yup=True,export_extras=True,export_animations=False,export_morph=True)
  for o in par.children_recursive:
   if o.type=='MESH':o.data.calc_loop_triangles()
  report[filename]={'objects':len(par.children_recursive),'triangles':sum(len(o.data.loop_triangles) for o in par.children_recursive if o.type=='MESH')}
 for par,name in [(bottle,'bottle_hero.glb'),(spare,'cap_spare.glb'),(pipe,'pipe_hero.glb'),(bag,'bag_hero.glb'),(physics,'bottle_cavity.glb')]+[(r,'bud_'+str(i)+'.glb') for i,r in enumerate(budroots)]:export_root(par,name)
 # Preview defaults are applied only after export of all state variants.
 opened.hide_render=True;rim.hide_render=True;cavity.hide_render=True;res.hide_render=True
 bpy.ops.wm.save_as_mainfile(filepath=str(out/'gravity_props.blend'))
 (out/'generation_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 print('Generated candidates:',out)

if __name__=='__main__':main()
```

## Załącznik B — Rdzeń numeryczny cieczy

Zapisz jako `liquid_core.mjs`.

```javascript
// Numerical core only; Three.js geometry/material adapter is specified in the plan.
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export class BottleSurface {
 constructor(samples){
  if(samples.length<8||samples.some(p=>p.length!==3||p.some(x=>!Number.isFinite(x))))throw Error('Invalid cavity samples');
  this.samples=samples;this.h=new Float64Array(samples.length);
  this.sx=0;this.sz=0;this.vx=0;this.vz=0;
  this.normal=[0,1,0];this.localPlane=[0,1,0,0];this.offset=0;
 }
 reset(){this.sx=this.sz=this.vx=this.vz=0;}
 update(dt,amount,m,ax=0,az=0){
  // m: column-major bottle.matrixWorld.elements. ax/az: filtered WORLD acceleration.
  if(!Number.isFinite(dt)||dt<0||!Number.isFinite(amount))throw Error('Invalid time/amount');
  if(m.length!==16||!Number.isFinite(ax)||!Number.isFinite(az))throw Error('Invalid transform/acceleration');
  if(dt>.12){this.reset();dt=0;}
  dt=Math.min(dt,.05);amount=clamp(amount);
  const k=70,c=10;let remaining=dt;
  while(remaining>1e-9){
   const h=Math.min(remaining,1/120);remaining-=h;
   const tx=clamp(ax/9.81,-.18,.18),tz=clamp(az/9.81,-.18,.18);
   this.vx+=(k*(tx-this.sx)-c*this.vx)*h;
   this.vz+=(k*(tz-this.sz)-c*this.vz)*h;
   this.sx+=this.vx*h;this.sz+=this.vz*h;
  }
  const envelope=Math.sin(Math.PI*amount);
  let nx=this.sx*envelope,ny=1,nz=this.sz*envelope;
  const inv=1/Math.hypot(nx,ny,nz);nx*=inv;ny*=inv;nz*=inv;
  this.normal[0]=nx;this.normal[1]=ny;this.normal[2]=nz;
  const lx=nx*m[0]+ny*m[1]+nz*m[2];
  const ly=nx*m[4]+ny*m[5]+nz*m[6];
  const lz=nx*m[8]+ny*m[9]+nz*m[10];
  for(let i=0;i<this.samples.length;i++){
   const p=this.samples[i];this.h[i]=lx*p[0]+ly*p[1]+lz*p[2];
  }
  this.h.sort();
  const q=amount*(this.h.length-1),i=Math.floor(q);
  const localD=this.h[i]+(this.h[Math.min(i+1,this.h.length-1)]-this.h[i])*(q-i);
  const translation=nx*m[12]+ny*m[13]+nz*m[14];
  this.offset=localD+translation;
  this.localPlane[0]=lx;this.localPlane[1]=ly;this.localPlane[2]=lz;this.localPlane[3]=-localD;
  return this;
 }
 heightAt(x,z){return (this.offset-this.normal[0]*x-this.normal[2]*z)/this.normal[1];}
}
export function advanceLegacyFlow(sim,dt,inputSeal=false){
 // Only the ordinary draining branch. Returns volume increment, does not mutate sim.
 // The caller preserves original phase gates, inhale/day-2 branches and ordering.
 dt=Number.isFinite(dt)?clamp(dt,0,.05):0;
 if(sim.outlet&&!(inputSeal||sim.seal)&&sim.mode!=='fill'&&sim.water>.072){
  return Math.min(sim.water-.072,dt*.15*Math.sqrt(sim.water-.072));
 }
 return 0;
}
export function outletHead(surface,outletWorld){
 return Math.max(0,surface.heightAt(outletWorld[0],outletWorld[2])-outletWorld[1]);
}
export function writeJetCenters(buffer,start,direction,speed,duration){
 if(buffer.length<6||buffer.length%3)throw Error('Need at least 2 xyz vertices');
 // direction is a WORLD unit vector. Caller computes normalized outlet direction.
 const n=buffer.length/3;
 for(let i=0;i<n;i++){
  const t=duration*i/(n-1),j=i*3;
  buffer[j]=start[0]+direction[0]*speed*t;
  buffer[j+1]=start[1]+direction[1]*speed*t-4.905*t*t;
  buffer[j+2]=start[2]+direction[2]*speed*t;
 }
 return buffer;
}
```

## Załącznik C — Testy rdzenia cieczy

Zapisz jako `check_liquid.mjs`.

```javascript
import assert from 'node:assert/strict';
import {BottleSurface,writeJetCenters,outletHead,advanceLegacyFlow} from './liquid_core.mjs';
const pts=[];
for(let x=0;x<20;x++)for(let y=0;y<20;y++)for(let z=0;z<20;z++)pts.push([(x+.5)/20-.5,(y+.5)/20-.5,(z+.5)/20-.5]);
const id=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const s=new BottleSurface(pts);s.update(0,.5,id);assert(Math.abs(s.offset)<1e-12);
for(const a of [0,.2,.8,1.5,2.5,Math.PI]){
 const m=[Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1,0,2,3,4,1];
 s.update(0,.5,m);assert(Math.abs(s.offset-3)<1e-12);
 for(const p of pts.slice(0,30)){
  const lhs=s.localPlane[0]*p[0]+s.localPlane[1]*p[1]+s.localPlane[2]*p[2]+s.localPlane[3];
  const worldY=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13];assert(Math.abs(lhs-(worldY-s.offset))<1e-12);
 }
}
// General tilted normal and nonuniform scale: compare full plane identity.
s.sx=.12;s.sz=-.07;
const m=[1.7,.2,.1,0,-.3,.9,.2,0,.1,-.2,.7,0,2,3,-4,1];
s.update(0,.37,m);
for(const p of pts.filter((_,i)=>i%113===0)){
 const w=[0,1,2].map(r=>m[r]*p[0]+m[r+4]*p[1]+m[r+8]*p[2]+m[r+12]);
 const lhs=s.localPlane[0]*p[0]+s.localPlane[1]*p[1]+s.localPlane[2]*p[2]+s.localPlane[3];
 assert(Math.abs(lhs-(w.reduce((a,x,i)=>a+x*s.normal[i],0)-s.offset))<1e-12);
}
const final=[],peak=[];
for(const fps of [20,30,60,120]){
 const v=new BottleSurface(pts);let max=0;
 for(let i=0;i<fps*4;i++){v.update(1/fps,.5,id,i<fps?1.5:0,0);max=Math.max(max,v.sx);}
 assert(Math.abs(v.sx)<1e-5);final.push(v.sx);peak.push(max);
}
assert(Math.max(...final)-Math.min(...final)<1e-6);
assert(Math.max(...peak)-Math.min(...peak)<.001);
s.reset();s.update(0,.5,id);assert.equal(outletHead(s,[0,.1,0]),0);
s.sx=.1;s.vx=1;s.update(1,.5,id);assert.equal(s.sx,0);assert.equal(s.vx,0);
for(const fraction of [.1,.25,.5,.75,.9]){
 s.update(0,fraction,id);assert(Math.abs(s.offset-(fraction-.5))<=.026);
}
const b=new Float32Array(36);writeJetCenters(b,[1,2,3],[1,0,0],1,.2);
assert.deepEqual(Array.from(b.slice(0,3)),[1,2,3]);assert(Math.abs(b[34]-(2-4.905*.04))<1e-6);
const state={outlet:true,seal:false,mode:'idle',water:.5};
assert.equal(advanceLegacyFlow(state,.02,true),0);
assert.equal(advanceLegacyFlow(state,NaN),0);
assert.equal(advanceLegacyFlow(state,1),advanceLegacyFlow(state,.05));
assert.equal(advanceLegacyFlow({...state,mode:'fill'},.05),0);
console.log('PASS: cube levels, rotations, general plane transform, 4 FPS response/decay, reset, dry outlet, jet, seal and dt.');
```
