// isiXhosa translation of the 'String Indexing' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output`, `value` and table rows are omitted so they keep
// their English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const indexingModuleXh = {
  "title": "String Indexing",
  "level": "Osaqalayo",
  "outcomes": [
    "Funda nawuphi na umlinganiswa kwi-string usebenzisa ii-brackets zesikwere",
    "Chaza isizathu sokuba i-Python ibalwe ukusuka ku-0, kungekhona ku-1",
    "Sebenzisa ii-indices ezingezizo ukubala ukususela ekupheleni kwe-string",
    "Qikelela xa i-index iza kuphakamisa i-IndexError"
  ],
  "learnSections": [
    {
      "title": "Wonke umlinganiswa unedilesi",
      "blocks": [
        {
          "text": "I-string ibonakala njengebhloko yombhalo oqinileyo, kodwa i-Python iyibona njengomgca weebhokisi ezinamanani, uphawu olunye kwibhokisi nganye. Inombolo kwibhokisi nganye ibizwa ngokuba yi **index** yayo."
        },
        {
          "caption": "I-string \"python\" yibhokisi ezintandathu, ezinamanani ukusuka ku-0 ukuya ku-5."
        },
        {
          "text": "Cinga ngayo njengezindlu ezitratweni: ukutyelela indlu ethile usebenzisa inombolo yayo yesitrato. Ukutyelela umlinganiswa othile, usebenzisa i-index yayo ngaphakathi kwezikhonkwane zesikwere, emva nje kwe-string okanye igama layo le-variable."
        },
        {
          "caption": "Izikhonkwane zesikwere emva kwevariable kuthetha \"give me the character at this address\"."
        },
        {
          "title": "Indexing",
          "text": "Ukufikelela kumlinganiswa omnye we-string ngesikhundla sayo, ebhalwe njenge-`string[index]`. Isiphumo yi-string entsha yobude 1."
        }
      ]
    },
    {
      "title": "Kutheni ukubala kuqala ku-0",
      "blocks": [
        {
          "text": "Abantu babala i-\"first, second, third…\", ngoko kubonakala kungokwemvelo ukuba umlinganiswa wokuqala kufuneka abe yinombolo 1. I-Python, njengalo lonke ulwimi lwenkqubo, iqala nge **0** endaweni yoko. I-index ilinganisa ngokwenene *ukude kangakanani ukusuka ekuqaleni * umlinganiswa: umlinganiswa wokuqala ngu-0 amanyathelo, owesibini ngu-1 amanyathelo, njalo njalo."
        },
        {
          "caption": "Index 0 ngumlinganiswa wokuqala: 0 amanyathelo ukusuka ekuqaleni."
        },
        null,
        {
          "title": "Umgibe oqhelekileyo",
          "text": "Ukufunda i-`word[1]` nokulindela i-`p` yeyona mpazamo ixhaphakileyo ye-indexing. Khumbula: i-index 1 ngumlinganiswa *wesibini.* Ukuba ufuna owokuqala, cela i-index 0."
        }
      ]
    },
    {
      "title": "Iindiza ezingalunganga: zibalwa ukususela ekupheleni",
      "blocks": [
        {
          "text": "Ngamanye amaxesha ukhathalele * isiphelo * sestring, njengophawu lokugqibela, okanye olungaphambi kwalo. Endaweni yokubala ubude kuqala, Python ikuvumela ukuba ubale umva ngamanani angekhoyo. `-1` usoloko uphawu lokugqibela, `-2` olungaphambi kwalo, njalo njalo."
        },
        {
          "caption": "Ii-indices ezichanekileyo zibala phambili ukusuka ku-0; ii-indices ezingalunganga zibala umva ukusuka ku-1."
        },
        null,
        {
          "title": "Amagama amabini, ibhokisi enye",
          "text": "Umlinganiswa ngamnye uneedilesi ezimbini: enye elungileyo kunye nomnye ongalunganga. Kwi-string yobude be-`n`, i-index `i` kunye ne-index `i - n` iphuzu kumlinganiswa ofanayo."
        }
      ]
    },
    {
      "title": "Xa uPython esithi hayi: IndexError",
      "blocks": [
        {
          "text": "I-string yobude 6 ineebhokisi 0 ukuya ku-5 (kwaye -1 ukuya ku -6). Cela ibhokisi engekhoyo kwaye i-Python iyeka inkqubo yakho nge-`IndexError`."
        },
        null,
        {
          "text": "Qaphela ukuba i-`word[6]` ayiphumeleli nangona i-string ineempawu ezi-6. Ubude buyi-6, kodwa ngenxa yokuba ukubalwa kuqala kwi-0, * eyona nto iphambili i-index* yi-`len(word) - 1`, eyi-5."
        },
        {
          "head": [
            "Inkcazo",
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
              "Ngalo lonke ixesha umlinganiswa wokugqibela, kungakhathaliseki ubude"
            ],
            [
              "word[6]",
              "IndexError",
              "I-len(word) yenye emva kokuphela"
            ],
            [
              "word[-6]",
              "'p'",
              "Emuva kangangoko unako ukubala"
            ],
            [
              "word[-7]",
              "IndexError",
              "Ngaphaya komlinganiswa wokuqala"
            ]
          ]
        },
        {
          "title": "Indawo ekhuselekileyo",
          "text": "Kwistring `s`, wonke ii-index ezisebenzayo zihlala phakathi kwe-`-len(s)` no-`len(s) - 1`, kubandakanywa nazo. Nayiphi na into engaphandle kwelo hlelo iphakamisa i-IndexError."
        }
      ]
    },
    {
      "title": "Iimpazamo eziqhelekileyo kwiimvavanyo neemviwo",
      "blocks": [
        {
          "text": "Amaphepha adlulileyo aphinda asebenzise umbandela ofanayo weindexing unyaka nonyaka. Umqolo ngamnye ongezantsi yimpazamo eye yabiza amanqaku okwenene, ngoko zikhangele kuzo zonke ezine ngaphambi kokuba wenze naluphi na uvavanyo."
        },
        {
          "head": [
            "Umgibe",
            "Iimvakalelo ezingalunganga",
            "Inyaniso"
          ],
          "rows": [
            [
              "Umlinganiswa wokuqala",
              "I-s[1] yileta yokuqala",
              "I-s[0], ekubeni ukubalwa kuqala kwi-zero"
            ],
            [
              "Umlinganiswa wokugqibela",
              "I-s[len(s)] yileta yokugqibela",
              "s[len(s) - 1] okanye s[-1]; len(s) ingaphaya komda"
            ],
            [
              "Ukuqala okungalunganga",
              "ii-indices ezingezizo ziqala kwi-0",
              "ziqala ngo-1 kumlinganiswa wokugqibela"
            ],
            [
              "Ukubhala",
              "s[0] = 'x' utshintsha string",
              "I-TypeError: I-indexing ifundeka kuphela"
            ]
          ]
        },
        {
          "title": "Indlela oku kuhlolwa ngayo",
          "text": "Ukuphindaphinda MCQ lists index izivakalisi kunye nemibuzo eya kubangela impazamo, ukuxuba s[len(s)], s[-len(s)] kunye ne-arithmetic ezifana s[-8//2]. Sebenzisa nganye ukuya kwinani eliqhelekileyo kuqala, emva koko uyivavanye nendawo ekhuselekileyo."
        }
      ]
    },
    {
      "title": "Izikhokelo ezibalulekileyo",
      "blocks": [
        {
          "items": [
            "Strings yimigca yeebhokisi ezinamanani; `string[index]` ifunda ibhokisi enye.",
            "Ukubala kuqala ku-0, kwaye i-index ilinganisa umgama ukusuka ekuqaleni.",
            "Iimpawu ezingalunganga zibalwa ukususela ekupheleni: `-1` usoloko uphawu lokugqibela.",
            "Ii-indices ezisemthethweni zibala ukusuka ku-`-len(s)` ukuya ku-`len(s) - 1`. Nantoni na enye iphakamisa i-IndexError.",
            "Umlinganiswa wokugqibela ngu`s[len(s) - 1]`, okanye nje u`s[-1]`."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukufunda umlinganiswa wokuqala nowokugqibela",
      "intro": "Umhloli wegama lomsebenzisi udinga oonobumba bokuqala nabokugqibela begama.",
      "steps": [
        {
          "text": "I-Python igcina i-\"sipho\" njengeebhokisi ezintlanu, ezichazwe nge-0 ukuya ku-4 (okanye -5 ukuya ku-1 ukusuka ekupheleni)."
        },
        {
          "text": "I-`name[0]` ihamba amanyathelo angama-0 ukusuka ekuqaleni kwaye ifunda ibhokisi: I-`first` iba yi-`\"s\"`."
        },
        {
          "text": "I-`name[-1]` ibala enye emva kokuphela: i-`last` iba yi-`\"o\"`. Akukho mfuneko yokwazi ubude."
        },
        {
          "text": "Ii-strings ezimbini ze-single-character zidityaniswa ne-`+` kwaye ziprintwe."
        }
      ]
    },
    {
      "title": "Ukufumana umlinganiswa ophakathi",
      "intro": "Kwi-string enobude obungaqhelekanga, umlinganiswa ophakathi uhlala kwi-index `len(s) // 2`. Landela i-arithmetic.",
      "steps": [
        {
          "text": "I-`len(s)` ngu-5, ngoko i-string ineebhokisi ezintlanu, ezibhalwe ngo-0 ukuya ku-4."
        },
        {
          "text": "`5 // 2` kukwahlula inani elipheleleyo: linika 2, lilahla okuseleyo. Ngoko `mid = 2`."
        },
        {
          "text": "I-`s[2]` ihamba amanyathelo amabini ukusuka ekuqaleni ize ifike kwi-`\"b\"`, kanye ibhokisi embindini, ineebhokisi ezimbini kwicala ngalinye."
        }
      ]
    },
    {
      "title": "Ukuqikelela iIndexError",
      "intro": "Ukukwazi ukubona i-index engaphaya komda ngaphambi kokuba usebenzise ikhowudi kuyingcali yokwenene.",
      "steps": [
        {
          "text": "I-\"cape\" inobude 4, ngoko ii-indices ezisemthethweni ziyi-0, 1, 2, 3 (kwaye -1 ukuya -4)."
        },
        {
          "text": "I-`city[3]` ingaphakathi kuluhlu, ngoko ifunda ibhokisi yokugqibela ize iprinte i-`\"e\"`."
        },
        {
          "text": "I-`city[4]` icela ibhokisi yesihlanu engekhoyo. I-Python iphakamisa i-`IndexError: string index out of range` kwaye inkqubo iyayeka."
        }
      ]
    }
  ],
  "visualizer": {
    "title": "Index Explorer",
    "description": "Faka nayiphi na i-string kunye ne-index, echanekileyo okanye engeyiyo, emva koko ucofe i-Visualize ukubukela i-Python ihamba kwiibhokisi kwaye isombulule ibinzana lakho inyathelo ngenyathelo.",
    "defaults": {
      "text": "i-conundrum"
    }
  },
  "practice": {
    "warmup": {
      "title": "Ukufudumala: beka kwakhona iidilesi",
      "prompt": "Thatha uphawu ngalunye lwe-\"python\" kwi-index yayo. Nqakraza kwithayile uze unqakraze kwislot ukuba ukhetha ukungayikhuphi."
    }
  }
};
