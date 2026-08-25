// isiXhosa translation of the 'String Indexing' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output` and `value` are omitted so they keep their
// English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const indexingModuleXh = {
  "title": "Ukufikelela nge-Index kwiString",
  "level": "Osaqalayo",
  "prerequisite": "Intshayelelo kwiiString",
  "outcomes": [
    "Funda nawuphi na umlinganiswa kwi-string usebenzisa i-brackets yesikwere",
    "Chaza isizathu sokuba i-Python ibalwe ukusuka ku-0, kungekhona ku-1",
    "Sebenzisa amanqaku angekhoyo ukubala ukususela ekupheleni kwestring",
    "Qikelela xa iindex izakunyusa iIndexError"
  ],
  "learnSections": [
    {
      "title": "Wonke umlinganiswa unedilesi",
      "blocks": [
        {
          "text": "I-string ibonakala ngathi yinxalenye enye yombhalo, kodwa i-Python iyibona njengombhalo weebhokisi ezinamanani, uphawu olunye kwibhokisi nganye. index"
        },
        {
          "caption": "I-string \"python\" yibhokisi ezintandathu, ezinamanani ukusuka ku-0 ukuya ku-5."
        },
        {
          "text": "Cinga nje ngezindlu ezisemgceni: xa u tyelela indlu ethile usebenzisa inombolo yayo yesitrato. Xa u tyelela umlinganiswa othile, usebenzisa iindex yayo ngaphakathi kwezikhonkwane zesikwere, emva kwestring okanye igama layo levariable."
        },
        {
          "caption": "Iibhakethi zesikwere emva kwevariable kuthetha \"give me the character at this address\"."
        },
        {
          "title": "Ukufikelela nge-Index",
          "text": "Ukufikelela kumlinganiswa omnye we-string ngesikhundla sayo, ebhalwe njenge-`string[index]`. Isiphumo yi-string entsha yobude 1."
        }
      ]
    },
    {
      "title": "Kutheni ukubalwa kuqala ngo-0",
      "blocks": [
        {
          "text": "Abantu bala i-\"first, second, third…\", ngoko ke kubonakala kungokwemvelo ukuba umlinganiswa wokuqala kufuneka abe yinombolo 1. Python, njengalo lonke ulwimi lwenkqubo, iqala kwi **0** endaweni yoko. I-index ilinganisa ngokwenene * ukuba kude kangakanani na ukuqala * umlinganiswa: umlinganiswa wokuqala ngu-0 amanyathelo, owesibini ngu-1 amanyathelo, njalo njalo."
        },
        {
          "caption": "Index 0 ngumlinganiswa wokuqala: 0 amanyathelo ukusuka ekuqaleni."
        },
        null,
        {
          "title": "Umgibe odumileyo",
          "text": "Ukufunda i-`word[1]` nokulindela i-`p` yeyona mpazamo ixhaphakileyo ye-indexing. Khumbula: i-index 1 ngumlinganiswa *wesibini *. Ukuba ufuna owokuqala, cela i-index 0."
        }
      ]
    },
    {
      "title": "Iinkcukacha ezingalunganga: zibalwa ukususela ekupheleni",
      "blocks": [
        {
          "text": "Ngamanye amaxesha ukhathalele * isiphelo * string, njengonobumba wokugqibela, okanye lowo phambi kwayo. Endaweni yokubala ubude kuqala, Python ikuvumela ukuba ubale umva ngamanani angekhoyo. `-1` usoloko unobumba wokugqibela, `-2` lowo phambi kwayo, njalo njalo."
        },
        {
          "caption": "Iimpawu ezifanelekileyo zibala phambili ukusuka ku-0; iiimpawu ezibi zibala umva ukusuka ku-1."
        },
        null,
        {
          "title": "Amagama amabini, ibhokisi enye",
          "text": "Iimpawu zonke zinamadilesi amabini: enye elungileyo kunye negatives. `n` `i` `i - n` string index index"
        }
      ]
    },
    {
      "title": "Xa i-Python ithi hayi: IndexError",
      "blocks": [
        {
          "text": "I-string yobude 6 ineebhokisi 0 ukuya ku-5 (kunye ne-1 ukuya ku -6). Cela ibhokisi engekhoyo kwaye i-Python iyeka inkqubo yakho nge-`IndexError`."
        },
        null,
        {
          "text": "Qaphela ukuba i-`word[6]` ayiphumeleli nangona i-string ineempawu ezi-6. Ubude buyi-6, kodwa ngenxa yokuba ukubalwa kuqala kwi-0, * eyona nto iphambili i-index* yi-`len(word) - 1`, eyi-5."
        },
        {
          "head": [
            "Ukuvakaliswa",
            "Isiphumo",
            "Kutheni?"
          ],
          "rows": [
            [
              "word[0]",
              "'p'",
              "Ibhokisi yokuqala, 0 amanyathelo ukusuka ekuqaleni"
            ],
            [
              "word[5]",
              "'n'",
              "Ibhokisi yokugqibela: len(word) - 1 = 5"
            ],
            [
              "word[len(word) - 1]",
              "'n'",
              "Ngalo lonke ixesha uphawu lokugqibela, nokuba lungaba lide kangakanani"
            ],
            [
              "word[6]",
              "IndexError",
              "len(word) ivelisa one past the end"
            ],
            [
              "word[-6]",
              "'p'",
              "Eyona ndawo ikude unokuyithelekelela"
            ],
            [
              "word[-7]",
              "IndexError",
              "Ngaphandle komntu wokuqala"
            ]
          ]
        },
        {
          "title": "Umgama wokhuseleko",
          "text": "Kwi-string `s`, yonke i-index esebenzayo iphakathi kwe-`-len(s)` kunye ne-`len(s) - 1`, kuquka. IndexError"
        }
      ]
    },
    {
      "title": "Iimpazamo eziqhelekileyo kwiimviwo",
      "blocks": [
        {
          "text": "Amaphepha adlulileyo aphinda asebenzise amaqhinga afanayo unyaka nonyaka. indexing"
        },
        {
          "head": [
            "Umgibe",
            "Iimvakalelo ezingafanelekanga",
            "Inyaniso"
          ],
          "rows": [
            [
              "Umlinganiswa wokuqala",
              "s[1] ivelisa the first letter",
              "s[0], ekubeni ukubalwa kuqala kwi-zero"
            ],
            [
              "Umlinganiswa wokugqibela",
              "s[len(s)] ivelisa the last letter",
              "s[len(s) - 1] or s[-1]; len(s) ivelisa out of range"
            ],
            [
              "Ukuqala okungalunganga",
              "ii-indices ezibi ziqala kwi-0",
              "ziqala ku -1 kumlinganiswa wokugqibela"
            ],
            [
              "Ukubhala",
              "s[0] = 'x' utshintsha i-string",
              "TypeError: indexing ivelisa read-only"
            ]
          ]
        },
        {
          "title": "Indlela oku kuhlolwa ngayo",
          "text": "I-MCQ ephindaphindiweyo lists index izitsho kwaye ibuza ukuba yeyiphi eya kubangela impazamo, ukuxuba s[len(s)], s[-len(s)] kunye ne-arithmetic njenge s[-8//2]. Sebenzisa nganye kwinani eliqhelekileyo kuqala, emva koko uyivavanye ngokuchasene nomgama okhuselekileyo."
        }
      ]
    },
    {
      "title": "Iimpawu eziphambili",
      "blocks": [
        {
          "items": [
            "Strings yimigca yeebhokisi ezinamanani; `string[index]` ifunda ibhokisi enye.",
            "Ukubala kuqala ku-0, kwaye i-index ilinganisa umgama ukusuka ekuqaleni.",
            "Iimpawu ezibi zibalwa ukususela ekupheleni: `-1` usoloko uphawu lokugqibela.",
            "Iinkcukacha ezifanelekileyo ziqala kwi`-len(s)` ukuya kwi`len(s) - 1`. IndexError",
            "Umlinganiswa wokugqibela ngu`s[len(s) - 1]`, okanye nje u`s[-1]`."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukufunda umlinganiswa wokuqala nowokugqibela",
      "intro": "Umhloli wegama lomsebenzisi ufuna oonobumba bokuqala nabokugqibela kwigama.",
      "steps": [
        {
          "text": "I-Python igcina i-\"sipho\" njengeebhokisi ezintlanu, ezichazwe nge-0 ukuya kwi-4 (okanye -5 ukuya kwi-1 ukusuka ekupheleni)."
        },
        {
          "text": "I-`name[0]` ihamba i-0 amanyathelo ukusuka ekuqaleni kwaye ifunda ibhokisi: I-`first` iba yi-`\"s\"`."
        },
        {
          "text": "I-`name[-1]` ibala enye emva komnye: i-`last` iba yi-`\"o\"`. Akukho mfuneko yokwazi ubude."
        },
        {
          "text": "Iimpawu ezimbini ze-strings zilungelelaniswe ne-`+` kwaye ziprintwe."
        }
      ]
    },
    {
      "title": "Ukufumana umlinganiswa ophakathi",
      "intro": "Kwi-string enobude obungaqhelekanga, umlinganiswa ophakathi uhlala kwi-index `len(s) // 2`. Landela i-arithmetic.",
      "steps": [
        {
          "text": "I-`len(s)` ngu-5, ngoko i-string ineebhokisi ezintlanu, ezichazwe kwi-0 ukuya kwi-4."
        },
        {
          "text": "`5 // 2` yinani elipheleleyo: lifumana 2, lilahla okuseleyo. `mid = 2`"
        },
        {
          "text": "I-`s[2]` iqala inyathelo elibini ukusuka ekuqaleni ize ifike kwi-`\"b\"`, kanye ibhokisi embindini, ineebhokisi ezimbini kwicala ngalinye."
        }
      ]
    },
    {
      "title": "Ukuqikelela i-IndexError",
      "intro": "Ukukwazi ukubona i-index engaphandle kwebanga ngaphambi kokuba usebenzise ikhowudi kuyingcali yokwenene.",
      "steps": [
        {
          "text": "\"cape\" inobude 4, ngoko ke ii-indices ezisemthethweni ziyi-0, 1, 2, 3 (kwaye -1 ukuya -4)."
        },
        {
          "text": "I-`city[3]` ingaphakathi kwebanga, ngoko ifunda ibhokisi yokugqibela ize iprinte i-`\"e\"`."
        },
        {
          "text": "I-`city[4]` icela ibhokisi yesihlanu engekhoyo. I-Python iphakamisa i-`IndexError: string index out of range` kwaye inkqubo iyeka."
        }
      ]
    }
  ],
  "visualizer": {
    "title": "Umhloli we-Index",
    "description": "Faka nayiphi na i-string kunye ne-index, echanekileyo okanye engeyiyo, emva koko ucofe uVisualize ukubukela i-Python ihamba kwiibhokisi kwaye isombulule ibinzana lakho inyathelo ngenyathelo."
  },
  "practice": {
    "warmup": {
      "title": "Ukufudumala: beka iidilesi kwakhona",
      "prompt": "Thatha umlinganiswa ngamnye we\"python\" kwiindex yayo. Nqakraza kwi tile uze unqakraze kwindawo ukuba ukhetha ukungasuki."
    }
  }
};
