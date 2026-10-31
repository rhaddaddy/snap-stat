/* Card IDs as the game writes them in deck codes (letters without a,e,i,o,u,y, then the full ID length in hex), mapped to card names.
   Decoded from a SnapVault export; cost and power are filled in later. */
const CARD_EXTRA = `AbsrbngMnC|Absorbing Man
AdmWrlckB|Adam Warlock
AdmntmInfsn12|Adamantium Infusion
Agmtt8|Agamotto
Agn5|Agony
AgnWbSlngrs10|Agony (Web Slingers)
AgntClsnC|Agent Coulson
AgntVnmA|Agent Venom
AgthHrknssE|Agatha Harkness
Ajx4|Ajax
Alth6|Alioth
AmrcChvzD|America Chavez
Angl5|Angel
Annhls9|Annihilus
AnnhlsChmpn11|Annihilus (Champion)
AntM7|Aunt May
AntPlrMgnt10|Unknown card (AntPlrMgnt10)
AntVnm9|Anti-Venom
AntVnmWbSlngrs14|Anti-Venom (Web Slingers)
Ar4|Aero
ArWlkr9|Air-Walker
ArchnglHrsmn11|Archangel (Horseman)
Arn5|Araña
ArnmZl9|Arnim Zola
Arr6|Aurora
Ars4|Ares
Arshm7|Arishem
Asknsn9|Askani'son
AstrlPrjctn10|Astral Projection
Attm6|Attuma
AwsmAndB|Awesome Andy
Blb4|Blob
BlckBlt9|Black Bolt
BlckCt8|Black Cat
BlckKnghtB|Black Knight
BlckSwn9|Black Swan
BlckWdwA|Black Widow
Blls8|Bullseye
Blnk5|Blink
Bmrng9|Boomerang
BrcBnnrB|Bruce Banner
BrnMrdA|Baron Mordo
BrnZm9|Baron Zemo
Bst5|Beast
Bstn7|Bastion
BtRBllB|Beta Ray Bill
Btrc6|Batroc
Cbr5|Cobra
CclpsXMnB|Cyclops (X-Men)
Chmbr7|Chamber
Chmln9|Chameleon
Cl4|Clea
ClbnHrsmnF|Caliban (Horseman)
Clk5|Cloak
CllObsdnC|Cull Obsidian
CllnWngB|Colleen Wing
ClnlAmrcE|Colonel America
CnnnbllA|Cannonball
Cpct7|Copycat
CptnAmrcAvngrs16|Captain America (Avengers)
CptnCrtrD|Captain Carter
CptnMrvlD|Captain Marvel
Cr6|Caiera
CrngChmpnF|Carnage (Champion)
CrssbnsA|Crossbones
Crstl7|Crystal
CrvsGlvC|Corvus Glaive
CsmcGhstRdr10|Cosmic Ghost Rider
CssndrNvD|Cassandra Nova
DctrOctpsD|Doctor Octopus
DctrOctpsFrctrdFrntr1E|Doctor Octopus (Fractured Frontier)
DctrStrngAvngrs15|Doctor Strange (Avengers)
DfnngChrdE|Deafening Chord
Dggr6|Dagger
Dkn5|Daken
Dm20998|Doom 2099
Dmn6|Domino
DmndbckB|Diamondback
Dngr6|Danger
Drdvl9|Daredevil
DrgnLrdA|Dragon Lord
DrgnOfThMnF|Dragon of the Moon
Drkhwk8|Darkhawk
Drmmm8|Dormammu
Drx4|Drax
DrxAvtrOfLf10|Drax, Avatar of Life
DrxGrdnsOfThGlx18|Drax (Guardians of the Galaxy)
DthFrctrdFrntr16|Death (Fractured Frontier)
Dthlk8|Deathlok
Dzzlr7|Dazzler
EbnMw8|Ebony Maw
Ech4|Echo
ElsBldstnE|Elsa Bloodstone
Elxr6|Elixir
EnSbhNrA|En Sabah Nur
EntrpcHvkD|Entropic Havok
EsmCckA|Esme Cuckoo
Esn4|Eson
EzklSmsB|Ezekiel Sims
Flcn6|Falcon
FllnOn9|The Fallen One
FnF6|Unknown card (FnF6)
FnFngFmB|Fin Fang Foom
FnrsWlfA|Fenris Wolf
Fntmx8|Fantomex
FntstcrB|Fantasticar
Frgg6|Frigga
Frhr8|Firehair
Frlrd8|Firelord
FrndlNghbrhdCrng1B|Friendly Neighborhood Carnage
FrnkRB|Frankie Raye
FstbllSpclF|Fastball Special
Ggnt7|Giganto
Ghst5|Ghost
GhstRdrChmpn12|Ghost Rider (Champion)
GhstSpdrB|Ghost-Spider
GhstSpdrWbSlngrs16|Ghost-Spider (Web Slingers)
GhstThFrstRdr12|Ghost, the First Rider
GhstThndrblts11|Ghost (Thunderbolts)
Glct7|Galacta
Glcts8|Galactus
GlctsFrstStps12|Galactus (First Steps)
Gldtr9|Gladiator
Glgmsh9|Gilgamesh
Glth7|Goliath
Gmbt6|Gambit
GmbtHrsmnE|Gambit (Horseman)
GmrGrdnsOfThGlx1A|Gamora (Guardians of the Galaxy)
Grgn6|Gorgon
GrnGblnB|Green Goblin
GrndMstrB|Grandmaster
Grr4|Gorr
Grt5|Groot
GrtGrdnsOfThGlx19|Groot (Guardians of the Galaxy)
Gs5|Goose
Gwnpl8|Gwenpool
Hbgbln9|Hobgoblin
Hdpl8|Headpool
HdrBb8|Hydra Bob
HdrMn8|Hydro-Man
HdrStmprC|Hydra Stomper
HlcrrrB|Helicarrier
HlkAvngrsC|Hulk (Avengers)
HlkChmpnC|Hulk (Champion)
Hlklng8|Hulkling
Hllcw7|Hellcow
HllcwFrctrdFrntr18|Hellcow (Fractured Frontier)
Hlln7|Hellion
Hmdll8|Heimdall
HmnTrchA|Human Torch
HmnTrchFrstStps14|Human Torch (First Steps)
HmnTrchFrstStpsChmpn1C|Human Torch (First Steps, Champion)
HpSmmrsB|Hope Summers
Hrb6|Herbie
HrbChmpnE|Herbie (Champion)
Hrcls8|Hercules
HtMnk9|Hit-Monkey
Hvk5|Havok
HwkAvngrsF|Hawkeye (Avengers)
HwrdThDckD|Howard the Duck
Ikr5|Unknown card (Ikr5)
InfntUltrnE|Infinite Ultron
InvsblWmnE|Invisible Woman
InvsblWmnFrstStps18|Invisible Woman (First Steps)
IrnLd7|Iron Lad
IrnPtrtB|Iron Patriot
Isc4|Isca
JJnhJmsnD|J. Jonah Jameson
JblSlvrSrfr13|Jubilee (Silver Surfer)
JblXMnB|Jubilee (X-Men)
JckFlg8|Jack Flag
Jcst7|Jocasta
JffThBbDlphn12|Jeff the Baby Dolphin
JffThBbLndShrk14|Jeff the Baby Land Shark
JggrntA|Juggernaut
JggrntHrsmn12|Juggernaut (Horseman)
JmHmmndA|Jim Hammond
JnFstrA|Jane Foster
JnFstrFrctrdFrntr1B|Jane Foster (Fractured Frontier)
JnGr8|Jean Grey
JnGrXMnC|Jean Grey (X-Men)
JnnfrKlC|Jennifer Kale
JqnTrrsD|Joaquin Torres
KdOmg8|Kid Omega
Khhr7|Kahhori
Khnsh7|Khonshu
Klh4|Unknown card (Klh4)
Kng4|Kang
KngEtr9|King Eitri
Kngpn7|Kingpin
Krgln7|Kraglin
KrmShpndrF|Karima Shapandar
KrnPg9|Karen Page
KtBshpA|Kate Bishop
KttPrdA|Kitty Pryde
Lch5|Leech
Lckhd8|Lockheed
Lckjw7|Lockjaw
LdBllsC|Lady Bullseye
LdDthstrkBrthrhdOfMtnts23|Lady Deathstrike (Brotherhood of Mutants)
LdDthstrkF|Lady Deathstrike
Ldr6|Leader
Lf6|Laufey
Lgn6|Legion
Lk4|Loki
LkCg8|Luke Cage
LnL6|Lin Lie
LnSnw8|Luna Snow
Lshr6|Lasher
LvngTrbnlE|Living Tribunal
MBk5|M'Baku
MckngbrdB|Mockingbird
MdThnkrA|Mad Thinker
Mdk5|M.O.D.O.K.
MdmWb9|Madame Web
Mgk5|Magik
MgntBrthrhdOfMtnts1B|Magneto (Brotherhood of Mutants)
Mgs5|Magus
Mj4|Mojo
MjrVctrC|Major Victory
MjstcWngbt10|Majestic Wingbeat
Mk4|Miek
Mkkr7|Makkari
MlMn7|Mole Man
Mlkth8|Malekith
MlsMrlsC|Miles Morales
MnKnghtA|Moon Knight
MnSpdr9|Man-Spider
MnThng8|Man-Thing
MndrgnA|Moondragon
Mnstn9|Moonstone
MnstrOctpsE|Monster Octopus
MntsGrdnsOfThGlx1A|Mantis (Guardians of the Galaxy)
MrFntstcFrstStps15|Mister Fantastic (First Steps)
MrHll9|Maria Hill
MrJn8|Mary Jane
MrX6|Moira X
Mrcr7|Mercury
Mrg6|Mirage
MrgnLFB|Morgan Le Fay
Mrln6|Merlin
Mrph5|Morph
Mrrw6|Marrow
Mrtr6|Martyr
MrvlB9|Marvel Boy
Ms4|Muse
MsMrvl8|Ms. Marvel
Msr6|Misery
MstqBrthrhdOfMtnts1C|Mystique (Brotherhood of Mutants)
Mstr8|Mysterio
MstrMldA|Master Mold
MthrAsknC|Mother Askani
Mvrck8|Maverick
Mxms7|Maximus
Nbl6|Nebula
NcMnrA|Nico Minoru
NchlsScrtchF|Nicholas Scratch
NckFr8|Nick Fury
Nctrn8|Nocturne
NghtcrwlrXMn10|Nightcrawler (X-Men)
Nghtmr9|Nightmare
NgsncTngWrhd17|Negasonic Teenage Warhead
Nk5|Nakia
Nmr6|Namora
Nmrd6|Nimrod
Nmrt8|Namorita
Ok5|Okoye
OmgRd8|Omega Red
Ork4|Orka
OzmndsA|Ozymandias
Phsts7|Phastos
Plrs7|Polaris
PlrsHrsmnF|Polaris (Horseman)
PnPrkrA|Peni Parker
Pnshr8|Punisher
PnshrWrMchn12|Punisher War Machine
Prdg7|Prodigy
PrfssrXA|Professor X
PrfssrXXMnE|Professor X (X-Men)
Prwlr7|Prowler
PrxmMdnghtF|Proxima Midnight
PslckFrctrdFrntr19|Psylocke (Fractured Frontier)
Px5|Pixie
Qcksnd9|Quicksand
Qk5|Quake
Qnjt7|Quinjet
Rcksld9|Rockslide
RcktAndGrtE|Rocket and Groot
RcktRccnChmpn15|Rocket Raccoon (Champion)
RcktRccnGrdnsOfThGlx21|Rocket Raccoon (Guardians of the Galaxy)
RdGrdnB|Red Guardian
RdHlk7|Red Hulk
RdHlkFrctrdFrntr18|Red Hulk (Fractured Frontier)
RdOnslghtC|Red Onslaught
RdShft8|Red Shift
RdWlfFrctrdFrntr18|Red Wolf (Fractured Frontier)
Rdwng7|Redwing
Rg5|Rogue
RgScnOfDvsn14|Rogue, Scion of Division
Rhn5|Rhino
RmTt7|Rama-Tut
Rnn5|Ronan
Rsc6|Rescue
RvnnRnslr10|Ravonna Renslayer
SbMrnrA|Sub-Mariner
SbrtthA|Sabretooth
SbstnShwD|Sebastian Shaw
ScrltSpdrD|Scarlet Spider
ScrltSpdrWbSlngrs18|Scarlet Spider (Web Slingers)
ScrltWtchBrthrhdOfMtnts20|Scarlet Witch (Brotherhood of Mutants)
ScrltWtchQnOfChs18|Scarlet Witch, Queen of Chaos
Scrm6|Scream
Scrn5|Scorn
Scrpn8|Scorpion
ScrpnBrndNwD13|Scorpion (Brand New Day)
Sg4|Sage
ShHlk7|She-Hulk
ShL7|Shou-Lao
ShdwKngA|Shadow King
ShdwlndsDrdvl14|Shadowlands Daredevil
ShngChMstrOfThRngs18|Shang-Chi, Master of the Rings
Shnn6|Shanna
Skr5|Skaar
Slk4|Silk
Sln6|Selene
SlnBrthrhdOfMtnts1A|Selene (Brotherhood of Mutants)
SlnHrsmnE|Selene (Horseman)
SlvrSmrD|Silver Samurai
SlvrSrfrFrstStps16|Silver Surfer (First Steps)
SmWlsn9|Sam Wilson
SmbtSpdrMn11|Symbiote Spider-Man
SmbtSpdrMnWbSlngrs1C|Symbiote Spider-Man (Web Slingers)
Sndstrm9|Sandstorm
SnstrSxB|Sinister Six
SntnlChmpn10|Sentinel (Champion)
SntrThndrblts12|Sentry (Thunderbolts)
Snwgrd9|Snowguard
Spd5|Speed
SpdrHm9|Spider-Ham
SpdrMn2099D|Spider-Man 2099
SpdrMn2099WbSlngrs18|Spider-Man 2099 (Web Slingers)
SpdrMnBrndNwD14|Spider-Man (Brand New Day)
SpdrMnNrD|Spider-Man Noir
SpdrPnkA|Spider-Punk
SpdrSnsB|Spider-Sense
SpdrWmnB|Spider-Woman
SprAdptdD|Super-Adaptoid
SprSkrllB|Super-Skrull
SprgntA|Supergiant
Sprk6|Sparky
SprrIrnMnF|Superior Iron Man
SprrSpdrMn11|Superior Spider-Man
Srg5|Surge
Srn6|Sauron
Srs5|Sersi
Srtr6|Surtur
Ssqtch9|Sasquatch
Stck5|Stick
Stgrn7|Stegron
Strbrnd9|Starbrand
Strdst8|Stardust
Strf6|Stryfe
Strhwk8|Starhawk
StrlrdGrdnsOfThGlx1C|Star-Lord (Guardians of the Galaxy)
StrlrdMstrOfThSn16|Star-Lord, Master of the Sun
StrmHrsmnD|Storm (Horseman)
StrngG9|Strong Guy
StrngSprmE|Strange Supreme
Sttr7|Stature
TchnOrgncVrs12|Techno-Organic Virus
ThAncntOnD|The Ancient One
ThHngr9|The Hunger
ThInvrsnC|The Inversion
ThPhnxFrcF|The Phoenix Force
ThThngFrstStps12|The Thing (First Steps)
ThddsRssC|Thaddeus Ross
Thn5|Thena
ThnsFrctrdFrntr17|Thanos (Fractured Frontier)
Thr4|Thor
ThrAvngrsC|Thor (Avengers)
Tmbstn9|Tombstone
TphdMrB|Typhoid Mary
Tpz5|Topaz
Trntl9|Tarantula
Trrx6|Terrax
Trtn6|Triton
TskmstrThndrblts16|Taskmaster (Thunderbolts)
TxDxA|Toxie Doxie
TxDxThndrblts16|Toxie Doxie (Thunderbolts)
Txn5|Toxin
USAgnt7|U.S. Agent
UnclBn8|Uncle Ben
Ut4|Uatu
VctrHndC|Victoria Hand
Vlkr8|Valkyrie
Vlntn9|Valentina
VlntnThndrblts15|Valentina (Thunderbolts)
Vltr7|Vulture
VmprEnchntrss12|Vampire Enchantress
VmprKllmngr11|Vampire Killmonger
Vnm5|Venom
Vns5|Venus
Vpr5|Viper
Vsn6|Vision
VsnAvngrsE|Vision (Avengers)
Vv3|Viv
WbSlng8|Web Sling
Wccn6|Wiccan
WdWlsnA|Wade Wilson
WhtQnA|White Queen
WhtQnBrthrhdOfMtnts1E|White Queen (Brotherhood of Mutants)
WhtWdwA|White Widow
WldChld9|Wild Child
WlsnFskA|Wilson Fisk
WlvrnHrsmn11|Wolverine (Horseman)
WlvrnXMnD|Wolverine (X-Men)
WntrSldrThndrblts19|Winter Soldier (Thunderbolts)
WpnH7|Weapon H
WpnXWlvrn10|Weapon X Wolverine
WrMchnA|War Machine
Wrlck7|Warlock
Wrpth7|Warpath
WrwlfBNghtF|Werewolf by Night
X233|X-23
Xrn4|Xorn
YllwjcktC|Yellowjacket
ZmbBlckCtE|Zombie Black Cat
ZmbBldB|Zombie Blade
ZmbCptnMrvl13|Zombie Captain Marvel
ZmbGlctD|Zombie Galacta
ZmbGntMnE|Zombie Giant-Man
ZmbMstrFntstc15|Zombie Mister Fantastic
ZmbNvA|Zombie Nova
ZmbPwrMnE|Zombie Power Man
ZmbScrltWtch12|Zombie Scarlet Witch
ZmbSntrC|Zombie Sentry
ZmbVnmB|Zombie Venom
Zr4|Zero`;
const CARD_IDS = { "The Hood": "Hood", "Collector": "TheCollector", "Mister Sinister": "MrSinister", "Star-Lord": "Starlord", "Mister Fantastic": "MrFantastic", "Mister Negative": "MrNegative", "Thing": "TheThing", "Doctor Doom": "DrDoom" };
function cardCode(id) { const s = String(id || "").replace(/[^A-Za-z0-9]/g, ""); return s ? s.replace(/[aeiouy]/g, "") + s.length.toString(16).toUpperCase() : ""; }
